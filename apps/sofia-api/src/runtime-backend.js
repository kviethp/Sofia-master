import fs from 'node:fs/promises';
import path from 'node:path';

import {
  claimStaleRunInPostgres,
  closePostgresStore,
  completeRunInPostgres,
  createPostgresStore,
  createTaskInPostgres,
  ensureSchema,
  failRunInPostgres,
  approveTaskInPostgres,
  getRunFromPostgres,
  getTaskFromPostgres,
  heartbeatRunLease,
  listApprovalsInPostgres,
  listPendingApprovalsInPostgres,
  listRunsInPostgres,
  listTasksInPostgres,
  listTaskRuns,
  listChildTasksInPostgres,
  listTaskApprovals,
  listRunArtifacts,
  listRunDecisions,
  listRunSteps,
  listRunUsage,
  probePostgres,
  queueTaskRunInPostgres,
  replayDeadLetterRunInPostgres,
  recordArtifact,
  recordDecision,
  recordRunStep,
  rejectTaskInPostgres,
  startRunInPostgres,
  summarizeRuntimeInPostgres
} from './postgres-store.js';
import {
  closeRedisQueue,
  createRedisQueue,
  dequeueRun,
  enqueueDeadLetter,
  enqueueRun,
  getQueueStats,
  probeRedis
} from './redis-queue.js';
import {runTaskWithOpenClaw} from './run-executor.js';
import {afterMilestoneHook, afterResumeHook, beforeCompactionHook, safeMemoryHook} from './memory-hooks.js';
import {sendTelegramMessage, validateOpenClawConfig, getDefaultTelegramTarget} from '../../../packages/openclaw-adapter/src/index.js';
import {resolveCompiledSkillRegistry} from '../../../packages/skill-compiler/src/index.js';
import {applyProjectTemplate, listProjectTemplates as listBuiltinProjectTemplates} from './project-templates.js';
import {
  getAllowedSkillTrustLevels,
  getDeniedProviders,
  getTokenBudgetCaps,
  resolveRequiredSkillIds
} from '../../../packages/policy-engine/src/index.js';
import {
  createTask as createFilesystemTask,
  getRun as getFilesystemRun,
  getTask as getFilesystemTask,
  startTask as startFilesystemTask
} from './scaffold-store.js';
import {getRuntimePaths} from './paths.js';

const runtimeStartedAt = Date.now();

async function readRuntimeMemoryIndex(runtimePaths) {
  try {
    const raw = await fs.readFile(path.join(runtimePaths.stateDir, 'memory', 'index.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {version: 1, activeTaskId: '', tasks: []};
  }
}

async function summarizeActiveMemoryTimeline(runtimePaths) {
  const index = await readRuntimeMemoryIndex(runtimePaths);
  const activeTaskId = index?.activeTaskId ? String(index.activeTaskId) : '';
  const entry = Array.isArray(index?.tasks) ? index.tasks.find((item) => String(item.taskId) === activeTaskId) : null;
  if (!activeTaskId || !entry?.timelinePath) {
    return {
      activeTaskId: activeTaskId || null,
      available: false,
      timelinePath: entry?.timelinePath || null,
      summary: null
    };
  }

  try {
    const timeline = await fs.readFile(entry.timelinePath, 'utf8');
    const summary = String(timeline || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- '))
      .slice(0, 7);

    return {
      activeTaskId,
      title: entry.title || null,
      available: true,
      timelinePath: entry.timelinePath,
      summary,
      updatedAt: entry.updatedAt || null
    };
  } catch {
    return {
      activeTaskId,
      title: entry.title || null,
      available: false,
      timelinePath: entry.timelinePath,
      summary: null,
      updatedAt: entry.updatedAt || null
    };
  }
}

function getRuntimePolicySnapshot() {
  return {
    denyProviders: getDeniedProviders(),
    tokenBudgets: getTokenBudgetCaps(),
    allowedSkillTrustLevels: getAllowedSkillTrustLevels()
  };
}

async function getRuntimeSkillRegistry(runtime, {storageMode = 'filesystem'} = {}) {
  const requiredSkillIds = resolveRequiredSkillIds({
    workerRole: 'builder',
    executionMode: useOpenClawExecution() ? 'openclaw' : 'scaffold',
    storageMode
  });
  let registry;

  try {
    registry = await resolveCompiledSkillRegistry({
      rootDir: runtime.rootDir,
      sourceDir: runtime.skillSourceDir,
      outputDir: runtime.skillOutputDir,
      manifestPath: runtime.skillManifestPath,
      autoCompile: runtime.skillAutoCompile
    });
  } catch (error) {
    registry = {
      ok: false,
      status: 'error',
      autoCompiled: false,
      manifestPath: runtime.skillManifestPath,
      sourceDir: runtime.skillSourceDir,
      outputDir: runtime.skillOutputDir,
      skillCount: 0,
      skills: [],
      errors: [error?.message ?? String(error)]
    };
  }

  return {
    ok: registry.ok,
    status: registry.status,
    autoCompiled: registry.autoCompiled,
    manifestPath: registry.manifestPath,
    sourceDir: registry.sourceDir,
    outputDir: registry.outputDir,
    skillCount: registry.skillCount,
    requiredSkillIds,
    allowedTrustLevels: getAllowedSkillTrustLevels(),
    skills: registry.skills.map((skill) => ({
      id: skill.id,
      version: skill.version,
      trustLevel: skill.trustLevel,
      requiredTools: skill.requiredTools || []
    })),
    errors: registry.errors || []
  };
}

async function writePostgresArtifact(runtime, run, task) {
  const artifactDir = path.join(runtime.artifactDir, run.id);
  const phaseArtifactMap = {
    planner: {
      kind: 'plan',
      filename: 'plan-artifact.md'
    },
    builder: {
      kind: 'build',
      filename: 'build-artifact.md'
    },
    verifier: {
      kind: 'verify',
      filename: 'verify-artifact.md'
    }
  };
  const phaseArtifact = phaseArtifactMap[run.workerRole] || {
    kind: 'report',
    filename: 'summary.md'
  };
  const artifactPath = path.join(artifactDir, phaseArtifact.filename);
  await fs.mkdir(artifactDir, {recursive: true});
  await fs.writeFile(
    artifactPath,
    [
      '# Sofia PostgreSQL Artifact',
      '',
      `- Task: ${task.title}`,
      `- Risk: ${task.risk}`,
      `- Worker role: ${run.workerRole}`,
      `- Model profile: ${run.modelProfile}`,
      '',
      'This artifact was generated from the PostgreSQL + Redis scaffold path.'
    ].join('\n'),
    'utf8'
  );

  return {
    kind: phaseArtifact.kind,
    uri: artifactPath
  };
}

async function writeWorkflowSummaryArtifact(runtime, task, finalRun, runs) {
  const artifactDir = path.join(runtime.artifactDir, finalRun.id);
  const artifactPath = path.join(artifactDir, 'workflow-summary.md');
  await fs.mkdir(artifactDir, {recursive: true});
  await fs.writeFile(
    artifactPath,
    [
      '# Sofia Workflow Summary',
      '',
      `- Task: ${task.title}`,
      `- Risk: ${task.risk}`,
      `- Workflow: ${task.workflowTemplate || 'planner_builder_verifier'}`,
      `- Final status: ${task.status}`,
      '',
      '## Phase Runs',
      ...runs.map(
        (run) =>
          `- Phase ${run.phaseIndex}: ${run.workerRole} | status=${run.status} | profile=${run.modelProfile} | run=${run.id}`
      )
    ].join('\n'),
    'utf8'
  );

  return {
    kind: 'summary',
    uri: artifactPath
  };
}

function useOpenClawExecution() {
  return (process.env.SOFIA_EXECUTION_MODE || 'scaffold') === 'openclaw';
}

function getWorkerId() {
  return process.env.SOFIA_WORKER_ID || `worker-${process.pid}`;
}

function getLeaseSeconds() {
  return Math.max(1, Number(process.env.SOFIA_RUN_LEASE_SECONDS || 90));
}

function getMaxAttempts() {
  return Math.max(1, Number(process.env.SOFIA_RUN_MAX_ATTEMPTS || 3));
}

function getHeartbeatIntervalMs() {
  const explicit = Number(process.env.SOFIA_RUN_HEARTBEAT_MS || 0);
  if (explicit > 0) {
    return explicit;
  }
  return Math.max(1000, Math.floor((getLeaseSeconds() * 1000) / 2));
}

function getTelegramApprovalTarget(runtime) {
  const config = validateOpenClawConfig(runtime.openClawConfigPath);
  return process.env.SOFIA_REPORT_TARGET || getDefaultTelegramTarget(config);
}


function deriveDegradedRuntimeProfile(report) {
  const postgresOk = Boolean(report?.postgres?.ok);
  const redisOk = Boolean(report?.redis?.ok);
  const executionMode = useOpenClawExecution() ? 'openclaw' : 'scaffold';
  const reasons = [];

  if (!postgresOk) reasons.push('postgres_unavailable');
  if (!redisOk) reasons.push('redis_unavailable');

  if (postgresOk && redisOk) {
    return {
      mode: 'healthy',
      capabilities: {
        canReadRuntimeState: true,
        canCreateTasks: true,
        canQueueRuns: true,
        canExecuteRuns: true,
        canApprove: true,
        canReplay: true
      },
      reasons,
      executionMode
    };
  }

  if (!postgresOk && !redisOk) {
    return {
      mode: 'read-only-degraded',
      capabilities: {
        canReadRuntimeState: true,
        canCreateTasks: false,
        canQueueRuns: false,
        canExecuteRuns: false,
        canApprove: false,
        canReplay: false
      },
      reasons,
      executionMode
    };
  }

  return {
    mode: 'queue-degraded',
    capabilities: {
      canReadRuntimeState: true,
      canCreateTasks: false,
      canQueueRuns: false,
      canExecuteRuns: false,
      canApprove: false,
      canReplay: false
    },
    reasons,
    executionMode
  };
}

function createDegradedRuntimeError(profile, action) {
  const error = new Error(`Runtime is in ${profile.mode}; action ${action} is temporarily unavailable.`);
  error.code = 'SOFIA_DEGRADED_RUNTIME';
  error.statusCode = 503;
  error.details = {
    mode: profile.mode,
    reasons: profile.reasons,
    capabilities: profile.capabilities,
    action
  };
  return error;
}


function createDecisionJournal({decisionType, selectedOption, rationale, alternatives = [], rollbackSignal = '', extra = {}}) {
  return {
    decisionType,
    selectedOption,
    rationale,
    alternatives,
    rollbackSignal: rollbackSignal || null,
    ...extra
  };
}

function buildApprovalRequestMessage(task, approval) {
  return [
    'Sofia approval required',
    `Task: ${task.title}`,
    `Risk: ${task.risk}`,
    `Phase: ${approval.phaseName}`,
    `Task ID: ${task.id}`,
    `Approval ID: ${approval.id}`
  ].join('\n');
}

async function withLeaseHeartbeat(store, runId, operation) {
  const workerId = getWorkerId();
  const leaseSeconds = getLeaseSeconds();
  const heartbeatIntervalMs = getHeartbeatIntervalMs();
  const attemptCount = Math.max(1, Number(operation?.attemptCount || 1));
  let timer = null;

  try {
    timer = setInterval(() => {
      heartbeatRunLease(store, runId, {workerId, leaseSeconds, attemptCount}).catch(() => {});
    }, heartbeatIntervalMs);
    timer.unref?.();
    return await operation.run();
  } finally {
    if (timer) {
      clearInterval(timer);
    }
  }
}

async function collectRunTrace(store, runId) {
  const [artifacts, steps, decisions, usageEntries] = await Promise.all([
    listRunArtifacts(store, runId),
    listRunSteps(store, runId),
    listRunDecisions(store, runId),
    listRunUsage(store, runId)
  ]);

  return {artifacts, steps, decisions, usageEntries};
}


function extractRouteExplainability(run, artifacts = []) {
  const artifact = artifacts.find((entry) => ['plan', 'build', 'verify', 'report'].includes(entry?.kind));
  return {
    requestedProfile: run?.modelProfile || null,
    workerRole: run?.workerRole || null,
    artifactUri: artifact?.uri || null,
    adaptiveRouting: artifact?.payload?.adaptiveRouting || null,
    selectedAgentId: artifact?.payload?.selectedAgentId || null,
    selectedModelId: artifact?.payload?.selectedModelId || null,
    actualModel: artifact?.payload?.agentMeta?.model || null,
    actualProvider: artifact?.payload?.agentMeta?.provider || null
  };
}


function extractSkillExplainability(artifacts = [], decisions = []) {
  const artifact = artifacts.find((entry) => ['plan', 'build', 'verify', 'report'].includes(entry?.kind));
  const skillDecision = decisions.find((entry) => entry?.subject === 'required_skills');
  const skillGate = artifact?.payload?.skillGate || artifact?.payload?.skills || null;
  const skillRegistry = artifact?.payload?.skillRegistry || null;
  return {
    requiredSkillIds: skillGate?.requiredSkillIds || [],
    selectedSkills: skillGate?.selectedSkills || [],
    skillGateOk: skillGate?.ok ?? null,
    skillViolations: skillGate?.violations || [],
    registryStatus: skillRegistry?.status || skillDecision?.evidence?.registry?.status || null,
    skillCount: skillRegistry?.skillCount ?? skillDecision?.evidence?.registry?.skillCount ?? null,
    manifestPath: skillRegistry?.manifestPath || skillDecision?.evidence?.registry?.manifestPath || null,
    rationale: skillDecision?.evidence?.rationale || null
  };
}


function summarizeDecisionJournal(decisions = []) {
  return decisions.map((entry) => ({
    id: entry.id,
    category: entry.category,
    subject: entry.subject,
    outcome: entry.outcome,
    decisionType: entry.evidence?.decisionType || null,
    selectedOption: entry.evidence?.selectedOption || null,
    rationale: entry.evidence?.rationale || null,
    rollbackSignal: entry.evidence?.rollbackSignal || null,
    createdAt: entry.createdAt
  }));
}

function summarizeTaskExplainability(task, runs = [], approvals = []) {
  const latestRun = runs[runs.length - 1] || null;
  return {
    currentPhase: task?.currentPhase || null,
    status: task?.status || null,
    latestRunId: latestRun?.id || null,
    latestWorkerRole: latestRun?.workerRole || null,
    pendingApprovalCount: approvals.filter((entry) => entry?.status === 'pending').length,
    runCount: runs.length
  };
}


function summarizeTaskGraph(task, childTasks = []) {
  const graph = task?.graph || {};
  return {
    parentTaskId: task?.parentTaskId || null,
    childTaskCount: childTasks.length,
    childTaskIds: childTasks.map((entry) => entry.id),
    dependencies: Array.isArray(graph.dependencies) ? graph.dependencies : [],
    blockers: Array.isArray(graph.blockers) ? graph.blockers : [],
    labels: Array.isArray(graph.labels) ? graph.labels : [],
    partialCompletion: Number.isFinite(Number(graph.partialCompletion)) ? Number(graph.partialCompletion) : 0
  };
}


function summarizeCompletionQualityGate({task, completedRun, taskRuns = [], decisions = [], artifacts = []}) {
  const artifactKinds = new Set((artifacts || []).map((entry) => entry?.kind).filter(Boolean));
  const quality = {
    objectivePresent: Boolean(task?.title),
    finalRunPresent: Boolean(completedRun?.id),
    decisionLogPresent: (decisions || []).length > 0,
    artifactPresent: artifactKinds.size > 0,
    workflowSummaryPresent: artifactKinds.has('summary') || (task?.workflowTemplate === 'builder_only' && artifactKinds.has('build')),
    runCount: taskRuns.length,
    passed: false
  };
  quality.passed = Boolean(
    quality.objectivePresent &&
    quality.finalRunPresent &&
    quality.decisionLogPresent &&
    quality.artifactPresent
  );
  return quality;
}


function extractReplayState(decisions = []) {
  const replay = decisions.find((entry) => entry?.subject === 'dead_letter_replay');
  if (!replay) return null;
  return {
    outcome: replay.outcome,
    replayedBy: replay.evidence?.replayedBy || null,
    replayReason: replay.evidence?.replayReason || null,
    selectedOption: replay.evidence?.selectedOption || null,
    replayState: replay.evidence?.replayState || null,
    createdAt: replay.createdAt
  };
}

async function processTaskInlineUntilSettled(store, taskId) {
  let processed = null;
  let iterations = 0;
  while (iterations < 12) {
    iterations += 1;
    const current = await processOneQueuedRun();
    if (!current) {
      break;
    }
    if (current.task?.id === taskId) {
      processed = current;
    }

    const task = await getTaskFromPostgres(store, taskId);
    if (!task || task.status === 'completed' || task.status === 'failed' || task.status === 'awaiting_approval') {
      break;
    }
  }

  if (!processed) {
    return null;
  }

  const runs = await listTaskRuns(store, taskId);
  const approvals = await listTaskApprovals(store, taskId);
  return {
    ...processed,
    task: {
      ...processed.task,
      runs,
      approvals
    }
  };
}

export async function probeRuntimeServices() {
  const report = {
    mode: 'filesystem',
    postgres: {ok: false},
    redis: {ok: false}
  };

  let store = null;
  let queue = null;

  try {
    store = createPostgresStore();
    report.postgres = await probePostgres(store);
  } catch (error) {
    report.postgres = {
      ok: false,
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error)
      }
    };
  } finally {
    await closePostgresStore(store);
  }

  try {
    queue = await createRedisQueue();
    report.redis = await probeRedis(queue);
  } catch (error) {
    report.redis = {
      ok: false,
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error)
      }
    };
  } finally {
    await closeRedisQueue(queue);
  }

  if (report.postgres.ok && report.redis.ok) {
    report.mode = 'postgres-redis';
  }

  report.degraded = deriveDegradedRuntimeProfile(report);
  return report;
}

export async function createTask(input = {}) {
  const resolvedInput = applyProjectTemplate(input);
  const runtime = await probeRuntimeServices();
  if (runtime.degraded?.mode && runtime.degraded.mode !== 'healthy' && process.env.SOFIA_ALLOW_DEGRADED_FALLBACK !== 'true') {
    throw createDegradedRuntimeError(runtime.degraded, 'createTask');
  }
  if (runtime.mode !== 'postgres-redis') {
    return createFilesystemTask(resolvedInput);
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    const created = await createTaskInPostgres(store, resolvedInput);
    await safeMemoryHook(afterResumeHook, {
      runtime: getRuntimePaths(),
      task: created,
      reason: 'task_created',
      sourceText: [resolvedInput.title, resolvedInput.description, resolvedInput.note].filter(Boolean).join(' | ')
    });
    return created;
  } finally {
    await closePostgresStore(store);
  }
}

export function listProjectTemplates() {
  return listBuiltinProjectTemplates();
}

export async function getTask(taskId) {
  const runtime = await probeRuntimeServices();
  if (runtime.mode !== 'postgres-redis') {
    return getFilesystemTask(taskId);
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    const task = await getTaskFromPostgres(store, taskId);
    const runs = task ? await listTaskRuns(store, taskId) : [];
    const approvals = task ? await listTaskApprovals(store, taskId) : [];
    return task
      ? {
          ...task,
          explainability: summarizeTaskExplainability(task, runs, approvals),
          runs,
          approvals
        }
      : null;
  } finally {
    await closePostgresStore(store);
  }
}

export async function listTasks(options = {}) {
  const runtime = await probeRuntimeServices();
  if (runtime.mode !== 'postgres-redis') {
    return [];
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    const tasks = await listTasksInPostgres(store, options);
    const enriched = [];
    for (const task of tasks) {
      const [runs, approvals, childTasks] = await Promise.all([
        listTaskRuns(store, task.id),
        listTaskApprovals(store, task.id),
        listChildTasksInPostgres(store, task.id)
      ]);
      enriched.push({
        ...task,
        explainability: summarizeTaskExplainability(task, runs, approvals),
        graphSummary: summarizeTaskGraph(task, childTasks),
        runs,
        approvals,
        childTasks
      });
    }
    return enriched;
  } finally {
    await closePostgresStore(store);
  }
}

export async function listRuns(options = {}) {
  const runtime = await probeRuntimeServices();
  if (runtime.mode !== 'postgres-redis') {
    return [];
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    const runs = await listRunsInPostgres(store, options);
    const enriched = [];
    for (const run of runs) {
      const trace = await collectRunTrace(store, run.id);
      enriched.push({
        ...run,
        routeExplainability: extractRouteExplainability(run, trace.artifacts),
        skillExplainability: extractSkillExplainability(trace.artifacts, trace.decisions),
        decisionJournal: summarizeDecisionJournal(trace.decisions),
        replayState: extractReplayState(trace.decisions),
        completionQualityGate: trace.decisions.find((entry) => entry?.subject === 'completion_gate')?.evidence || null,
        artifacts: trace.artifacts,
        steps: trace.steps,
        decisions: trace.decisions,
        usageEntries: trace.usageEntries
      });
    }
    return enriched;
  } finally {
    await closePostgresStore(store);
  }
}

export async function listPendingApprovals(options = {}) {
  const runtime = await probeRuntimeServices();
  if (runtime.mode !== 'postgres-redis') {
    return [];
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    return await listPendingApprovalsInPostgres(store, options);
  } finally {
    await closePostgresStore(store);
  }
}

export async function listApprovals(options = {}) {
  const runtime = await probeRuntimeServices();
  if (runtime.mode !== 'postgres-redis') {
    return [];
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    return await listApprovalsInPostgres(store, options);
  } finally {
    await closePostgresStore(store);
  }
}

export async function getRuntimeStatus() {
  const runtime = await probeRuntimeServices();
  const runtimePaths = getRuntimePaths();
  const skills = await getRuntimeSkillRegistry(runtimePaths, {
    storageMode: runtime.mode
  });
  const base = {
    mode: runtime.mode,
    services: runtime,
    policy: getRuntimePolicySnapshot(),
    skills,
    worker: {
      inline: (process.env.SOFIA_WORKER_INLINE || 'true') === 'true',
      queueName: process.env.SOFIA_TASK_QUEUE || 'sofia:runs',
      deadLetterQueueName: process.env.SOFIA_DEAD_LETTER_QUEUE || 'sofia:runs:dead-letter'
    }
  };

  if (runtime.mode !== 'postgres-redis') {
    return {
      ...base,
      queue: null,
      tasksByStatus: {},
      runsByStatus: {},
      pendingApprovals: 0
    };
  }

  const store = createPostgresStore();
  const queue = await createRedisQueue();
  try {
    await ensureSchema(store);
    const [summary, queueStats, activeMemoryTimeline] = await Promise.all([
      summarizeRuntimeInPostgres(store),
      getQueueStats(queue),
      summarizeActiveMemoryTimeline(runtimePaths)
    ]);

    return {
      ...base,
      explainability: {
        degradedMode: runtime.degraded?.mode || 'healthy',
        degradedReasons: runtime.degraded?.reasons || [],
        workerInline: base.worker.inline,
        executionMode: runtime.degraded?.executionMode || (useOpenClawExecution() ? 'openclaw' : 'scaffold'),
        skillRegistryStatus: skills?.status || null,
        requiredSkillIds: skills?.requiredSkillIds || [],
        skillCount: skills?.skillCount ?? 0
      },
      memory: {
        activeTimeline: activeMemoryTimeline
      },
      queue: queueStats,
      tasksByStatus: summary.tasksByStatus,
      runsByStatus: summary.runsByStatus,
      pendingApprovals: summary.pendingApprovals
    };
  } finally {
    await closeRedisQueue(queue);
    await closePostgresStore(store);
  }
}

export async function getRuntimeMetrics() {
  const status = await getRuntimeStatus();
  return {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - runtimeStartedAt) / 1000),
    mode: status.mode,
    policy: status.policy,
    services: {
      postgresOk: Boolean(status.services?.postgres?.ok),
      redisOk: Boolean(status.services?.redis?.ok)
    },
    queue: {
      queuedCount: status.queue?.queuedCount ?? 0,
      deadLetterCount: status.queue?.deadLetterCount ?? 0
    },
    skills: {
      ok: Boolean(status.skills?.ok),
      skillCount: status.skills?.skillCount ?? 0,
      requiredSkillCount: status.skills?.requiredSkillIds?.length ?? 0
    },
    counts: {
      pendingApprovals: status.pendingApprovals ?? 0,
      tasksByStatus: status.tasksByStatus || {},
      runsByStatus: status.runsByStatus || {}
    }
  };
}

export async function processOneQueuedRun(options = {}) {
  const runtimeServices = await probeRuntimeServices();
  if (runtimeServices.degraded?.mode && runtimeServices.degraded.mode !== 'healthy') {
    return {
      storageMode: runtimeServices.mode,
      skipped: true,
      reason: 'degraded_runtime',
      degraded: runtimeServices.degraded
    };
  }
  if (runtimeServices.mode !== 'postgres-redis') {
    return null;
  }

  const runtime = getRuntimePaths();
  const store = createPostgresStore();
  const queue = await createRedisQueue();
  const workerId = getWorkerId();
  const leaseSeconds = getLeaseSeconds();
  const maxAttempts = getMaxAttempts();

  try {
    await ensureSchema(store);
    let runId = await dequeueRun(queue, 1);
    let runningRun = null;
    let deadLetteredRun = null;

    if (runId) {
      runningRun = await startRunInPostgres(store, runId, {workerId, leaseSeconds});
    } else {
      const staleRecovery = await claimStaleRunInPostgres(store, {
        workerId,
        leaseSeconds,
        maxAttempts,
        runId: options.staleRunId || null
      });
      if (staleRecovery?.deadLettered) {
        deadLetteredRun = staleRecovery;
      } else {
        runningRun = staleRecovery;
      }
      runId = staleRecovery?.id || null;
    }

    if (!runId) {
      return null;
    }

    if (deadLetteredRun) {
      await recordDecision(store, runId, {
        category: 'durability',
        subject: 'retry_cap',
        outcome: 'dead_lettered',
        evidence: {
          workerId,
          leaseSeconds,
          maxAttempts,
          attemptCount: deadLetteredRun.attemptCount,
          reason: deadLetteredRun.deadLetterReason
        }
      });

      let deadLetterQueue = null;
      try {
        deadLetterQueue = await enqueueDeadLetter(queue, {
          runId,
          taskId: deadLetteredRun.taskId,
          workerId,
          attemptCount: deadLetteredRun.attemptCount,
          maxAttempts,
          reason: deadLetteredRun.deadLetterReason,
          deadLetteredAt: deadLetteredRun.deadLetteredAt
        });
        await recordRunStep(store, runId, 'dead_letter_enqueued', 'completed', {
          queueName: deadLetterQueue.queueName,
          attemptCount: deadLetteredRun.attemptCount
        });
      } catch (error) {
        await recordRunStep(store, runId, 'dead_letter_enqueued', 'failed', {
          queueName: queue.deadLetterQueueName,
          error: error?.message ?? String(error)
        });
      }

      const task = await getTaskFromPostgres(store, deadLetteredRun.taskId);
      await safeMemoryHook(afterMilestoneHook, {
        runtime,
        task,
        run: deadLetteredRun,
        milestone: 'execution_failed',
        detail: `Run dead-lettered after hitting retry cap: ${deadLetteredRun.deadLetterReason || 'unknown reason'}`
      });
      const trace = await collectRunTrace(store, runId);
      return {
        task,
        run: deadLetteredRun,
        artifact: deadLetteredRun.errorArtifact || trace.artifacts[trace.artifacts.length - 1] || null,
        usage: null,
        usageEntries: trace.usageEntries,
        steps: trace.steps,
        decisions: trace.decisions,
        artifacts: trace.artifacts,
        storageMode: 'postgres-redis',
        deadLettered: true,
        deadLetterQueue
      };
    }

    if (!runningRun) {
      const currentRun = await getRunFromPostgres(store, runId);
      if (!currentRun) {
        return {
          storageMode: 'postgres-redis',
          skipped: true,
          reason: 'missing_run',
          runId
        };
      }

      await recordRunStep(store, runId, 'claim_skipped', 'completed', {
        reason: 'run_not_queued',
        currentStatus: currentRun.status
      });
      const task = await getTaskFromPostgres(store, currentRun.taskId);
      const trace = await collectRunTrace(store, runId);
      return {
        task,
        run: currentRun,
        artifact: trace.artifacts[trace.artifacts.length - 1] || null,
        usage: trace.usageEntries[trace.usageEntries.length - 1] || null,
        usageEntries: trace.usageEntries,
        steps: trace.steps,
        decisions: trace.decisions,
        artifacts: trace.artifacts,
        storageMode: 'postgres-redis',
        skipped: true,
        reason: 'already_claimed'
      };
    }

    const taskBeforeComplete = await getTaskFromPostgres(store, runningRun.taskId);
    let completed;

    if (useOpenClawExecution()) {
      await safeMemoryHook(beforeCompactionHook, {
        runtime,
        task: taskBeforeComplete,
        run: runningRun,
        reason: 'before_openclaw_execution'
      });

      await recordRunStep(store, runId, 'execution_requested', 'completed', {
        executionMode: 'openclaw',
        requestedProfile: runningRun.modelProfile,
        workerId,
        leaseSeconds
      });

      let execution;
      try {
        execution = await withLeaseHeartbeat(store, runId, {
          attemptCount: runningRun.attemptCount,
          run: async () =>
            runTaskWithOpenClaw({
              task: taskBeforeComplete,
              run: runningRun,
              runtime
            })
        });
      } catch (error) {
        execution = {
          ok: false,
          result: {
            ok: false,
            exitCode: null,
            stdout: '',
            stderr: error?.message ?? String(error)
          },
          artifact: null,
          usage: null,
          actualModel: null,
          actualProvider: null,
          trace: {
            sessionId: `sofia-${runId}`,
            requestedProfile: runningRun.modelProfile,
            selectedAgentId: null,
            selectedModelId: null,
            notifications: []
          }
        };
      }

      await recordDecision(store, runId, {
        category: 'skills',
        subject: 'execution_bundle',
        outcome: execution.trace?.skills?.ok ? 'permitted' : 'blocked',
        evidence: {
          ...(execution.trace?.skills || {}),
          registry: execution.trace?.skillRegistry || null
        }
      });

      await recordDecision(store, runId, {
        category: 'routing',
        subject: 'openclaw_agent',
        outcome: execution.ok ? 'executed' : 'attempted',
        evidence: createDecisionJournal({
          decisionType: 'model_routing',
          selectedOption: execution.trace?.requestedProfile || runningRun.modelProfile,
          rationale: execution.trace?.adaptiveRouting?.reasons?.join('; ') || 'static or explicit profile selection',
          alternatives: ['sofia-fast', 'sofia-hard', 'sofia-free-fallback'].filter((entry) => entry !== (execution.trace?.requestedProfile || runningRun.modelProfile)),
          rollbackSignal: execution.trace?.guardrails?.ok === false ? 'guardrail_violation' : '',
          extra: {
            sessionId: execution.trace?.sessionId || `sofia-${runId}`,
            requestedProfile: execution.trace?.requestedProfile || runningRun.modelProfile,
            selectedAgentId: execution.trace?.selectedAgentId || null,
            selectedModelId: execution.trace?.selectedModelId || null,
            actualModel: execution.actualModel || null,
            actualProvider: execution.actualProvider || null,
            fallbackDepth: 0,
            degraded: (execution.trace?.requestedProfile || runningRun.modelProfile) === 'sofia-free-fallback',
            adaptiveRouting: execution.trace?.adaptiveRouting || null
          }
        })
      });

      if (execution.trace?.guardrails) {
        await recordDecision(store, runId, {
          category: 'policy',
          subject: 'execution_guardrails',
          outcome: execution.trace.guardrails.ok ? 'passed' : 'blocked',
          evidence: createDecisionJournal({
            decisionType: 'policy_guardrail',
            selectedOption: execution.trace.guardrails.ok ? 'allow' : 'block',
            rationale: execution.trace.guardrails.ok ? 'execution stayed within configured provider/token policies' : 'execution violated provider/token policy constraints',
            alternatives: execution.trace.guardrails.ok ? [] : ['retry_with_lower_cost_path', 'retry_with_safer_profile', 'manual_review'],
            rollbackSignal: execution.trace.guardrails.ok ? '' : 'policy_violation',
            extra: execution.trace.guardrails
          })
        });
      }

      for (const notification of execution.trace?.notifications || []) {
        await recordRunStep(store, runId, notification.name, notification.ok ? 'completed' : 'failed', {
          skipped: notification.skipped,
          delivered: notification.delivered,
          exitCode: notification.exitCode,
          stderr: notification.stderr,
          error: notification.error
        });
      }

      if (!execution.ok) {
        if (execution.trace?.skills && !execution.trace.skills.ok) {
          await recordRunStep(store, runId, 'skill_gate_violation', 'failed', {
            violationCount: execution.trace.skills.violations.length,
            violations: execution.trace.skills.violations
          });
        }
        if (execution.trace?.guardrails && !execution.trace.guardrails.ok) {
          await recordRunStep(store, runId, 'policy_guardrail_violation', 'failed', {
            violationCount: execution.trace.guardrails.violations.length,
            violations: execution.trace.guardrails.violations
          });
        }
        await recordRunStep(store, runId, 'execution_completed', 'failed', {
          provider: execution.actualProvider || null,
          modelProfile: execution.actualModel || runningRun.modelProfile,
          error: execution.result.stderr || execution.result.stdout || 'OpenClaw execution failed'
        });
        const failed = await failRunInPostgres(
          store,
          runId,
          execution.result.stderr || execution.result.stdout || 'OpenClaw execution failed'
        );
        const failedTask = await getTaskFromPostgres(store, runningRun.taskId);
        await safeMemoryHook(afterMilestoneHook, {
          runtime,
          task: failedTask,
          run: failed.run,
          milestone: 'execution_failed',
          detail: execution.result.stderr || execution.result.stdout || 'OpenClaw execution failed'
        });
        const trace = await collectRunTrace(store, runId);
        return {
          task: failedTask,
          run: failed.run,
          artifact: failed.errorArtifact,
          usage: null,
          usageEntries: trace.usageEntries,
          steps: trace.steps,
          decisions: trace.decisions,
          artifacts: trace.artifacts,
          storageMode: 'postgres-redis',
          execution: execution.result
        };
      }

      await recordRunStep(store, runId, 'execution_completed', 'completed', {
        provider: execution.actualProvider || 'router9',
        modelProfile: execution.actualModel || runningRun.modelProfile,
        tokensIn: execution.usage?.input || 0,
        tokensOut: execution.usage?.output || 0
      });

      completed = await completeRunInPostgres(store, runId, execution.artifact, {
        modelProfile: execution.actualModel || runningRun.modelProfile,
        provider: execution.actualProvider || 'router9',
        fallbackDepth: 0,
        tokensIn: execution.usage?.input || 0,
        tokensOut: execution.usage?.output || 0
      });
      await safeMemoryHook(afterMilestoneHook, {
        runtime,
        task: await getTaskFromPostgres(store, runningRun.taskId),
        run: completed.run,
        milestone: 'execution_completed',
        detail: `Completed phase ${runningRun.workerRole || 'builder'} with profile ${execution.actualModel || runningRun.modelProfile}`
      });
    } else {
      const artifact = await withLeaseHeartbeat(store, runId, {
        attemptCount: runningRun.attemptCount,
        run: async () => writePostgresArtifact(runtime, runningRun, taskBeforeComplete)
      });
      completed = await completeRunInPostgres(store, runId, artifact);
      await safeMemoryHook(afterMilestoneHook, {
        runtime,
        task: await getTaskFromPostgres(store, runningRun.taskId),
        run: completed.run,
        milestone: 'execution_completed',
        detail: `Completed scaffold phase ${runningRun.workerRole || 'builder'}`
      });
    }

    let queuedNextRun = null;
    if (completed.nextRun) {
      queuedNextRun = await enqueueRun(queue, completed.nextRun.id);
      await recordRunStep(store, runId, 'next_phase_enqueued', 'completed', {
        queueName: queuedNextRun.queueName,
        nextRunId: completed.nextRun.id,
        nextWorkerRole: completed.nextRun.workerRole,
        nextPhaseIndex: completed.nextRun.phaseIndex
      });
      await safeMemoryHook(afterMilestoneHook, {
        runtime,
        task: await getTaskFromPostgres(store, runningRun.taskId),
        run: completed.run,
        milestone: 'next_phase_enqueued',
        detail: `Queued next phase ${completed.nextRun.workerRole || 'builder'} (${completed.nextRun.id})`
      });
    }

    const task = await getTaskFromPostgres(store, runningRun.taskId);
    if (completed.pendingApproval) {
      const target = getTelegramApprovalTarget(runtime);
      let approvalNotification = {ok: true, skipped: true, delivered: false};
      if ((process.env.SOFIA_REPORT_CHANNEL || 'telegram') === 'telegram' && target) {
        approvalNotification = await sendTelegramMessage({
          target,
          message: buildApprovalRequestMessage(task, completed.pendingApproval),
          cwd: runtime.rootDir
        });
      }
      await recordRunStep(store, runId, 'approval_requested', approvalNotification.ok ? 'completed' : 'failed', {
        approvalId: completed.pendingApproval.id,
        phaseName: completed.pendingApproval.phaseName,
        target,
        delivered: approvalNotification.delivered || false,
        skipped: !target || (process.env.SOFIA_REPORT_CHANNEL || 'telegram') !== 'telegram',
        error: approvalNotification.error?.message || approvalNotification.stderr || null
      });
      await safeMemoryHook(afterMilestoneHook, {
        runtime,
        task,
        run: completed.run,
        milestone: 'approval_requested',
        detail: `Approval requested for phase ${completed.pendingApproval.phaseName}`
      });
    }
    if (!completed.nextRun && task?.status === 'completed' && task.workflowTemplate !== 'builder_only') {
      const taskRuns = await listTaskRuns(store, runningRun.taskId);
      const workflowSummaryArtifact = await writeWorkflowSummaryArtifact(runtime, task, completed.run, taskRuns);
      await recordArtifact(store, runId, workflowSummaryArtifact);
      await recordRunStep(store, runId, 'workflow_summary_written', 'completed', {
        artifactKind: workflowSummaryArtifact.kind,
        artifactUri: workflowSummaryArtifact.uri,
        runCount: taskRuns.length
      });
      await safeMemoryHook(afterMilestoneHook, {
        runtime,
        task,
        run: completed.run,
        milestone: 'workflow_completed',
        detail: `Workflow completed with ${taskRuns.length} phase run(s).`
      });
    }
    const trace = await collectRunTrace(store, runId);
    const taskRunsForQuality = !completed.nextRun && task?.status === 'completed' ? await listTaskRuns(store, runningRun.taskId) : [];
    const completionQualityGate = summarizeCompletionQualityGate({
      task,
      completedRun: completed.run,
      taskRuns: taskRunsForQuality,
      decisions: trace.decisions,
      artifacts: trace.artifacts
    });
    await recordDecision(store, runId, {
      category: 'quality',
      subject: 'completion_gate',
      outcome: completionQualityGate.passed ? 'passed' : 'warning',
      evidence: createDecisionJournal({
        decisionType: 'completion_quality_gate',
        selectedOption: completionQualityGate.passed ? 'complete' : 'complete_with_warning',
        rationale: completionQualityGate.passed ? 'completion met minimum runtime quality checks' : 'completion is missing one or more expected quality signals',
        alternatives: completionQualityGate.passed ? [] : ['retry_verification', 'write_missing_artifact', 'request_manual_review'],
        rollbackSignal: completionQualityGate.passed ? '' : 'quality_gate_warning',
        extra: completionQualityGate
      })
    });

    return {
      task,
      run: completed.run,
      nextRun: completed.nextRun,
      pendingApproval: completed.pendingApproval,
      artifact: completed.artifact,
      usage: completed.usage,
      usageEntries: trace.usageEntries,
      steps: trace.steps,
      decisions: trace.decisions,
      artifacts: trace.artifacts,
      completionQualityGate,
      storageMode: 'postgres-redis',
      queue: queuedNextRun
        ? {
            name: queuedNextRun.queueName
          }
        : undefined
    };
  } finally {
    await closeRedisQueue(queue);
    await closePostgresStore(store);
  }
}

export async function startTask(taskId) {
  const runtime = await probeRuntimeServices();
  if (runtime.degraded?.mode && runtime.degraded.mode !== 'healthy' && process.env.SOFIA_ALLOW_DEGRADED_FALLBACK !== 'true') {
    throw createDegradedRuntimeError(runtime.degraded, 'startTask');
  }
  if (runtime.mode !== 'postgres-redis') {
    return startFilesystemTask(taskId);
  }

  const store = createPostgresStore();
  const queue = await createRedisQueue();

  try {
    await ensureSchema(store);
    let queued;
    try {
      queued = await queueTaskRunInPostgres(store, taskId);
    } catch (error) {
      if (error?.code === 'SOFIA_TASK_BLOCKED') {
        const task = await getTaskFromPostgres(store, taskId);
        return {
          task,
          blocked: true,
          blockedReason: error.message,
          dependencyState: error.details,
          storageMode: 'postgres-redis'
        };
      }
      throw error;
    }
    await enqueueRun(queue, queued.run.id);
    await safeMemoryHook(afterResumeHook, {
      runtime: getRuntimePaths(),
      task: queued.task,
      reason: 'task_started',
      sourceText: [queued.task.title, queued.task.currentPhase, queued.task.workflowTemplate].filter(Boolean).join(' | ')
    });

    if ((process.env.SOFIA_WORKER_INLINE || 'true') === 'true') {
      const processed = await processTaskInlineUntilSettled(store, taskId);
      if (processed?.task?.id === taskId) {
        return processed;
      }
    }

    const trace = await collectRunTrace(store, queued.run.id);
    const runs = await listTaskRuns(store, taskId);
    const approvals = await listTaskApprovals(store, taskId);

    return {
      ...queued,
      task: {
        ...queued.task,
        runs,
        approvals
      },
      queue: {
        name: queue.queueName
      },
      steps: trace.steps,
      decisions: trace.decisions,
      artifacts: trace.artifacts,
      usageEntries: trace.usageEntries,
      storageMode: 'postgres-redis'
    };
  } finally {
    await closeRedisQueue(queue);
    await closePostgresStore(store);
  }
}

export async function approveTask(taskId, input = {}) {
  const runtime = await probeRuntimeServices();
  if (runtime.degraded?.mode && runtime.degraded.mode !== 'healthy') {
    throw createDegradedRuntimeError(runtime.degraded, 'approveTask');
  }
  if (runtime.mode !== 'postgres-redis') {
    throw new Error('Approval flow requires PostgreSQL and Redis runtime mode');
  }

  const store = createPostgresStore();
  const queue = await createRedisQueue();
  try {
    await ensureSchema(store);
    const approved = await approveTaskInPostgres(store, taskId, input);
    await enqueueRun(queue, approved.run.id);
    await safeMemoryHook(afterResumeHook, {
      runtime: getRuntimePaths(),
      task: approved.task,
      reason: 'approval_resumed',
      sourceText: [input.note, input.decisionBy, approved.approval?.phaseName].filter(Boolean).join(' | ')
    });

    const target = getTelegramApprovalTarget(getRuntimePaths());
    if ((process.env.SOFIA_REPORT_CHANNEL || 'telegram') === 'telegram' && target) {
      await sendTelegramMessage({
        target,
        message: [
          'Sofia approval accepted',
          `Task: ${approved.task.title}`,
          `Risk: ${approved.task.risk}`,
          `Phase: ${approved.approval.phaseName}`,
          `Task ID: ${approved.task.id}`,
          `Approval ID: ${approved.approval.id}`
        ].join('\n'),
        cwd: getRuntimePaths().rootDir
      });
    }

    if ((process.env.SOFIA_WORKER_INLINE || 'true') === 'true') {
      const processed = await processTaskInlineUntilSettled(store, taskId);
      if (processed?.task?.id === taskId) {
        return {
          ...processed,
          approval: approved.approval
        };
      }
    }

    const runs = await listTaskRuns(store, taskId);
    const approvals = await listTaskApprovals(store, taskId);
    return {
      ...approved,
      task: {
        ...approved.task,
        runs,
        approvals
      },
      queue: {
        name: queue.queueName
      }
    };
  } finally {
    await closeRedisQueue(queue);
    await closePostgresStore(store);
  }
}

export async function rejectTask(taskId, input = {}) {
  const runtime = await probeRuntimeServices();
  if (runtime.mode !== 'postgres-redis') {
    throw new Error('Approval flow requires PostgreSQL and Redis runtime mode');
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    const rejected = await rejectTaskInPostgres(store, taskId, input);
    await safeMemoryHook(afterMilestoneHook, {
      runtime: getRuntimePaths(),
      task: rejected.task,
      run: null,
      milestone: 'approval_rejected',
      detail: `Approval rejected for task ${rejected.task?.title || taskId}.`,
      sourceText: [input.note, input.decisionBy].filter(Boolean).join(' | ')
    });
    const approvals = await listTaskApprovals(store, taskId);
    const runs = await listTaskRuns(store, taskId);
    return {
      ...rejected,
      task: {
        ...rejected.task,
        runs,
        approvals
      }
    };
  } finally {
    await closePostgresStore(store);
  }
}

export async function replayDeadLetterRun(runId, input = {}) {
  const runtime = await probeRuntimeServices();
  if (runtime.degraded?.mode && runtime.degraded.mode !== 'healthy') {
    throw createDegradedRuntimeError(runtime.degraded, 'replayDeadLetterRun');
  }
  if (runtime.mode !== 'postgres-redis') {
    throw new Error('Dead-letter replay requires PostgreSQL and Redis runtime mode');
  }

  const store = createPostgresStore();
  const queue = await createRedisQueue();
  try {
    await ensureSchema(store);
    const replayed = await replayDeadLetterRunInPostgres(store, runId, input);
    await enqueueRun(queue, replayed.run.id);
    await safeMemoryHook(afterResumeHook, {
      runtime: getRuntimePaths(),
      task: replayed.task,
      reason: 'dead_letter_replayed',
      sourceText: [input.note, input.reason].filter(Boolean).join(' | ')
    });

    if ((process.env.SOFIA_WORKER_INLINE || 'true') === 'true') {
      const processed = await processTaskInlineUntilSettled(store, replayed.task.id);
      if (processed?.task?.id === replayed.task.id) {
        return {
          ...processed,
          replayedRun: replayed.run
        };
      }
    }

    const runs = await listTaskRuns(store, replayed.task.id);
    const approvals = await listTaskApprovals(store, replayed.task.id);
    const trace = await collectRunTrace(store, replayed.run.id);
    return {
      ...replayed,
      replayState: extractReplayState(trace.decisions),
      task: {
        ...replayed.task,
        runs,
        approvals
      },
      queue: {
        name: queue.queueName
      },
      steps: trace.steps,
      decisions: trace.decisions,
      artifacts: trace.artifacts,
      usageEntries: trace.usageEntries,
      storageMode: 'postgres-redis'
    };
  } finally {
    await closeRedisQueue(queue);
    await closePostgresStore(store);
  }
}

export async function getRun(runId) {
  const runtime = await probeRuntimeServices();
  if (runtime.mode !== 'postgres-redis') {
    return getFilesystemRun(runId);
  }

  const store = createPostgresStore();
  try {
    await ensureSchema(store);
    const run = await getRunFromPostgres(store, runId);
    const trace = await collectRunTrace(store, runId);
    return {
      ...run,
      routeExplainability: extractRouteExplainability(run, trace.artifacts),
      skillExplainability: extractSkillExplainability(trace.artifacts, trace.decisions),
      decisionJournal: summarizeDecisionJournal(trace.decisions),
      replayState: extractReplayState(trace.decisions),
      completionQualityGate: trace.decisions.find((entry) => entry?.subject === 'completion_gate')?.evidence || null,
      artifacts: trace.artifacts,
      steps: trace.steps,
      decisions: trace.decisions,
      usageEntries: trace.usageEntries
    };
  } finally {
    await closePostgresStore(store);
  }
}

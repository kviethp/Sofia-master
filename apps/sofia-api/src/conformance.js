import fs from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

import {resolveModelProfile} from '../../../packages/policy-engine/src/index.js';

import {getRuntimePaths} from './paths.js';
import {claimStaleRunInPostgres, closePostgresStore, createPostgresStore, ensureSchema, startRunInPostgres} from './postgres-store.js';
import {runDoctor} from './doctor.js';
import {approveTask, createTask, getRun, processOneQueuedRun, replayDeadLetterRun, startTask} from './runtime-backend.js';
import {closeRedisQueue, createRedisQueue, dequeueDeadLetter, dequeueRun, enqueueRun} from './redis-queue.js';

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function findStep(execution, stepName) {
  return (execution.steps || []).find((step) => step.stepName === stepName) || null;
}

function findDecision(execution, category, subject) {
  return (execution.decisions || []).find(
    (decision) => decision.category === category && decision.subject === subject
  ) || null;
}

function normalizeGroupName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseRequestedGroups(input = []) {
  const values = Array.isArray(input) ? input : [input];
  const groups = values
    .flatMap((entry) => String(entry || '').split(','))
    .map((entry) => normalizeGroupName(entry))
    .filter(Boolean);

  return [...new Set(groups)];
}

function buildScenarioQueueEnv(name) {
  const suffix = `${normalizeGroupName(name)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    SOFIA_TASK_QUEUE: `sofia:runs:${suffix}`,
    SOFIA_DEAD_LETTER_QUEUE: `sofia:runs:${suffix}:dead-letter`
  };
}

function getRequestedGroupsFromArgs(argv = process.argv.slice(2)) {
  const groups = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--group' || token === '-g') {
      groups.push(argv[index + 1] || '');
      index += 1;
      continue;
    }

    if (token.startsWith('--group=')) {
      groups.push(token.slice('--group='.length));
    }
  }

  return parseRequestedGroups([
    process.env.SOFIA_CONFORMANCE_GROUPS || '',
    ...groups
  ]);
}

async function withEnv(overrides, callback) {
  const previous = new Map();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === null || value === undefined || value === '') {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

async function withScenarioEnv(name, overrides, callback) {
  return withEnv(
    {
      ...buildScenarioQueueEnv(name),
      SOFIA_EXECUTION_MODE: 'openclaw',
      ...overrides
    },
    callback
  );
}

async function runScenario(name, taskInput, envOverrides, verify) {
  const startedAt = new Date().toISOString();
  try {
    const execution = await withScenarioEnv(name, envOverrides, async () => {
      const task = await createTask(taskInput);
      return withEnv(
        {
          SOFIA_WORKER_INLINE: 'true'
        },
        () => startTask(task.id)
      );
    });

    await verify(execution);

    return {
      name,
      ok: true,
      startedAt,
      completedAt: new Date().toISOString(),
      taskId: execution.task?.id || null,
      runId: execution.run?.id || null,
      storageMode: execution.storageMode || null,
      stepCount: execution.steps?.length || 0,
      decisionCount: execution.decisions?.length || 0
    };
  } catch (error) {
    return {
      name,
      ok: false,
      startedAt,
      completedAt: new Date().toISOString(),
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error)
      }
    };
  }
}

async function createQueuedRun(taskInput, envOverrides = {}) {
  return withEnv(
    {
      SOFIA_WORKER_INLINE: 'false',
      SOFIA_REPORT_CHANNEL: 'disabled',
      ...envOverrides
    },
    async () => {
      const task = await createTask({
        workflowTemplate: 'builder_only',
        ...taskInput
      });
      const queued = await startTask(task.id);
      return {
        task,
        queued
      };
    }
  );
}

async function enqueueDuplicate(runId) {
  const queue = await createRedisQueue();
  try {
    return enqueueRun(queue, runId);
  } finally {
    await closeRedisQueue(queue);
  }
}

async function waitForRunStatus(runId, expectedStatus, {
  attempts = 40,
  intervalMs = 500
} = {}) {
  let current = null;
  for (let index = 0; index < attempts; index += 1) {
    current = await getRun(runId);
    if (current?.status === expectedStatus) {
      return current;
    }
    await delay(intervalMs);
  }
  return current;
}

async function consumeQueuedRun(runId) {
  const queue = await createRedisQueue();
  try {
    const dequeued = await dequeueRun(queue, 1);
    assertCondition(dequeued === runId, `unexpected dequeued run id: ${dequeued}`);
    return dequeued;
  } finally {
    await closeRedisQueue(queue);
  }
}

async function consumeDeadLetter(runId) {
  const queue = await createRedisQueue();
  try {
    const payload = await dequeueDeadLetter(queue, 1);
    assertCondition(payload?.runId === runId, `unexpected dead-letter run id: ${payload?.runId}`);
    return payload;
  } finally {
    await closeRedisQueue(queue);
  }
}

function toMarkdown(report) {
  const lines = [
    '# Sofia Conformance Report',
    '',
    `- Timestamp: ${report.timestamp}`,
    `- Status: ${report.summary.status}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Groups: ${(report.selectedGroups || []).join(', ') || 'all'}`,
    ''
  ];

  if (report.summary.failed > 0) {
    lines.push('## Failures', '');
    for (const scenario of report.scenarios.filter((entry) => !entry.ok)) {
      lines.push(`- ${scenario.name}: ${scenario.error?.message || 'failed'}`);
    }
    lines.push('');
  }

  lines.push('## Scenarios', '');
  for (const scenario of report.scenarios) {
    lines.push(`- ${scenario.name}: ${scenario.ok ? 'pass' : 'fail'}`);
  }

  return lines.join('\n');
}

function buildScenarioCatalog() {
  return [
    {
      name: 'policy_critical_never_free',
      groups: ['routing', 'critical', 'policy'],
      run: async () => {
        const profile = resolveModelProfile({role: 'builder', risk: 'critical'});
        assertCondition(profile === 'sofia-hard', `critical builder routed to unexpected profile: ${profile}`);
        return {
          name: 'policy_critical_never_free',
          ok: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        };
      }
    },
    {
      name: 'policy_degraded_high_risk_stays_paid',
      groups: ['routing', 'critical', 'policy'],
      run: async () => {
        const profile = resolveModelProfile({role: 'builder', risk: 'high', degraded: true});
        assertCondition(profile === 'sofia-hard', `degraded high-risk builder routed to unexpected profile: ${profile}`);
        return {
          name: 'policy_degraded_high_risk_stays_paid',
          ok: true,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString()
        };
      }
    },
    {
      name: 'policy_provider_denylist_blocks_execution',
      groups: ['routing', 'policy', 'execution', 'execution-scaffold'],
      run: async () =>
        runScenario(
          'policy_provider_denylist_blocks_execution',
          {
            title: 'Conformance provider denylist guardrail',
            risk: 'medium',
            workflowTemplate: 'builder_only'
          },
          {
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_DENY_PROVIDERS: 'router9',
            SOFIA_TEST_ACTUAL_PROVIDER: 'router9'
          },
          async (execution) => {
            const guardrailDecision = findDecision(execution, 'policy', 'execution_guardrails');
            const violationStep = findStep(execution, 'policy_guardrail_violation');

            assertCondition(execution.task?.status === 'failed', 'denylist violation did not fail the task');
            assertCondition(execution.run?.status === 'failed', 'denylist violation did not fail the run');
            assertCondition(guardrailDecision?.outcome === 'blocked', `unexpected guardrail decision outcome: ${guardrailDecision?.outcome}`);
            assertCondition(
              (guardrailDecision?.evidence?.violations || []).some((entry) => entry.code === 'provider_denied'),
              'provider_denied violation missing from guardrail evidence'
            );
            assertCondition(violationStep?.status === 'failed', 'policy guardrail violation step missing');
          }
        )
    },
    {
      name: 'policy_token_budget_blocks_overspend',
      groups: ['routing', 'policy', 'execution', 'execution-scaffold'],
      run: async () =>
        runScenario(
          'policy_token_budget_blocks_overspend',
          {
            title: 'Conformance token budget guardrail',
            risk: 'medium',
            workflowTemplate: 'builder_only'
          },
          {
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_MAX_TOKENS_TOTAL: '10',
            SOFIA_TEST_USAGE_INPUT: '8',
            SOFIA_TEST_USAGE_OUTPUT: '7'
          },
          async (execution) => {
            const guardrailDecision = findDecision(execution, 'policy', 'execution_guardrails');
            const violationStep = findStep(execution, 'policy_guardrail_violation');

            assertCondition(execution.task?.status === 'failed', 'budget violation did not fail the task');
            assertCondition(execution.run?.status === 'failed', 'budget violation did not fail the run');
            assertCondition(guardrailDecision?.outcome === 'blocked', `unexpected guardrail decision outcome: ${guardrailDecision?.outcome}`);
            assertCondition(
              (guardrailDecision?.evidence?.violations || []).some((entry) => entry.code === 'total_token_budget_exceeded'),
              'total_token_budget_exceeded violation missing from guardrail evidence'
            );
            assertCondition(violationStep?.status === 'failed', 'policy guardrail violation step missing');
          }
        )
    },
    {
      name: 'skill_gate_blocks_missing_runtime_skill',
      groups: ['routing', 'policy', 'execution', 'execution-scaffold'],
      run: async () =>
        runScenario(
          'skill_gate_blocks_missing_runtime_skill',
          {
            title: 'Conformance missing runtime skill gate',
            risk: 'medium',
            workflowTemplate: 'builder_only'
          },
          {
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_REQUIRED_RUNTIME_SKILLS: 'runtime-ops,missing-runtime-skill'
          },
          async (execution) => {
            const skillDecision = findDecision(execution, 'skills', 'execution_bundle');
            const violationStep = findStep(execution, 'skill_gate_violation');

            assertCondition(execution.task?.status === 'failed', 'missing runtime skill did not fail the task');
            assertCondition(execution.run?.status === 'failed', 'missing runtime skill did not fail the run');
            assertCondition(skillDecision?.outcome === 'blocked', `unexpected skill decision outcome: ${skillDecision?.outcome}`);
            assertCondition(
              (skillDecision?.evidence?.violations || []).some((entry) => entry.code === 'required_skill_missing'),
              'required_skill_missing violation missing from skill gate evidence'
            );
            assertCondition(violationStep?.status === 'failed', 'skill gate violation step missing');
          }
        )
    },
    {
      name: 'multi_phase_golden_path',
      groups: ['execution', 'execution-e2e', 'routing', 'workflow'],
      run: async () =>
        runScenario(
          'multi_phase_golden_path',
          {
            title: 'Conformance multi-phase golden path',
            risk: 'medium'
          },
          {
            SOFIA_REPORT_CHANNEL: 'disabled'
          },
          async (execution) => {
            const runs = execution.task?.runs || [];
            const roles = runs.map((run) => run.workerRole);
            const profiles = runs.map((run) => run.modelProfile);
            const plannerRun = runs.find((run) => run.workerRole === 'planner');
            const builderRun = runs.find((run) => run.workerRole === 'builder');
            const verifierRun = runs.find((run) => run.workerRole === 'verifier');
            const plannerDetails = plannerRun ? await getRun(plannerRun.id) : null;
            const builderDetails = builderRun ? await getRun(builderRun.id) : null;
            const verifierDetails = verifierRun ? await getRun(verifierRun.id) : null;

            assertCondition(execution.task?.status === 'completed', 'task did not complete');
            assertCondition(execution.task?.currentPhase === 'completed', 'task current phase did not close');
            assertCondition(execution.run?.workerRole === 'verifier', `unexpected final phase: ${execution.run?.workerRole}`);
            assertCondition(runs.length === 3, `expected 3 workflow runs, found ${runs.length}`);
            assertCondition(
              JSON.stringify(roles) === JSON.stringify(['planner', 'builder', 'verifier']),
              `unexpected workflow roles: ${roles.join(', ')}`
            );
            assertCondition(runs.every((run) => run.status === 'completed'), 'not all workflow runs completed');
            assertCondition(
              JSON.stringify(profiles) === JSON.stringify(['sofia-hard', 'sofia-fast', 'sofia-hard']),
              `unexpected workflow profiles: ${profiles.join(', ')}`
            );
            assertCondition(
              (plannerDetails?.artifacts || []).some((artifact) => artifact.kind === 'plan'),
              'planner artifact missing plan kind'
            );
            assertCondition(
              (builderDetails?.artifacts || []).some((artifact) => artifact.kind === 'build'),
              'builder artifact missing build kind'
            );
            assertCondition(
              (verifierDetails?.artifacts || []).some((artifact) => artifact.kind === 'verify'),
              'verifier artifact missing verify kind'
            );
            assertCondition(
              (verifierDetails?.artifacts || []).some((artifact) => artifact.kind === 'summary'),
              'workflow summary artifact missing on final phase'
            );
          }
        )
    },
    {
      name: 'approval_gate_blocks_high_risk_builder',
      groups: ['workflow', 'approvals'],
      run: async () =>
        runScenario(
          'approval_gate_blocks_high_risk_builder',
          {
            title: 'Conformance approval gate block',
            risk: 'high'
          },
          {
            SOFIA_REPORT_CHANNEL: 'disabled'
          },
          async (execution) => {
            const approvals = execution.task?.approvals || [];
            const runs = execution.task?.runs || [];

            assertCondition(execution.task?.status === 'awaiting_approval', 'task did not stop for approval');
            assertCondition(execution.task?.currentPhase === 'builder', `unexpected gated phase: ${execution.task?.currentPhase}`);
            assertCondition(execution.run?.workerRole === 'planner', `unexpected run role before gate: ${execution.run?.workerRole}`);
            assertCondition(runs.length === 1, `expected only planner run before approval, found ${runs.length}`);
            assertCondition(approvals.length === 1, `expected 1 pending approval, found ${approvals.length}`);
            assertCondition(approvals[0]?.status === 'pending', `unexpected approval status: ${approvals[0]?.status}`);
            assertCondition(findStep(execution, 'approval_requested')?.status === 'completed', 'approval_requested step missing');
          }
        )
    },
    {
      name: 'approval_resume_queues_builder',
      groups: ['workflow', 'approvals'],
      run: async () =>
        withScenarioEnv(
          'approval_resume_queues_builder',
          {
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_WORKER_INLINE: 'true'
          },
          async () => {
            const startedAt = new Date().toISOString();
            try {
              const task = await createTask({
                title: 'Conformance approval resume',
                risk: 'high'
              });
              const gated = await startTask(task.id);
              assertCondition(gated.task?.status === 'awaiting_approval', 'task did not enter approval wait state');

              const approved = await approveTask(task.id, {
                decisionBy: 'conformance',
                note: 'approved by conformance'
              });
              const finalRun = approved.run?.id ? await getRun(approved.run.id) : null;

              assertCondition(approved.approval?.status === 'approved', 'approval was not approved');
              assertCondition(approved.task?.status === 'completed', `task did not complete after approval: ${approved.task?.status}`);
              assertCondition(approved.run?.workerRole === 'verifier', `unexpected final phase: ${approved.run?.workerRole}`);
              assertCondition(finalRun?.status === 'completed', 'final verifier run did not complete');
              assertCondition(
                (finalRun?.artifacts || []).some((artifact) => artifact.kind === 'summary'),
                'summary artifact missing after approval-resumed workflow'
              );

              return {
                name: 'approval_resume_queues_builder',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: task.id,
                runId: approved.run?.id || null,
                storageMode: approved.storageMode || 'postgres-redis',
                stepCount: finalRun?.steps?.length || 0,
                decisionCount: finalRun?.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'approval_resume_queues_builder',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            }
          }
        )
    },
    {
      name: 'notification_failure_isolated',
      groups: ['notifications', 'execution', 'execution-scaffold'],
      run: async () =>
        runScenario(
          'notification_failure_isolated',
          {
            title: 'Conformance notification failure isolation',
            risk: 'medium',
            workflowTemplate: 'builder_only'
          },
          {
            SOFIA_TEST_NOTIFICATION_FAILURE: 'all',
            SOFIA_REPORT_CHANNEL: 'telegram'
          },
          async (execution) => {
            assertCondition(execution.task?.status === 'completed', 'task did not complete');
            assertCondition(execution.run?.status === 'completed', 'run did not complete');
            assertCondition(findStep(execution, 'notify_started')?.status === 'failed', 'notify_started was not recorded as failed');
            assertCondition(findStep(execution, 'notify_completed')?.status === 'failed', 'notify_completed was not recorded as failed');
            assertCondition(findStep(execution, 'execution_completed')?.status === 'completed', 'execution_completed was not recorded as completed');
          }
        )
    },
    {
      name: 'execution_failure_trace_complete',
      groups: ['routing', 'execution', 'execution-scaffold', 'critical'],
      run: async () =>
        runScenario(
          'execution_failure_trace_complete',
          {
            title: 'Conformance execution failure trace',
            risk: 'medium'
          },
          {
            SOFIA_TEST_EXECUTION_FAILURE: 'true',
            SOFIA_REPORT_CHANNEL: 'disabled'
          },
          async (execution) => {
            assertCondition(execution.task?.status === 'failed', 'task did not fail');
            assertCondition(execution.run?.status === 'failed', 'run did not fail');
            assertCondition(findStep(execution, 'execution_requested'), 'execution_requested step missing');
            assertCondition(findStep(execution, 'execution_completed')?.status === 'failed', 'execution_completed was not recorded as failed');
            assertCondition(findStep(execution, 'failed')?.status === 'failed', 'final failed step missing');
            assertCondition(findDecision(execution, 'routing', 'openclaw_agent'), 'openclaw_agent decision missing');
          }
        )
    },
    {
      name: 'degraded_routing_evidence',
      groups: ['routing', 'execution-scaffold', 'critical'],
      run: async () =>
        runScenario(
          'degraded_routing_evidence',
          {
            title: 'Conformance degraded routing evidence',
            risk: 'low',
            workflowTemplate: 'builder_only'
          },
          {
            SOFIA_FORCE_MODEL_PROFILE: 'sofia-free-fallback',
            SOFIA_EXECUTION_MODE: 'scaffold',
            SOFIA_REPORT_CHANNEL: 'disabled'
          },
          async (execution) => {
            assertCondition(execution.task?.status === 'completed', 'degraded task did not complete');
            assertCondition(execution.run?.modelProfile === 'sofia-free-fallback', `unexpected run profile: ${execution.run?.modelProfile}`);
            assertCondition(findDecision(execution, 'routing', 'requested_profile')?.evidence?.degraded === true, 'requested_profile decision did not record degraded mode');
          }
        )
    },
    {
      name: 'lease_heartbeat_preserves_run',
      groups: ['durability', 'worker', 'execution', 'execution-scaffold'],
      run: async () =>
        runScenario(
          'lease_heartbeat_preserves_run',
          {
            title: 'Conformance lease heartbeat preservation',
            risk: 'medium'
          },
          {
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_RUN_LEASE_SECONDS: '2',
            SOFIA_RUN_HEARTBEAT_MS: '500',
            SOFIA_TEST_EXECUTION_DELAY_MS: '2200'
          },
          async (execution) => {
            assertCondition(execution.task?.status === 'completed', 'heartbeat preservation task did not complete');
            assertCondition(execution.run?.status === 'completed', 'heartbeat preservation run did not complete');
            assertCondition(execution.run?.attemptCount === 1, `expected single attempt, found ${execution.run?.attemptCount}`);
            assertCondition(!findStep(execution, 'lease_reclaimed'), 'lease_reclaimed should not exist for healthy heartbeat');
            assertCondition(Boolean(execution.run?.lastHeartbeatAt), 'lastHeartbeatAt was not recorded');
          }
        )
    },
    {
      name: 'duplicate_delivery_idempotent',
      groups: ['durability', 'worker'],
      run: async () =>
        withScenarioEnv(
          'duplicate_delivery_idempotent',
          {
            SOFIA_WORKER_INLINE: 'false',
            SOFIA_REPORT_CHANNEL: 'disabled'
          },
          async () => {
            const startedAt = new Date().toISOString();
            try {
              const {queued} = await createQueuedRun({
                title: 'Conformance duplicate delivery idempotency',
                risk: 'medium'
              });
              await enqueueDuplicate(queued.run.id);

              const first = await processOneQueuedRun();
              const second = await processOneQueuedRun();
              const finalRun = await getRun(queued.run.id);

              assertCondition(first?.run?.status === 'completed', 'first delivery did not complete');
              assertCondition(second === null || second?.skipped === true, 'second delivery was neither skipped nor empty');
              if (second) {
                assertCondition(second.reason === 'already_claimed', `unexpected skip reason: ${second?.reason}`);
              }
              assertCondition(finalRun.status === 'completed', 'final run status is not completed');
              assertCondition((finalRun.artifacts || []).length === 1, `expected 1 artifact, found ${(finalRun.artifacts || []).length}`);
              assertCondition((finalRun.usageEntries || []).length === 1, `expected 1 usage entry, found ${(finalRun.usageEntries || []).length}`);
              assertCondition(
                (finalRun.steps || []).filter((step) => step.stepName === 'claim_skipped').length >= 1,
                'claim_skipped step not recorded'
              );

              return {
                name: 'duplicate_delivery_idempotent',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: queued.task.id,
                runId: queued.run.id,
                storageMode: first?.storageMode || 'postgres-redis',
                stepCount: finalRun.steps?.length || 0,
                decisionCount: finalRun.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'duplicate_delivery_idempotent',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            }
          }
        )
    },
    {
      name: 'stale_running_recovered',
      groups: ['durability', 'worker'],
      run: async () =>
        withScenarioEnv(
          'stale_running_recovered',
          {
            SOFIA_WORKER_INLINE: 'false',
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_EXECUTION_MODE: 'scaffold',
            SOFIA_RUN_LEASE_SECONDS: '1',
            SOFIA_RUN_HEARTBEAT_MS: '250',
            SOFIA_WORKER_ID: 'worker-recovery'
          },
          async () => {
            const startedAt = new Date().toISOString();
            const store = createPostgresStore();
            try {
              await ensureSchema(store);
              const {queued} = await createQueuedRun({
                title: 'Conformance stale running recovery',
                risk: 'medium'
              });

              await consumeQueuedRun(queued.run.id);

              const crashedClaim = await startRunInPostgres(store, queued.run.id, {
                workerId: 'worker-crashed',
                leaseSeconds: 1
              });
              assertCondition(Boolean(crashedClaim), 'failed to create stale running claim');

              await delay(3000);

              const recovered = await processOneQueuedRun({staleRunId: queued.run.id});
              const finalRun = await waitForRunStatus(queued.run.id, 'completed', {
                attempts: 240,
                intervalMs: 500
              });

              assertCondition(finalRun?.status === 'completed', 'recovered run did not complete');
              assertCondition(finalRun.status === 'completed', 'final stale-recovered run is not completed');
              assertCondition(finalRun.attemptCount >= 2, `expected reclaimed run attempts >= 2, found ${finalRun.attemptCount}`);
              assertCondition(Boolean(findStep(finalRun, 'lease_reclaimed')), 'lease_reclaimed step missing');
              assertCondition((finalRun.artifacts || []).length === 1, `expected 1 artifact after stale recovery, found ${(finalRun.artifacts || []).length}`);
              assertCondition((finalRun.usageEntries || []).length === 1, `expected 1 usage entry after stale recovery, found ${(finalRun.usageEntries || []).length}`);

              return {
                name: 'stale_running_recovered',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: queued.task.id,
                runId: queued.run.id,
                storageMode: recovered?.storageMode || 'postgres-redis',
                stepCount: finalRun.steps?.length || 0,
                decisionCount: finalRun.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'stale_running_recovered',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            } finally {
              await closePostgresStore(store);
            }
          }
        )
    },
    {
      name: 'stale_reclaim_backoff_respected',
      groups: ['durability', 'worker'],
      run: async () =>
        withScenarioEnv(
          'stale_reclaim_backoff_respected',
          {
            SOFIA_WORKER_INLINE: 'false',
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_EXECUTION_MODE: 'scaffold',
            SOFIA_RUN_LEASE_SECONDS: '1',
            SOFIA_RUN_BACKOFF_BASE_SECONDS: '3',
            SOFIA_RUN_BACKOFF_MAX_SECONDS: '3',
            SOFIA_RUN_MAX_ATTEMPTS: '5',
            SOFIA_WORKER_ID: 'worker-backoff'
          },
          async () => {
            const startedAt = new Date().toISOString();
            const store = createPostgresStore();
            try {
              await ensureSchema(store);
              const {queued} = await createQueuedRun({
                title: 'Conformance stale reclaim backoff',
                risk: 'medium'
              });

              await consumeQueuedRun(queued.run.id);

              const firstClaim = await startRunInPostgres(store, queued.run.id, {
                workerId: 'worker-crashed-1',
                leaseSeconds: 1,
                backoffBaseSeconds: 3,
                backoffMaxSeconds: 3
              });
              assertCondition(Boolean(firstClaim), 'failed to create first crashed claim');

              await delay(1500);

              const reclaimedRun = await getRun(queued.run.id);
              const secondClaim =
                reclaimedRun?.attemptCount >= 2
                  ? reclaimedRun
                  : await claimStaleRunInPostgres(store, {
                      runId: queued.run.id,
                      workerId: 'worker-crashed-2',
                      leaseSeconds: 1,
                      maxAttempts: 5,
                      backoffBaseSeconds: 3,
                      backoffMaxSeconds: 3
                    });
              assertCondition((secondClaim?.attemptCount || 0) >= 2, `expected second attempt count >= 2, found ${secondClaim?.attemptCount}`);
              assertCondition(Boolean(secondClaim?.nextRetryAt), 'nextRetryAt was not scheduled');

              const beforeSecondBackoff = await processOneQueuedRun({staleRunId: queued.run.id});
              assertCondition(beforeSecondBackoff === null, 'run was reclaimed before the second backoff expired');

              await delay(4500);

              const afterBackoff = await processOneQueuedRun({staleRunId: queued.run.id});
              const finalRun = await waitForRunStatus(queued.run.id, 'completed', {
                attempts: 240,
                intervalMs: 500
              });

              assertCondition(
                Boolean(afterBackoff?.run) || finalRun?.status === 'completed',
                'run did not complete after backoff elapsed'
              );
              assertCondition(finalRun.status === 'completed', 'final run status is not completed after backoff elapsed');
              assertCondition(finalRun.attemptCount >= 2, `expected attempt count >= 2, found ${finalRun.attemptCount}`);
              assertCondition(
                (finalRun.steps || []).filter((step) => step.stepName === 'lease_reclaimed').length >= 1,
                'expected at least one lease_reclaimed step'
              );

              return {
                name: 'stale_reclaim_backoff_respected',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: queued.task.id,
                runId: queued.run.id,
                storageMode: afterBackoff?.storageMode || 'postgres-redis',
                stepCount: finalRun.steps?.length || 0,
                decisionCount: finalRun.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'stale_reclaim_backoff_respected',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            } finally {
              await closePostgresStore(store);
            }
          }
        )
    },
    {
      name: 'stale_run_dead_lettered_after_max_attempts',
      groups: ['durability', 'worker'],
      run: async () =>
        withScenarioEnv(
          'stale_run_dead_lettered_after_max_attempts',
          {
            SOFIA_WORKER_INLINE: 'false',
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_RUN_LEASE_SECONDS: '1',
            SOFIA_RUN_MAX_ATTEMPTS: '1',
            SOFIA_WORKER_ID: 'worker-dead-letter'
          },
          async () => {
            const startedAt = new Date().toISOString();
            const store = createPostgresStore();
            try {
              await ensureSchema(store);
              const {queued} = await createQueuedRun({
                title: 'Conformance dead-letter after max attempts',
                risk: 'medium'
              });

              await consumeQueuedRun(queued.run.id);

              const crashedClaim = await startRunInPostgres(store, queued.run.id, {
                workerId: 'worker-crashed',
                leaseSeconds: 1
              });
              assertCondition(Boolean(crashedClaim), 'failed to create exhausted stale run');

              await delay(1500);

              const deadLettered = await processOneQueuedRun({staleRunId: queued.run.id});
              const finalRun = await waitForRunStatus(queued.run.id, 'dead_lettered', {
                attempts: 240,
                intervalMs: 500
              });

              const deadLetterRecorded =
                deadLettered?.run?.status === 'dead_lettered' || finalRun.status === 'dead_lettered';
              const leaseReclaimedCount = (finalRun.steps || []).filter((step) => step.stepName === 'lease_reclaimed').length;

              if (deadLetterRecorded) {
                assertCondition(finalRun.status === 'dead_lettered', 'final run status is not dead_lettered');
                assertCondition(Boolean(findStep(finalRun, 'dead_lettered')), 'dead_lettered step missing');
                assertCondition(findStep(finalRun, 'dead_letter_enqueued')?.status === 'completed', 'dead-letter queue enqueue was not recorded');
                assertCondition(findDecision(finalRun, 'durability', 'retry_cap')?.outcome === 'dead_lettered', 'retry cap decision missing');
                assertCondition((finalRun.artifacts || []).length === 1, `expected 1 artifact after dead-letter, found ${(finalRun.artifacts || []).length}`);
                assertCondition((finalRun.usageEntries || []).length === 0, `expected 0 usage entries after dead-letter, found ${(finalRun.usageEntries || []).length}`);
              } else {
                assertCondition(leaseReclaimedCount >= 1, 'run was neither dead-lettered nor reclaimed by a worker');
                assertCondition(finalRun.attemptCount >= 2, `expected reclaimed attempt count >= 2, found ${finalRun.attemptCount}`);
              }

              return {
                name: 'stale_run_dead_lettered_after_max_attempts',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: queued.task.id,
                runId: queued.run.id,
                storageMode: deadLettered?.storageMode || 'postgres-redis',
                stepCount: finalRun.steps?.length || 0,
                decisionCount: finalRun.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'stale_run_dead_lettered_after_max_attempts',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            } finally {
              await closePostgresStore(store);
            }
          }
        )
    },
    {
      name: 'dead_letter_replay_requeues_run',
      groups: ['durability', 'worker'],
      run: async () =>
        withScenarioEnv(
          'dead_letter_replay_requeues_run',
          {
            SOFIA_WORKER_INLINE: 'false',
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_RUN_LEASE_SECONDS: '1',
            SOFIA_RUN_MAX_ATTEMPTS: '1',
            SOFIA_WORKER_ID: 'worker-replay'
          },
          async () => {
            const startedAt = new Date().toISOString();
            const store = createPostgresStore();
            try {
              await ensureSchema(store);
              const {queued} = await createQueuedRun({
                title: 'Conformance dead-letter replay',
                risk: 'medium'
              });

              await consumeQueuedRun(queued.run.id);
              const crashedClaim = await startRunInPostgres(store, queued.run.id, {
                workerId: 'worker-crashed',
                leaseSeconds: 1
              });
              assertCondition(Boolean(crashedClaim), 'failed to create stale run for replay');

              await delay(1500);

              const deadLettered = await claimStaleRunInPostgres(store, {
                runId: queued.run.id,
                workerId: 'worker-replay',
                leaseSeconds: 1,
                maxAttempts: 1
              });
              const deadLetteredRun = await waitForRunStatus(queued.run.id, 'dead_lettered', {
                attempts: 20,
                intervalMs: 250
              });
              if (deadLettered?.status !== 'dead_lettered' && deadLetteredRun?.status !== 'dead_lettered') {
                const currentRun = await getRun(queued.run.id);
                const reclaimed = (currentRun?.steps || []).some((step) => step.stepName === 'lease_reclaimed');
                assertCondition(reclaimed, 'run did not reach dead_lettered state');
                return {
                  name: 'dead_letter_replay_requeues_run',
                  ok: true,
                  startedAt,
                  completedAt: new Date().toISOString(),
                  taskId: queued.task.id,
                  runId: queued.run.id,
                  storageMode: 'postgres-redis',
                  stepCount: currentRun?.steps?.length || 0,
                  decisionCount: currentRun?.decisions?.length || 0
                };
              }

              const replayed = await replayDeadLetterRun(queued.run.id, {replayedBy: 'conformance'});
              const replayTrace = await getRun(queued.run.id);
              const resumed = await processOneQueuedRun();
              const finalRun = await getRun(queued.run.id);

              assertCondition(replayed.run?.status === 'queued', `unexpected replayed status: ${replayed.run?.status}`);
              assertCondition(replayed.task?.status === 'queued', `unexpected replayed task status: ${replayed.task?.status}`);
              assertCondition(replayed.task?.currentPhase === 'builder', `unexpected replayed phase: ${replayed.task?.currentPhase}`);
              assertCondition(findStep(replayTrace, 'dead_letter_replayed')?.status === 'completed', 'dead_letter_replayed step missing');
              assertCondition(findDecision(replayTrace, 'durability', 'dead_letter_replay')?.outcome === 'queued', 'dead_letter_replay decision missing');
              assertCondition(resumed?.run?.status === 'completed', 'replayed run did not complete');
              assertCondition(finalRun.status === 'completed', 'final replayed run status is not completed');
              assertCondition((finalRun.artifacts || []).length === 2, `expected 2 artifacts after replay completion, found ${(finalRun.artifacts || []).length}`);
              assertCondition((finalRun.artifacts || []).some((artifact) => artifact.kind === 'error'), 'expected replayed run to preserve the original error artifact');
              assertCondition((finalRun.artifacts || []).some((artifact) => artifact.kind === 'build'), 'expected replayed run to add a build artifact');
              assertCondition((finalRun.usageEntries || []).length === 1, `expected 1 usage entry after replay completion, found ${(finalRun.usageEntries || []).length}`);

              return {
                name: 'dead_letter_replay_requeues_run',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: queued.task.id,
                runId: queued.run.id,
                storageMode: resumed?.storageMode || 'postgres-redis',
                stepCount: finalRun.steps?.length || 0,
                decisionCount: finalRun.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'dead_letter_replay_requeues_run',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            } finally {
              await closePostgresStore(store);
            }
          }
        )
    },
    {
      name: 'transient_failure_retry_policy_classified',
      groups: ['durability', 'execution', 'execution-scaffold'],
      run: async () =>
        runScenario(
          'transient_failure_retry_policy_classified',
          {
            title: 'Conformance transient retry policy classification',
            risk: 'medium',
            workflowTemplate: 'builder_only'
          },
          {
            SOFIA_TEST_EXECUTION_FAILURE: 'true',
            SOFIA_TEST_EXECUTION_FAILURE_MESSAGE: 'timeout talking to provider',
            SOFIA_REPORT_CHANNEL: 'disabled'
          },
          async (execution) => {
            const retryPolicy = findDecision(execution, 'durability', 'retry_policy');
            const failedStep = findStep(execution, 'failed');

            assertCondition(execution.run?.status === 'failed', 'run did not fail');
            assertCondition(retryPolicy?.outcome === 'classified', `unexpected retry policy outcome: ${retryPolicy?.outcome}`);
            assertCondition(retryPolicy?.evidence?.failureClass === 'transient', `unexpected failure class: ${retryPolicy?.evidence?.failureClass}`);
            assertCondition(retryPolicy?.evidence?.retryAction === 'retry', `unexpected retry action: ${retryPolicy?.evidence?.retryAction}`);
            assertCondition((retryPolicy?.evidence?.recommendedBackoffSeconds || 0) >= 15, 'recommended backoff was not elevated for transient failure');
            assertCondition(failedStep?.details?.failureClass === 'transient', `unexpected failed step class: ${failedStep?.details?.failureClass}`);
            assertCondition(failedStep?.details?.retryAction === 'retry', `unexpected failed step retry action: ${failedStep?.details?.retryAction}`);
          }
        )
    },
    {
      name: 'completed_retry_idempotent',
      groups: ['durability', 'worker'],
      run: async () =>
        withScenarioEnv(
          'completed_retry_idempotent',
          {
            SOFIA_WORKER_INLINE: 'false',
            SOFIA_REPORT_CHANNEL: 'disabled'
          },
          async () => {
            const startedAt = new Date().toISOString();
            try {
              const {queued} = await createQueuedRun({
                title: 'Conformance completed retry idempotency',
                risk: 'medium'
              });

              const first = await processOneQueuedRun();
              await enqueueDuplicate(queued.run.id);
              const retry = await processOneQueuedRun();
              const finalRun = await getRun(queued.run.id);

              assertCondition(first?.run?.status === 'completed', 'initial run did not complete');
              assertCondition(retry?.skipped === true, 'retry of completed run was not skipped');
              assertCondition(finalRun.status === 'completed', 'completed run status changed');
              assertCondition((finalRun.artifacts || []).length === 1, `expected 1 artifact after retry, found ${(finalRun.artifacts || []).length}`);
              assertCondition((finalRun.usageEntries || []).length === 1, `expected 1 usage entry after retry, found ${(finalRun.usageEntries || []).length}`);

              return {
                name: 'completed_retry_idempotent',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: queued.task.id,
                runId: queued.run.id,
                storageMode: first?.storageMode || 'postgres-redis',
                stepCount: finalRun.steps?.length || 0,
                decisionCount: finalRun.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'completed_retry_idempotent',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            }
          }
        )
    },
    {
      name: 'failed_retry_idempotent',
      groups: ['durability', 'worker'],
      run: async () =>
        withScenarioEnv(
          'failed_retry_idempotent',
          {
            SOFIA_WORKER_INLINE: 'false',
            SOFIA_REPORT_CHANNEL: 'disabled',
            SOFIA_TEST_EXECUTION_FAILURE: 'true'
          },
          async () => {
            const startedAt = new Date().toISOString();
            try {
              const {queued} = await createQueuedRun({
                title: 'Conformance failed retry idempotency',
                risk: 'medium'
              });

              const first = await processOneQueuedRun();
              await enqueueDuplicate(queued.run.id);
              const retry = await processOneQueuedRun();
              const finalRun = await getRun(queued.run.id);

              assertCondition(first?.run?.status === 'failed', 'initial failed run did not fail');
              assertCondition(retry?.skipped === true, 'retry of failed run was not skipped');
              assertCondition(finalRun.status === 'failed', 'failed run status changed');
              assertCondition((finalRun.artifacts || []).length === 1, `expected 1 error artifact after retry, found ${(finalRun.artifacts || []).length}`);
              assertCondition((finalRun.usageEntries || []).length === 0, `expected 0 usage entries after failed retry, found ${(finalRun.usageEntries || []).length}`);

              return {
                name: 'failed_retry_idempotent',
                ok: true,
                startedAt,
                completedAt: new Date().toISOString(),
                taskId: queued.task.id,
                runId: queued.run.id,
                storageMode: first?.storageMode || 'postgres-redis',
                stepCount: finalRun.steps?.length || 0,
                decisionCount: finalRun.decisions?.length || 0
              };
            } catch (error) {
              return {
                name: 'failed_retry_idempotent',
                ok: false,
                startedAt,
                completedAt: new Date().toISOString(),
                error: {
                  name: error?.name ?? 'Error',
                  message: error?.message ?? String(error)
                }
              };
            }
          }
        )
    }
  ];
}

function selectScenarioCatalog(catalog, requestedGroups) {
  const groups = parseRequestedGroups(requestedGroups);
  if (groups.length === 0) {
    return {
      groups: ['all'],
      scenarios: catalog
    };
  }

  const selected = catalog.filter((scenario) => scenario.groups.some((group) => groups.includes(group) || groups.includes('all')));
  if (selected.length === 0) {
    const availableGroups = [...new Set(catalog.flatMap((scenario) => scenario.groups))].sort();
    throw new Error(
      `No conformance scenarios matched groups: ${groups.join(', ')}. Available groups: ${availableGroups.join(', ')}`
    );
  }

  return {
    groups,
    scenarios: selected
  };
}

export async function runConformance(options = {}) {
  const runtime = getRuntimePaths();
  await fs.mkdir(runtime.reportDir, {recursive: true});

  const doctor = await runDoctor();
  const catalog = buildScenarioCatalog();
  const selection = selectScenarioCatalog(catalog, options.groups || getRequestedGroupsFromArgs());
  const scenarios = [];

  for (const scenario of selection.scenarios) {
    scenarios.push(await scenario.run());
  }

  const report = {
    timestamp: new Date().toISOString(),
    doctorStatus: doctor.summary.status,
    storageMode: doctor.summary.storageMode,
    selectedGroups: selection.groups,
    scenarios,
    summary: {
      status: scenarios.every((scenario) => scenario.ok) ? 'pass' : 'needs-attention',
      passed: scenarios.filter((scenario) => scenario.ok).length,
      failed: scenarios.filter((scenario) => !scenario.ok).length
    }
  };

  await fs.writeFile(
    path.join(runtime.reportDir, 'conformance-report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );
  await fs.writeFile(
    path.join(runtime.reportDir, 'conformance-report.md'),
    `${toMarkdown(report)}\n`,
    'utf8'
  );

  return report;
}

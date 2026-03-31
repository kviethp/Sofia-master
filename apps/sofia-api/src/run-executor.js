import fs from 'node:fs/promises';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

import {
  ensureOpenClawAgent,
  executeAgentTurn,
  getDefaultTelegramTarget,
  sendTelegramMessage,
  validateOpenClawConfig
} from '../../../packages/openclaw-adapter/src/index.js';
import {resolveCompiledSkillRegistry} from '../../../packages/skill-compiler/src/index.js';
import {evaluateExecutionGuardrails, evaluateSkillGate, resolveRequiredSkillIds} from '../../../packages/policy-engine/src/index.js';

const OPENCLAW_AGENT_PROFILES = {
  'sofia-hard': {
    agentId: 'sofia-hard',
    modelId: 'router9/sofia-hard'
  },
  'sofia-fast': {
    agentId: 'sofia-fast',
    modelId: 'router9/sofia-fast'
  },
  'sofia-free-fallback': {
    agentId: 'sofia-free-fallback',
    modelId: 'router9/sofia-free-fallback'
  }
};

const PHASE_ARTIFACTS = {
  planner: {
    kind: 'plan',
    filename: 'plan-artifact.json'
  },
  builder: {
    kind: 'build',
    filename: 'build-artifact.json'
  },
  verifier: {
    kind: 'verify',
    filename: 'verify-artifact.json'
  }
};

function createTaskPrompt(task, run) {
  const workerRole = run?.workerRole || 'builder';
  const phaseInstructions = {
    planner: 'Produce a short implementation plan and explicit constraints for the next worker.',
    builder: 'Produce a short execution summary focused on what would be built or changed.',
    verifier: 'Produce a short verification summary focused on checks, risks, and exit criteria.'
  };
  return [
    'You are executing a Sofia Master control-plane probe for a queued task.',
    `Task title: ${task.title}`,
    `Risk: ${task.risk}`,
    `Workflow phase: ${workerRole}`,
    'This probe must not create, edit, move, or delete files.',
    'Do not run commands, call tools, or access the network.',
    phaseInstructions[workerRole] || 'Produce a short operational summary for this workflow phase.',
    'Respond with a short execution summary in plain text only.',
    'Keep the answer concise and operational.',
    'Do not mention hidden chain-of-thought.'
  ].join('\n');
}

function buildReportText({task, run, status, details}) {
  const lines = [
    `Sofia run ${status}`,
    `Task: ${task.title}`,
    `Risk: ${task.risk}`,
    `Run: ${run.id}`,
    `Phase: ${run.workerRole || 'builder'}`
  ];

  if (run.modelProfile) {
    lines.push(`Requested model profile: ${run.modelProfile}`);
  }

  if (details?.actualModel) {
    lines.push(`Actual model: ${details.actualModel}`);
  }

  if (details?.replyText) {
    lines.push('', details.replyText.slice(0, 1200));
  }

  if (details?.error) {
    lines.push('', `Error: ${details.error}`);
  }

  return lines.join('\n');
}

function resolveOpenClawAgentProfile(modelProfile) {
  return OPENCLAW_AGENT_PROFILES[modelProfile] || OPENCLAW_AGENT_PROFILES['sofia-hard'];
}

function resolvePhaseArtifact(workerRole) {
  return PHASE_ARTIFACTS[workerRole] || {
    kind: 'report',
    filename: 'openclaw-execution.json'
  };
}

function shouldSimulateNotificationFailure(eventName) {
  const mode = String(process.env.SOFIA_TEST_NOTIFICATION_FAILURE || '').trim().toLowerCase();
  return mode === 'all' || mode === eventName;
}

function shouldSimulateExecutionFailure() {
  return String(process.env.SOFIA_TEST_EXECUTION_FAILURE || '').trim().toLowerCase() === 'true';
}

function getSimulatedExecutionFailureMessage() {
  return String(process.env.SOFIA_TEST_EXECUTION_FAILURE_MESSAGE || 'Simulated OpenClaw execution failure').trim();
}

function getExecutionDelayMs() {
  const value = Number(process.env.SOFIA_TEST_EXECUTION_DELAY_MS || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getOverrideNumber(name, fallbackValue) {
  if (process.env[name] === undefined || process.env[name] === null || process.env[name] === '') {
    return fallbackValue;
  }

  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? parsed : fallbackValue;
}

async function sendTelegramReport({eventName, enabled, target, message, cwd}) {
  if (!enabled) {
    return {ok: true, skipped: true};
  }

  if (shouldSimulateNotificationFailure(eventName)) {
    return {
      ok: false,
      skipped: false,
      delivered: false,
      error: {
        name: 'SimulatedNotificationFailure',
        message: `Simulated Telegram failure for ${eventName}`
      }
    };
  }

  try {
    const result = await sendTelegramMessage({
      target,
      message,
      cwd
    });
    return {
      ok: result.ok,
      skipped: false,
      delivered: result.delivered,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode
    };
  } catch (error) {
    return {
      ok: false,
      skipped: false,
      delivered: false,
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error)
      }
    };
  }
}

function normalizeNotificationEvent(name, report) {
  return {
    name,
    ok: Boolean(report?.ok),
    skipped: Boolean(report?.skipped),
    delivered: Boolean(report?.delivered),
    exitCode: report?.exitCode ?? null,
    stderr: report?.stderr || null,
    error: report?.error?.message || null
  };
}

export async function runTaskWithOpenClaw({
  task,
  run,
  runtime
}) {
  const sessionId = `sofia-${run.id}`;
  const prompt = createTaskPrompt(task, run);
  const startedAt = new Date().toISOString();
  const config = validateOpenClawConfig(runtime.openClawConfigPath);
  const requestedProfile = run.modelProfile || 'sofia-hard';
  const selectedProfile = resolveOpenClawAgentProfile(requestedProfile);
  const telegramTarget = process.env.SOFIA_REPORT_TARGET || getDefaultTelegramTarget(config);
  const reportsEnabled = (process.env.SOFIA_REPORT_CHANNEL || 'telegram') === 'telegram' && Boolean(telegramTarget);
  const notificationEvents = [];
  const skillRegistry = await resolveCompiledSkillRegistry({
    rootDir: runtime.rootDir,
    sourceDir: runtime.skillSourceDir,
    outputDir: runtime.skillOutputDir,
    manifestPath: runtime.skillManifestPath,
    autoCompile: runtime.skillAutoCompile
  });
  const requiredSkillIds = resolveRequiredSkillIds({
    workerRole: run.workerRole,
    executionMode: 'openclaw',
    storageMode: 'postgres-redis'
  });
  const skillGate = evaluateSkillGate({
    requiredSkillIds,
    skillRegistry
  });

  if (!config.ok) {
    return {
      ok: false,
      result: {
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: `OpenClaw config invalid: ${config.errors.map((entry) => entry.message).join('; ') || 'unknown error'}`
      },
      artifact: null,
      usage: null,
      actualModel: null,
      actualProvider: null,
      trace: {
        sessionId,
        requestedProfile,
        selectedAgentId: selectedProfile.agentId,
        selectedModelId: selectedProfile.modelId,
        skills: skillGate,
        skillRegistry: {
          status: skillRegistry.status,
          manifestPath: skillRegistry.manifestPath,
          skillCount: skillRegistry.skillCount,
          autoCompiled: skillRegistry.autoCompiled,
          errors: skillRegistry.errors || []
        },
        notifications: notificationEvents
      }
    };
  }

  if (!skillGate.ok) {
    return {
      ok: false,
      result: {
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: `Skill gate blocked execution: ${skillGate.violations.map((entry) => entry.message).join('; ')}`
      },
      artifact: null,
      usage: null,
      actualModel: null,
      actualProvider: null,
      trace: {
        sessionId,
        requestedProfile,
        selectedAgentId: selectedProfile.agentId,
        selectedModelId: selectedProfile.modelId,
        skills: skillGate,
        skillRegistry: {
          status: skillRegistry.status,
          manifestPath: skillRegistry.manifestPath,
          skillCount: skillRegistry.skillCount,
          autoCompiled: skillRegistry.autoCompiled,
          errors: skillRegistry.errors || []
        },
        notifications: notificationEvents
      }
    };
  }

  const agentBootstrap = await ensureOpenClawAgent({
    agentId: selectedProfile.agentId,
    modelId: selectedProfile.modelId,
    cwd: runtime.rootDir
  });

  if (!agentBootstrap.ok) {
    return {
      ok: false,
      result: {
        ok: false,
        exitCode: agentBootstrap.exitCode ?? null,
        stdout: agentBootstrap.stdout || '',
        stderr: agentBootstrap.stderr || `Failed to prepare OpenClaw agent ${selectedProfile.agentId}`
      },
      artifact: null,
      usage: null,
      actualModel: null,
      actualProvider: null,
      trace: {
        sessionId,
        requestedProfile,
        selectedAgentId: selectedProfile.agentId,
        selectedModelId: selectedProfile.modelId,
        skills: skillGate,
        skillRegistry: {
          status: skillRegistry.status,
          manifestPath: skillRegistry.manifestPath,
          skillCount: skillRegistry.skillCount,
          autoCompiled: skillRegistry.autoCompiled,
          errors: skillRegistry.errors || []
        },
        notifications: notificationEvents
      }
    };
  }

  notificationEvents.push(
    normalizeNotificationEvent(
      'notify_started',
      await sendTelegramReport({
        eventName: 'notify_started',
        enabled: reportsEnabled,
        target: telegramTarget,
        message: buildReportText({
          task,
          run,
          status: 'started',
          details: {}
        }),
        cwd: runtime.rootDir
      })
    )
  );

  const result = shouldSimulateExecutionFailure()
    ? {
        ok: false,
        exitCode: null,
        stdout: '',
        stderr: getSimulatedExecutionFailureMessage(),
        timedOut: false,
        parsed: null,
        replyText: null,
        agentMeta: null
      }
    : await (async () => {
        const executionDelayMs = getExecutionDelayMs();
        if (executionDelayMs > 0) {
          await delay(executionDelayMs);
        }

        return executeAgentTurn({
          agentId: selectedProfile.agentId,
          sessionId,
          message: prompt,
          thinking: 'low',
          timeoutSeconds: Number(process.env.SOFIA_OPENCLAW_TIMEOUT_SECONDS || 120),
          cwd: runtime.rootDir
        });
      })();

  const artifactDir = path.join(runtime.artifactDir, run.id);
  await fs.mkdir(artifactDir, {recursive: true});
  const phaseArtifact = resolvePhaseArtifact(run.workerRole);

  const payload = {
    startedAt,
    completedAt: new Date().toISOString(),
    requestedProfile,
    selectedAgentId: selectedProfile.agentId,
    selectedModelId: selectedProfile.modelId,
    prompt,
    stdout: result.stdout,
    stderr: result.stderr,
    parsed: result.parsed,
    replyText: result.replyText,
    agentMeta: result.agentMeta,
    notifications: notificationEvents
  };

  const actualModel = process.env.SOFIA_TEST_ACTUAL_MODEL || result.agentMeta?.model || null;
  const actualProvider = process.env.SOFIA_TEST_ACTUAL_PROVIDER || result.agentMeta?.provider || null;
  const usage = {
    input: getOverrideNumber('SOFIA_TEST_USAGE_INPUT', result.agentMeta?.usage?.input ?? null),
    output: getOverrideNumber('SOFIA_TEST_USAGE_OUTPUT', result.agentMeta?.usage?.output ?? null)
  };
  const guardrails = evaluateExecutionGuardrails({
    risk: task.risk,
    requestedProfile,
    actualProvider,
    actualModel,
    usage
  });
  payload.guardrails = guardrails;
  payload.skills = {
    gate: skillGate,
    registry: {
      status: skillRegistry.status,
      manifestPath: skillRegistry.manifestPath,
      skillCount: skillRegistry.skillCount,
      autoCompiled: skillRegistry.autoCompiled,
      errors: skillRegistry.errors || []
    }
  };

  const artifactPath = path.join(artifactDir, phaseArtifact.filename);
  await fs.writeFile(artifactPath, JSON.stringify(payload, null, 2), 'utf8');

  notificationEvents.push(
    normalizeNotificationEvent(
      'notify_completed',
      await sendTelegramReport({
        eventName: 'notify_completed',
        enabled: reportsEnabled,
        target: telegramTarget,
        message: buildReportText({
          task,
          run,
          status: result.ok ? 'completed' : 'failed',
          details: {
            actualModel,
            replyText: result.replyText,
            error: result.ok
              ? (guardrails.ok ? null : guardrails.violations.map((entry) => entry.message).join('; '))
              : (result.stderr || result.stdout || result.error?.message || 'unknown error')
          }
        }),
        cwd: runtime.rootDir
      })
    )
  );

  payload.notifications = notificationEvents;
  await fs.writeFile(artifactPath, JSON.stringify(payload, null, 2), 'utf8');

  const executionOk = result.ok && guardrails.ok;
  const executionError = !result.ok
    ? (result.stderr || result.stdout || result.error?.message || 'unknown error')
    : (!guardrails.ok ? guardrails.violations.map((entry) => entry.message).join('; ') : null);

  return {
    ok: executionOk,
    result: {
      ...result,
      ok: executionOk,
      stderr: executionError || result.stderr,
      policyError: !guardrails.ok ? executionError : null
    },
    artifact: {
      kind: phaseArtifact.kind,
      uri: artifactPath
    },
    usage,
    actualModel,
    actualProvider,
    trace: {
      sessionId,
      requestedProfile,
      selectedAgentId: selectedProfile.agentId,
      selectedModelId: selectedProfile.modelId,
      notifications: notificationEvents,
      skills: skillGate,
      skillRegistry: {
        status: skillRegistry.status,
        manifestPath: skillRegistry.manifestPath,
        skillCount: skillRegistry.skillCount,
        autoCompiled: skillRegistry.autoCompiled,
        errors: skillRegistry.errors || []
      },
      guardrails
    }
  };
}

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

function expandHome(inputPath) {
  const candidate = String(inputPath || '').trim();
  if (!candidate) {
    return path.join(os.homedir(), '.openclaw', 'openclaw.json');
  }

  if (candidate === '~') {
    return os.homedir();
  }

  if (candidate.startsWith('~/')) {
    return path.join(os.homedir(), candidate.slice(2));
  }

  return candidate;
}

function safeJsonParse(raw) {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return {
      ok: false,
      error: {
        name: error?.name ?? 'SyntaxError',
        message: error?.message ?? String(error)
      }
    };
  }
}

function buildGatewaySummary(config) {
  const gateway = config?.gateway ?? {};
  const auth = gateway.auth ?? {};
  return {
    port: gateway.port ?? null,
    bind: gateway.bind ?? null,
    mode: gateway.mode ?? null,
    authMode: auth.mode ?? null,
    hasToken: Boolean(auth.token),
    tailscaleMode: gateway.tailscale?.mode ?? null
  };
}

function buildRouterSummary(config) {
  const providers = config?.models?.providers ?? {};
  const providerEntries = Object.entries(providers).map(([name, provider]) => ({
    name,
    baseUrl: provider?.baseUrl ?? null,
    api: provider?.api ?? null,
    apiKeyPresent: Boolean(provider?.apiKey),
    modelIds: Array.isArray(provider?.models) ? provider.models.map((model) => model?.id ?? null).filter(Boolean) : []
  }));

  return {
    mode: config?.models?.mode ?? null,
    providerCount: providerEntries.length,
    providers: providerEntries
  };
}

function buildAgentSummary(config) {
  const defaults = config?.agents?.defaults ?? {};
  const models = defaults.models ?? {};
  return {
    workspace: defaults.workspace ?? null,
    primaryModel: defaults.model?.primary ?? null,
    registeredModels: Object.keys(models).sort()
  };
}

function buildTelegramSummary(config) {
  const telegram = config?.channels?.telegram ?? {};
  return {
    enabled: Boolean(telegram.enabled),
    dmPolicy: telegram.dmPolicy ?? null,
    allowFrom: Array.isArray(telegram.allowFrom) ? telegram.allowFrom.slice() : [],
    defaultTo: telegram.defaultTo ?? null,
    groupPolicy: telegram.groupPolicy ?? null,
    configWrites: telegram.configWrites ?? null,
    execApprovalsEnabled: Boolean(telegram.execApprovals?.enabled)
  };
}

export function loadOpenClawConfig(configPath = process.env.SOFIA_OPENCLAW_CONFIG_PATH || '~/.openclaw/openclaw.json') {
  const resolvedPath = expandHome(configPath);
  if (!fs.existsSync(resolvedPath)) {
    return {
      ok: false,
      configPath,
      resolvedPath,
      error: {
        code: 'config_missing',
        message: 'OpenClaw config file does not exist'
      }
    };
  }

  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = safeJsonParse(raw);
    if (!parsed.ok) {
      return {
        ok: false,
        configPath,
        resolvedPath,
        error: {
          code: 'config_invalid_json',
          message: parsed.error.message
        }
      };
    }

    return {
      ok: true,
      configPath,
      resolvedPath,
      config: parsed.value ?? {}
    };
  } catch (error) {
    return {
      ok: false,
      configPath,
      resolvedPath,
      error: {
        code: 'config_unreadable',
        message: error?.message ?? String(error)
      }
    };
  }
}

export function validateOpenClawConfig(configPath = process.env.SOFIA_OPENCLAW_CONFIG_PATH || '~/.openclaw/openclaw.json') {
  const resolvedPath = expandHome(configPath);
  const report = {
    ok: false,
    configPath,
    resolvedPath,
    exists: false,
    readable: false,
    parsed: false,
    gateway: null,
    router: null,
    agents: null,
    telegram: null,
    warnings: [],
    errors: [],
    evidence: {}
  };

  if (!fs.existsSync(resolvedPath)) {
    report.errors.push({
      code: 'config_missing',
      message: 'OpenClaw config file does not exist',
      path: resolvedPath
    });
    return report;
  }

  report.exists = true;

  let raw;
  try {
    raw = fs.readFileSync(resolvedPath, 'utf8');
    report.readable = true;
    report.evidence.fileSize = Buffer.byteLength(raw, 'utf8');
    report.evidence.modifiedTime = fs.statSync(resolvedPath).mtime.toISOString();
  } catch (error) {
    report.errors.push({
      code: 'config_unreadable',
      message: error?.message ?? String(error),
      path: resolvedPath
    });
    return report;
  }

  const parsed = safeJsonParse(raw);
  if (!parsed.ok) {
    report.errors.push({
      code: 'config_invalid_json',
      message: parsed.error.message,
      path: resolvedPath
    });
    return report;
  }

  const config = parsed.value ?? {};
  report.parsed = true;
  report.gateway = buildGatewaySummary(config);
  report.router = buildRouterSummary(config);
  report.agents = buildAgentSummary(config);
  report.telegram = buildTelegramSummary(config);

  if (!report.gateway.hasToken) {
    report.warnings.push({
      code: 'gateway_token_missing',
      message: 'Gateway auth token is not present in config'
    });
  }

  if (!report.router.providerCount) {
    report.warnings.push({
      code: 'no_router_providers',
      message: 'No 9Router providers are configured in OpenClaw'
    });
  }

  if (!report.agents.primaryModel) {
    report.warnings.push({
      code: 'primary_model_missing',
      message: 'No default primary model is configured'
    });
  }

  if (report.telegram.enabled && !report.telegram.defaultTo) {
    report.warnings.push({
      code: 'telegram_default_target_missing',
      message: 'Telegram is enabled but no default target is set'
    });
  }

  report.ok = report.errors.length === 0;
  return report;
}

function collectProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: {...process.env, ...(options.env || {})},
      shell: false,
      windowsHide: true
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeoutMs = options.timeoutMs ?? 120000;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        timedOut: true
      });
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: false,
        exitCode: null,
        stdout,
        stderr,
        timedOut: false,
        error: {
          name: error?.name ?? 'Error',
          message: error?.message ?? String(error)
        }
      });
    });

    child.on('close', (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ok: exitCode === 0,
        exitCode,
        stdout,
        stderr,
        timedOut: false
      });
    });
  });
}

function findJsonBlock(text) {
  const source = String(text || '').trim();
  if (!source) return null;

  const starts = [];
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{' || char === '[') {
      starts.push(index);
    }
  }

  for (let index = starts.length - 1; index >= 0; index -= 1) {
    const candidate = source.slice(starts[index]).trim();
    try {
      return JSON.parse(candidate);
    } catch {
      // Continue searching earlier candidates.
    }
  }

  return null;
}

function getOpenClawInvocation(args = []) {
  if (process.env.SOFIA_OPENCLAW_COMMAND) {
    return {
      command: process.env.SOFIA_OPENCLAW_COMMAND,
      args
    };
  }

  if (process.platform === 'win32' && process.env.APPDATA) {
    return {
      command: process.execPath,
      args: [
        path.join(process.env.APPDATA, 'npm', 'node_modules', 'openclaw', 'openclaw.mjs'),
        ...args
      ]
    };
  }

  return {
    command: 'openclaw',
    args
  };
}

async function runOpenClawCommand(args = [], options = {}) {
  const invocation = getOpenClawInvocation(args);
  return collectProcess(invocation.command, invocation.args, {
    cwd: options.cwd,
    env: options.env,
    timeoutMs: options.timeoutMs
  });
}

export async function listOpenClawAgents({cwd, env} = {}) {
  const result = await runOpenClawCommand(['agents', 'list', '--json'], {
    cwd,
    env,
    timeoutMs: 30000
  });
  const parsed = findJsonBlock(`${result.stdout}\n${result.stderr}`);
  return {
    ...result,
    parsed,
    agents: Array.isArray(parsed) ? parsed : []
  };
}

export async function ensureOpenClawAgent({
  agentId,
  modelId,
  cwd,
  env,
  workspaceRoot = '~/.openclaw/workspaces'
}) {
  const listResult = await listOpenClawAgents({cwd, env});
  const existing = listResult.agents.find((agent) => agent?.id === agentId);
  if (existing) {
    if (existing.model && existing.model !== modelId) {
      return {
        ok: false,
        created: false,
        agent: existing,
        stdout: '',
        stderr: `OpenClaw agent ${agentId} already exists with model ${existing.model}, expected ${modelId}`
      };
    }
    return {
      ok: true,
      created: false,
      agent: existing
    };
  }

  const workspace = path.join(expandHome(workspaceRoot), agentId);
  const result = await runOpenClawCommand(
    ['agents', 'add', agentId, '--non-interactive', '--workspace', workspace, '--model', modelId, '--json'],
    {
      cwd,
      env,
      timeoutMs: 60000
    }
  );
  const parsed = findJsonBlock(`${result.stdout}\n${result.stderr}`);
  return {
    ...result,
    parsed,
    created: result.ok,
    agent: parsed?.agent || parsed || null,
    workspace
  };
}

export async function executeAgentTurn({
  agentId,
  sessionId,
  message,
  thinking = 'low',
  timeoutSeconds = 120,
  local = true,
  cwd,
  env
}) {
  const args = [
    'agent',
    ...(agentId ? ['--agent', agentId] : []),
    ...(local ? ['--local'] : []),
    '--session-id',
    sessionId,
    '--message',
    message,
    '--thinking',
    thinking,
    '--timeout',
    String(timeoutSeconds),
    '--json'
  ];

  const result = await runOpenClawCommand(args, {
    cwd,
    env,
    timeoutMs: timeoutSeconds * 1000 + 10000
  });

  const parsed = findJsonBlock(`${result.stdout}\n${result.stderr}`);
  return {
    ...result,
    parsed,
    replyText: parsed?.payloads?.map((payload) => payload?.text).filter(Boolean).join('\n\n') || null,
    agentMeta: parsed?.meta?.agentMeta || null
  };
}

export async function sendTelegramMessage({
  message,
  target,
  cwd,
  env
}) {
  const args = [
    'message',
    'send',
    '--channel',
    'telegram',
    '--target',
    String(target),
    '--message',
    message
  ];

  const result = await runOpenClawCommand(args, {
    cwd,
    env,
    timeoutMs: 30000
  });

  return {
    ...result,
    delivered: result.ok && /sent via telegram/i.test(`${result.stdout}\n${result.stderr}`)
  };
}

export function getDefaultTelegramTarget(configReport) {
  return configReport?.telegram?.defaultTo || null;
}

export { expandHome, safeJsonParse, findJsonBlock };

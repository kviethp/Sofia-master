import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';

function getDefaultPlinkPath() {
  if (process.env.SOFIA_TUNNEL_COMMAND) {
    return process.env.SOFIA_TUNNEL_COMMAND;
  }

  if (process.platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'plink.exe');
  }

  return 'ssh';
}

function getTunnelConfig() {
  return {
    command: getDefaultPlinkPath(),
    host: process.env.SOFIA_TUNNEL_HOST || '',
    port: String(process.env.SOFIA_TUNNEL_PORT || '22'),
    user: process.env.SOFIA_TUNNEL_USER || '',
    password: process.env.SOFIA_TUNNEL_PASSWORD || '',
    hostKey: process.env.SOFIA_TUNNEL_HOSTKEY || '',
    forwards: String(
      process.env.SOFIA_TUNNEL_FORWARDS ||
        '5432:127.0.0.1:5432,6379:127.0.0.1:6379,20128:127.0.0.1:20128,18789:127.0.0.1:18789'
    )
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  };
}

function validateTunnelConfig(config) {
  const missing = [];
  for (const field of ['host', 'port', 'user']) {
    if (!config[field]) {
      missing.push(field);
    }
  }

  if (process.platform === 'win32') {
    if (!config.password) {
      missing.push('password');
    }
    if (!config.hostKey) {
      missing.push('hostKey');
    }
  }

  if (config.forwards.length === 0) {
    missing.push('forwards');
  }

  if (missing.length > 0) {
    throw new Error(`Missing tunnel config: ${missing.join(', ')}`);
  }
}

function buildPlinkArgs(config) {
  return [
    '-N',
    '-batch',
    '-ssh',
    '-P',
    config.port,
    '-l',
    config.user,
    '-pw',
    config.password,
    '-hostkey',
    config.hostKey,
    ...config.forwards.flatMap((forward) => ['-L', forward]),
    config.host
  ];
}

function buildSshArgs(config) {
  return [
    '-N',
    '-p',
    config.port,
    ...config.forwards.flatMap((forward) => ['-L', forward]),
    `${config.user}@${config.host}`
  ];
}

function sanitizeCommandLine(argv) {
  const result = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '-pw') {
      result.push('-pw', '<redacted>');
      index += 1;
      continue;
    }
    result.push(argv[index]);
  }
  return result;
}

function toTunnelSignature(config) {
  return JSON.stringify({
    host: config.host,
    port: config.port,
    user: config.user,
    forwards: config.forwards
  });
}

function getPidFile() {
  return path.join(process.cwd(), '.sofia', 'state', 'tunnel-vps.pid');
}

async function ensureStateDir() {
  const fs = await import('node:fs/promises');
  await fs.mkdir(path.dirname(getPidFile()), {recursive: true});
  return fs;
}

async function readStoredState() {
  const fs = await import('node:fs/promises');
  try {
    return JSON.parse(await fs.readFile(getPidFile(), 'utf8'));
  } catch {
    return null;
  }
}

async function writeStoredState(payload) {
  const fs = await ensureStateDir();
  await fs.writeFile(getPidFile(), JSON.stringify(payload, null, 2), 'utf8');
}

function canSignal(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function buildInvocation(config) {
  if (process.platform === 'win32') {
    return {
      command: config.command,
      args: buildPlinkArgs(config)
    };
  }

  return {
    command: config.command,
    args: buildSshArgs(config)
  };
}

async function startTunnel() {
  const config = getTunnelConfig();
  validateTunnelConfig(config);
  const invocation = buildInvocation(config);
  const existing = await readStoredState();

  if (existing?.pid && canSignal(existing.pid) && existing.signature === toTunnelSignature(config)) {
    console.log(JSON.stringify({result: 'already_running', pid: existing.pid, forwards: config.forwards}, null, 2));
    return;
  }

  const child = spawn(invocation.command, invocation.args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  await writeStoredState({
    pid: child.pid,
    command: invocation.command,
    args: sanitizeCommandLine(invocation.args),
    signature: toTunnelSignature(config),
    startedAt: new Date().toISOString()
  });

  console.log(JSON.stringify({result: 'started', pid: child.pid, command: invocation.command, args: sanitizeCommandLine(invocation.args)}, null, 2));
}

async function statusTunnel() {
  const state = await readStoredState();
  const running = Boolean(state?.pid && canSignal(state.pid));
  console.log(JSON.stringify({result: running ? 'running' : 'stopped', ...(state || {}), running}, null, 2));
}

async function stopTunnel() {
  const fs = await import('node:fs/promises');
  const state = await readStoredState();
  if (!state?.pid) {
    console.log(JSON.stringify({result: 'stopped', running: false}, null, 2));
    return;
  }

  if (canSignal(state.pid)) {
    process.kill(state.pid);
  }

  try {
    await fs.unlink(getPidFile());
  } catch {
    // Ignore missing pid file during stop cleanup.
  }

  console.log(JSON.stringify({result: 'stopped', pid: state.pid, running: false}, null, 2));
}

const action = String(process.argv[2] || 'status').trim().toLowerCase();

if (action === 'start') {
  await startTunnel();
} else if (action === 'status') {
  await statusTunnel();
} else if (action === 'stop') {
  await stopTunnel();
} else {
  throw new Error(`Unsupported action: ${action}`);
}

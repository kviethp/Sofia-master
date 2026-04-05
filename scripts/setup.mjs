import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import os from 'node:os';
import readline from 'node:readline/promises';
import {stdin as input, stdout as output} from 'node:process';

const rootDir = process.cwd();
const envExamplePath = path.join(rootDir, '.env.example');
const envPath = path.join(rootDir, '.env');
const composeArgs = ['compose', '-f', 'infra/compose/docker-compose.yml'];
const systemdUnitName = 'sofia-compose.service';

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, {stdio: 'ignore'});
  return result.status === 0;
}

function collectToolingReport(platform) {
  return {
    platform,
    node: commandAvailable('node'),
    pnpm: commandAvailable('pnpm'),
    corepack: commandAvailable('corepack'),
    docker: commandAvailable('docker'),
    systemctl: platform === 'linux' ? commandAvailable('systemctl') : false
  };
}

function printToolingReport(report) {
  console.log('[sofia] tooling report:');
  for (const [key, value] of Object.entries(report)) {
    console.log(`  - ${key}: ${value}`);
  }
}

function assertTooling(report, config) {
  const missing = [];
  if (!report.node) missing.push('node');
  if (!report.pnpm && !report.corepack) missing.push('pnpm or corepack');
  if (config.startServices && !report.docker) missing.push('docker');
  if (config.startupMode === 'auto-start' && config.platform === 'linux' && !report.systemctl) {
    missing.push('systemctl');
  }
  if (missing.length > 0) {
    throw new Error(`missing required tooling: ${missing.join(', ')}`);
  }
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith('--')) continue;
    const [key, inlineValue] = entry.split('=', 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, 'true');
    }
  }
  return args;
}

function parseEnv(text) {
  const lines = String(text || '').split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) {
      entries.push({key: match[1], value: match[2]});
    } else {
      entries.push({raw: line});
    }
  }
  return entries;
}

function setEnvValue(entries, key, value) {
  const stringValue = String(value);
  const entry = entries.find((item) => item.key === key);
  if (entry) {
    entry.value = stringValue;
    return;
  }
  entries.push({key, value: stringValue});
}

function renderEnv(entries) {
  return `${entries
    .map((entry) => (entry.key ? `${entry.key}=${entry.value}` : entry.raw || ''))
    .join('\n')}
`;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: options.stdio || 'inherit',
    encoding: options.encoding || 'utf8',
    env: {
      ...process.env,
      ...(options.env || {})
    }
  });
  if (options.allowFailure) {
    return result;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
  return result;
}

async function ensureEnvFile() {
  try {
    await fs.access(envPath);
  } catch {
    await fs.copyFile(envExamplePath, envPath);
  }
  return fs.readFile(envPath, 'utf8');
}

async function ask(question, fallback, rl, choices = null) {
  const suffix = choices?.length ? ` (${choices.join('/')})` : '';
  const answer = (await rl.question(`${question}${suffix} [${fallback}]: `)).trim();
  if (!answer) return fallback;
  return answer;
}

function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}


function detectPlatform() {
  if (process.platform === 'win32') return 'windows';
  if (process.platform === 'linux') return 'linux';
  return process.platform;
}

async function ensureLinuxAutostartService() {
  const systemctlAvailable = commandAvailable('systemctl');
  if (!systemctlAvailable) {
    return {ok: false, mode: 'guide-only', reason: 'systemctl unavailable'};
  }

  const unitPath = `/etc/systemd/system/${systemdUnitName}`;
  const content = `[Unit]
Description=Sofia Master compose stack
After=docker.service network-online.target
Wants=network-online.target
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=${rootDir}
RemainAfterExit=yes
ExecStart=/usr/bin/docker ${composeArgs.join(' ')} up -d postgres redis api web admin
ExecStop=/usr/bin/docker ${composeArgs.join(' ')} down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
`;

  await fs.writeFile(unitPath, content, 'utf8');
  run('systemctl', ['daemon-reload']);
  run('systemctl', ['enable', systemdUnitName]);
  return {ok: true, mode: 'systemd', unit: systemdUnitName, unitPath};
}

function printAutostartGuide(platform) {
  console.log('\n[sofia] auto-start on boot was not applied automatically.');
  if (platform === 'windows') {
    console.log('[sofia] recommended Windows fallback:');
    console.log('  - enable Docker Desktop auto-start');
    console.log('  - enable container restart policy / compose restart');
    console.log('  - or create a Task Scheduler entry that runs:');
    console.log(`    docker ${composeArgs.join(' ')} up -d postgres redis api web admin`);
    return;
  }
  console.log('[sofia] recommended Linux fallback:');
  console.log(`  sudo tee /etc/systemd/system/${systemdUnitName} >/dev/null < <(cat <<"EOF" ... EOF)`);
  console.log(`  sudo systemctl enable ${systemdUnitName}`);
}

async function collectConfig() {
  const args = parseArgs(process.argv);
  const interactive = !args.has('--non-interactive');
  const rl = interactive ? readline.createInterface({input, output}) : null;
  try {
    const mode = interactive
      ? await ask('Setup mode', args.get('--mode') || 'quick', rl, ['quick', 'advanced'])
      : args.get('--mode') || 'quick';
    const startServices = interactive
      ? toBool(await ask('Start services now?', args.get('--start-services') || 'yes', rl, ['yes', 'no']), true)
      : toBool(args.get('--start-services'), true);
    const launchMode = startServices
      ? interactive
        ? await ask('Launch mode', args.get('--launch-mode') || 'same-window', rl, ['same-window', 'guide-only'])
        : args.get('--launch-mode') || 'same-window'
      : 'guide-only';
    const enableWorkerLoop = interactive
      ? toBool(await ask('Enable worker loop?', args.get('--worker-loop') || 'no', rl, ['yes', 'no']), false)
      : toBool(args.get('--worker-loop'), false);
    const enableApprovalPoller = interactive
      ? toBool(await ask('Enable approval poller?', args.get('--approval-poller') || 'no', rl, ['yes', 'no']), false)
      : toBool(args.get('--approval-poller'), false);
    const runChecks = interactive
      ? toBool(await ask('Run doctor + smoke checks?', args.get('--run-checks') || 'yes', rl, ['yes', 'no']), true)
      : toBool(args.get('--run-checks'), true);
    const platform = detectPlatform();
    const startupMode = interactive
      ? await ask('Startup persistence', args.get('--startup-mode') || 'run-now', rl, ['run-now', 'auto-start', 'manual'])
      : args.get('--startup-mode') || 'run-now';

    const dryRun = interactive
      ? toBool(await ask('Dry run only?', args.get('--dry-run') || 'no', rl, ['yes', 'no']), false)
      : toBool(args.get('--dry-run'), false);

    const config = {
      mode,
      platform,
      startServices: startupMode === 'manual' ? false : startServices,
      launchMode,
      startupMode,
      dryRun,
      enableWorkerLoop,
      enableApprovalPoller,
      runChecks,
      executionMode: args.get('--execution-mode') || 'scaffold',
      apiPort: args.get('--api-port') || '8080',
      webPort: args.get('--web-port') || '3000',
      adminPort: args.get('--admin-port') || '3001',
      controlToken: args.get('--control-token') || ''
    };

    if (mode === 'advanced' && interactive) {
      config.executionMode = await ask('Execution mode', config.executionMode, rl, ['scaffold', 'openclaw']);
      config.apiPort = await ask('API port', config.apiPort, rl);
      config.webPort = await ask('Web port', config.webPort, rl);
      config.adminPort = await ask('Admin port', config.adminPort, rl);
      config.controlToken = await ask('Control token (blank keeps current/empty)', config.controlToken, rl);
    }

    return config;
  } finally {
    await rl?.close();
  }
}

function printGuide(config) {
  console.log(`\n[sofia] setup complete for platform: ${config.platform}`);
  console.log('[sofia] Start services manually with:');
  console.log(`  docker ${composeArgs.join(' ')} up -d postgres redis api web admin`);
  if (config.enableWorkerLoop) {
    console.log('  node scripts/worker-loop.mjs');
  }
  if (config.enableApprovalPoller) {
    console.log('  node scripts/approval-poller-loop.mjs');
  }
  console.log('  node apps/sofia-api/scripts/doctor.js');
  console.log('  node apps/sofia-api/scripts/smoke.js');
}

async function main() {
  const envRaw = await ensureEnvFile();
  const envEntries = parseEnv(envRaw);
  const config = await collectConfig();

  setEnvValue(envEntries, 'SOFIA_API_PORT', config.apiPort);
  setEnvValue(envEntries, 'SOFIA_WEB_PORT', config.webPort);
  setEnvValue(envEntries, 'SOFIA_ADMIN_PORT', config.adminPort);
  setEnvValue(envEntries, 'SOFIA_EXECUTION_MODE', config.executionMode);
  setEnvValue(envEntries, 'SOFIA_WORKER_LOOP', config.enableWorkerLoop ? 'true' : 'false');
  if (config.controlToken) {
    setEnvValue(envEntries, 'SOFIA_CONTROL_TOKEN', config.controlToken);
  }

  await fs.writeFile(envPath, renderEnv(envEntries), 'utf8');

  console.log('\n[sofia] bootstrap');
  run('node', ['scripts/bootstrap.mjs']);

  console.log('\n[sofia] install dependencies');
  if (commandAvailable('pnpm')) {
    run('pnpm', ['install']);
  } else if (commandAvailable('corepack')) {
    run('corepack', ['pnpm', 'install']);
  } else {
    throw new Error('pnpm/corepack unavailable');
  }

  console.log('\n[sofia] compile skills');
  run('node', ['scripts/skills-compile.mjs']);

  if (config.startServices) {
    console.log('\n[sofia] start core services');
    run('docker', [...composeArgs, 'up', '-d', 'postgres', 'redis', 'api', 'web', 'admin']);
  }

  console.log('\n[sofia] migrate runtime');
  run('node', ['apps/sofia-api/scripts/migrate.js']);

  if (config.runChecks) {
    console.log('\n[sofia] doctor');
    run('node', ['apps/sofia-api/scripts/doctor.js']);
    console.log('\n[sofia] smoke');
    run('node', ['apps/sofia-api/scripts/smoke.js']);
  }

  if (config.startupMode === 'auto-start') {
    if (autostartResult?.ok) {
      console.log(`\n[sofia] auto-start enabled via ${autostartResult.mode}: ${autostartResult.unit || autostartResult.reason}`);
    } else {
      printAutostartGuide(config.platform);
    }
  }

  if (!config.startServices || config.launchMode === 'guide-only') {
    printGuide(config);
  } else {
    console.log('\n[sofia] core services are up. Streaming compose logs in this window...');
    console.log('[sofia] if you enabled worker/poller, start them in another terminal:');
    if (config.enableWorkerLoop) {
      console.log('  node scripts/worker-loop.mjs');
    }
    if (config.enableApprovalPoller) {
      console.log('  node scripts/approval-poller-loop.mjs');
    }
    run('docker', [...composeArgs, 'logs', '-f', 'api', 'web', 'admin']);
  }
}

await main();

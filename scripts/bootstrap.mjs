import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const rootDir = process.cwd();
const envExamplePath = path.join(rootDir, '.env.example');
const envPath = path.join(rootDir, '.env');

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, {stdio: 'ignore'});
  return result.status === 0;
}

const pnpmAvailable = commandAvailable('pnpm');
const corepackAvailable = commandAvailable('corepack');
const installCommand = pnpmAvailable
  ? 'pnpm install'
  : corepackAvailable
    ? 'corepack enable pnpm && pnpm install'
    : 'install pnpm, then run pnpm install';

const envExists = await fs.access(envPath).then(() => true).catch(() => false);
if (!envExists) {
  await fs.copyFile(envExamplePath, envPath);
}

const report = {
  status: 'ok',
  envCreated: !envExists,
  checks: {
    node: commandAvailable('node'),
    pnpm: pnpmAvailable,
    corepack: corepackAvailable,
    docker: commandAvailable('docker')
  },
  nextSteps: [
    installCommand,
    'node scripts/skills-compile.mjs',
    'node scripts/up.mjs',
    'node apps/sofia-api/scripts/migrate.js',
    'node apps/sofia-api/scripts/doctor.js',
    'node apps/sofia-api/scripts/smoke.js'
  ]
};

console.log(JSON.stringify(report, null, 2));

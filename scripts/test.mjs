import {spawnSync} from 'node:child_process';

const commands = [
  ['node', ['scripts/agent-system-conformance.mjs']],
  ['node', ['apps/sofia-api/scripts/doctor.js']],
  ['node', ['apps/sofia-api/scripts/preflight.js']],
  ['node', ['apps/sofia-api/scripts/smoke.js']]
];

if ((process.env.SOFIA_INCLUDE_CONFORMANCE || 'false') === 'true') {
  commands.push(['node', ['apps/sofia-api/scripts/conformance.js']]);
}

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {stdio: 'inherit', cwd: process.cwd()});
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('[sofia] test sequence completed');

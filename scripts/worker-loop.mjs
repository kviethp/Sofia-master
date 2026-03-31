const loopEnvDefaults = {
  SOFIA_WORKER_LOOP: 'true',
  SOFIA_WORKER_IDLE_SLEEP_MS: '1000',
  SOFIA_WORKER_POLL_INTERVAL_MS: '1000'
};

for (const [key, value] of Object.entries(loopEnvDefaults)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

console.log('[sofia] launching loop-capable worker');
console.log('[sofia] set SOFIA_WORKER_MAX_ITERATIONS=1 for a bounded smoke run');

await import('../apps/sofia-worker/src/index.js');

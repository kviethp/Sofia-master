const loopDelayMs = Number(process.env.SOFIA_APPROVAL_POLL_INTERVAL_MS || 5000);
const maxIterationsRaw = Number(process.env.SOFIA_APPROVAL_POLL_MAX_ITERATIONS || 0);
const maxIterations = Number.isFinite(maxIterationsRaw) && maxIterationsRaw > 0 ? Math.floor(maxIterationsRaw) : Number.POSITIVE_INFINITY;

let iterations = 0;

console.log('[sofia] launching Telegram approval poller loop');
console.log(`[sofia] poll interval: ${loopDelayMs}ms`);

while (iterations < maxIterations) {
  iterations += 1;

  try {
    await import(`../apps/sofia-api/scripts/process-telegram-approvals.js?iteration=${iterations}&t=${Date.now()}`);
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          status: 'poll_error',
          iteration: iterations,
          message: error?.message ?? String(error)
        },
        null,
        2
      )
    );
  }

  if (iterations < maxIterations) {
    await new Promise((resolve) => setTimeout(resolve, loopDelayMs));
  }
}

console.log(
  JSON.stringify(
    {
      status: 'completed',
      iterations,
      maxIterations: Number.isFinite(maxIterations) ? maxIterations : 'unbounded',
      pollIntervalMs: loopDelayMs
    },
    null,
    2
  )
);

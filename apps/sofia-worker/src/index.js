import {processOneQueuedRun, probeRuntimeServices} from '../../sofia-api/src/runtime-backend.js';

function parseBoolean(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function getWorkerLoopConfig() {
  const loopEnabled = parseBoolean(process.env.SOFIA_WORKER_LOOP);
  const explicitMaxIterations = Number(process.env.SOFIA_WORKER_MAX_ITERATIONS);
  const maxIterations = Number.isFinite(explicitMaxIterations) && explicitMaxIterations > 0
    ? Math.floor(explicitMaxIterations)
    : (loopEnabled ? Number.POSITIVE_INFINITY : 1);

  return {
    loopEnabled,
    maxIterations,
    idleSleepMs: parsePositiveInteger(process.env.SOFIA_WORKER_IDLE_SLEEP_MS, 1000),
    pollIntervalMs: parsePositiveInteger(process.env.SOFIA_WORKER_POLL_INTERVAL_MS, 250)
  };
}

function createShutdownController() {
  const controller = new AbortController();
  const requestedSignals = new Set();
  const signalHandlers = new Map();

  const onSignal = (signalName) => {
    requestedSignals.add(signalName);
    controller.abort(signalName);
  };

  signalHandlers.set('SIGINT', onSignal.bind(null, 'SIGINT'));
  signalHandlers.set('SIGTERM', onSignal.bind(null, 'SIGTERM'));

  process.once('SIGINT', signalHandlers.get('SIGINT'));
  process.once('SIGTERM', signalHandlers.get('SIGTERM'));

  return {
    controller,
    requestedSignals,
    cleanup() {
      for (const [signalName, handler] of signalHandlers.entries()) {
        process.removeListener(signalName, handler);
      }
    }
  };
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve('aborted');
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve('timeout');
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      resolve('aborted');
    };

    signal?.addEventListener?.('abort', onAbort, {once: true});
  });
}

function buildOneShotOutput(runtime, processed) {
  return {
    status: processed ? 'processed' : 'idle',
    runtime,
    processed
  };
}

function buildLoopOutput(runtime, loopState) {
  return {
    status: loopState.lastResult ? (loopState.lastResult.status || 'processed') : 'idle',
    runtime,
    processed: loopState.lastResult?.processed || null,
    loop: {
      enabled: true,
      iterations: loopState.iterations,
      processedCount: loopState.processedCount,
      idleCount: loopState.idleCount,
      errorCount: loopState.errorCount,
      stoppedBy: loopState.stoppedBy || null,
      maxIterations: Number.isFinite(loopState.maxIterations) ? loopState.maxIterations : 'unbounded'
    },
    results: loopState.results
  };
}

async function runWorkerLoop(config, shutdown) {
  const state = {
    iterations: 0,
    processedCount: 0,
    idleCount: 0,
    errorCount: 0,
    stoppedBy: null,
    maxIterations: config.maxIterations,
    lastResult: null,
    results: [],
    lastRuntime: null
  };

  while (!shutdown.controller.signal.aborted && state.iterations < config.maxIterations) {
    state.iterations += 1;

    try {
      const runtime = await probeRuntimeServices();
      state.lastRuntime = runtime;

      if (runtime.mode !== 'postgres-redis') {
        const entry = {
          iteration: state.iterations,
          status: 'idle',
          reason: 'runtime_unavailable',
          runtime
        };
        state.lastResult = entry;
        state.results.push(entry);
        state.idleCount += 1;
        if (state.iterations < config.maxIterations) {
          await sleep(config.idleSleepMs, shutdown.controller.signal);
        }
        continue;
      }

      const processed = await processOneQueuedRun();
      const entry = {
        iteration: state.iterations,
        status: processed ? 'processed' : 'idle',
        processed: processed || null,
        runtime
      };
      state.lastResult = entry;
      state.results.push(entry);

      if (processed) {
        state.processedCount += 1;
        if (state.iterations < config.maxIterations) {
          await sleep(config.pollIntervalMs, shutdown.controller.signal);
        }
      } else {
        state.idleCount += 1;
        if (state.iterations < config.maxIterations) {
          await sleep(config.idleSleepMs, shutdown.controller.signal);
        }
      }
    } catch (error) {
      state.errorCount += 1;
      const entry = {
        iteration: state.iterations,
        status: 'error',
        error: {
          name: error?.name ?? 'Error',
          message: error?.message ?? String(error)
        }
      };
      state.lastResult = entry;
      state.results.push(entry);

      if (state.iterations < config.maxIterations) {
        await sleep(config.idleSleepMs, shutdown.controller.signal);
      }
    }
  }

  if (shutdown.controller.signal.aborted) {
    state.stoppedBy = [...shutdown.requestedSignals][0] || 'signal';
  } else if (state.iterations >= config.maxIterations) {
    state.stoppedBy = 'max_iterations';
  }

  return buildLoopOutput(state.lastRuntime, state);
}

const runtime = await probeRuntimeServices();
const config = getWorkerLoopConfig();
const shutdown = createShutdownController();

try {
  if (!config.loopEnabled && config.maxIterations === 1) {
    if (runtime.mode !== 'postgres-redis') {
      console.log(
        JSON.stringify(
          {
            status: 'idle',
            note: 'PostgreSQL or Redis is unavailable; worker remains in scaffold standby mode.',
            runtime,
            loop: {
              enabled: config.loopEnabled,
              maxIterations: Number.isFinite(config.maxIterations) ? config.maxIterations : 'unbounded'
            }
          },
          null,
          2
        )
      );
    } else {
      const processed = await processOneQueuedRun();
      console.log(JSON.stringify(buildOneShotOutput(runtime, processed), null, 2));
    }
  } else {
    const output = await runWorkerLoop(config, shutdown);
    console.log(JSON.stringify(output, null, 2));
  }
} finally {
  shutdown.cleanup();
}

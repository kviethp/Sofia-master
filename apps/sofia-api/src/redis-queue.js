import {createClient} from 'redis';

function toError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code ?? null
  };
}

export async function createRedisQueue(
  redisUrl = process.env.SOFIA_REDIS_URL || 'redis://127.0.0.1:6379'
) {
  if (!redisUrl) {
    throw new Error('SOFIA_REDIS_URL is required for Redis mode');
  }

  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 1500,
      reconnectStrategy: false
    }
  });
  client.on('error', () => {});
  await client.connect();

  return {
    client,
    redisUrl,
    queueName: process.env.SOFIA_TASK_QUEUE || 'sofia:runs',
    deadLetterQueueName: process.env.SOFIA_DEAD_LETTER_QUEUE || 'sofia:runs:dead-letter'
  };
}

export async function closeRedisQueue(queue) {
  if (queue?.client?.isOpen) {
    await queue.client.quit();
  }
}

export async function probeRedis(queue) {
  const startedAt = Date.now();
  try {
    const pong = await queue.client.ping();
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      response: pong
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: toError(error)
    };
  }
}

export async function enqueueRun(queue, runId) {
  const size = await queue.client.rPush(queue.queueName, runId);
  return {
    queueName: queue.queueName,
    runId,
    size
  };
}

export async function dequeueRun(queue, timeoutSeconds = 1) {
  const result = await queue.client.blPop(queue.queueName, timeoutSeconds);
  if (!result) {
    return null;
  }

  return result.element;
}

export async function enqueueDeadLetter(queue, payload) {
  const serialized = JSON.stringify(payload);
  const size = await queue.client.rPush(queue.deadLetterQueueName, serialized);
  return {
    queueName: queue.deadLetterQueueName,
    payload,
    size
  };
}

export async function dequeueDeadLetter(queue, timeoutSeconds = 1) {
  const result = await queue.client.blPop(queue.deadLetterQueueName, timeoutSeconds);
  if (!result) {
    return null;
  }

  try {
    return JSON.parse(result.element);
  } catch {
    return {
      raw: result.element
    };
  }
}

export async function getQueueStats(queue) {
  const [queuedCount, deadLetterCount] = await Promise.all([
    queue.client.lLen(queue.queueName),
    queue.client.lLen(queue.deadLetterQueueName)
  ]);

  return {
    queueName: queue.queueName,
    deadLetterQueueName: queue.deadLetterQueueName,
    queuedCount,
    deadLetterCount
  };
}

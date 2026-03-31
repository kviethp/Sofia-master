import fs from 'node:fs/promises';
import path from 'node:path';

import {approveTask, rejectTask} from '../src/runtime-backend.js';
import {getRuntimePaths} from '../src/paths.js';
import {loadOpenClawConfig, sendTelegramMessage} from '../../../packages/openclaw-adapter/src/index.js';

function parseCommand(text) {
  const tokens = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length < 2) {
    return null;
  }

  const action = tokens[0].replace(/^\//, '').toLowerCase();
  if (action !== 'approve' && action !== 'reject') {
    return null;
  }

  return {
    action,
    taskId: tokens[1],
    note: tokens.slice(2).join(' ').trim() || null
  };
}

async function readOffset(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Number(parsed.offset || 0);
  } catch {
    return 0;
  }
}

async function writeOffset(filePath, offset) {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, JSON.stringify({offset}, null, 2), 'utf8');
}

async function telegramRequest(botToken, method, params = {}) {
  const url = new URL(`https://api.telegram.org/bot${botToken}/${method}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url, {method: 'GET'});
  const payload = await response.json();
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.description || `Telegram API ${method} failed`);
  }
  return payload.result || [];
}

function buildResponseMessage(result) {
  if (result.ok) {
    return [
      `Sofia ${result.action}d task`,
      `Task: ${result.taskId}`,
      `Status: ${result.status}`
    ].join('\n');
  }

  return [
    `Sofia ${result.action} failed`,
    `Task: ${result.taskId}`,
    `Error: ${result.error}`
  ].join('\n');
}

async function handleCommand(command, chatId, runtime) {
  const decisionBy = `telegram:${chatId}`;

  try {
    const outcome =
      command.action === 'approve'
        ? await approveTask(command.taskId, {decisionBy, note: command.note || 'approved via telegram'})
        : await rejectTask(command.taskId, {decisionBy, note: command.note || 'rejected via telegram'});

    return {
      ok: true,
      action: command.action,
      taskId: command.taskId,
      status: outcome.task?.status || null,
      outcome
    };
  } catch (error) {
    return {
      ok: false,
      action: command.action,
      taskId: command.taskId,
      error: error?.message ?? String(error)
    };
  }
}

const runtime = getRuntimePaths();
const configReport = loadOpenClawConfig(runtime.openClawConfigPath);
if (!configReport.ok) {
  throw new Error(configReport.error?.message || 'OpenClaw config unavailable');
}

const telegram = configReport.config?.channels?.telegram ?? {};
if (!telegram.enabled || !telegram.botToken) {
  throw new Error('Telegram channel is not enabled in OpenClaw config');
}

const allowedSenders = new Set((telegram.allowFrom || []).map((value) => String(value)));
const offsetPath = path.join(runtime.stateDir, 'telegram-approval-offset.json');
const currentOffset = await readOffset(offsetPath);
const updates = await telegramRequest(telegram.botToken, 'getUpdates', {
  offset: currentOffset + 1,
  timeout: 1
});

let nextOffset = currentOffset;
const results = [];

for (const update of updates) {
  nextOffset = Math.max(nextOffset, Number(update.update_id || 0));
  const message = update.message || update.edited_message || null;
  const chatId = String(message?.chat?.id || '');
  const senderId = String(message?.from?.id || '');
  const command = parseCommand(message?.text || '');

  if (!command) {
    continue;
  }

  if (allowedSenders.size > 0 && !allowedSenders.has(senderId)) {
    results.push({
      ok: false,
      action: command.action,
      taskId: command.taskId,
      error: `sender ${senderId} is not allowlisted`
    });
    continue;
  }

  const result = await handleCommand(command, chatId, runtime);
  results.push(result);

  if (chatId) {
    await sendTelegramMessage({
      target: chatId,
      message: buildResponseMessage(result),
      cwd: runtime.rootDir
    });
  }
}

await writeOffset(offsetPath, nextOffset);

console.log(
  JSON.stringify(
    {
      ok: true,
      processed: results.length,
      offset: nextOffset,
      results
    },
    null,
    2
  )
);

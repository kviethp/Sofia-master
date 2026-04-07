import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {afterMilestoneHook, afterResumeHook, beforeCompactionHook, captureTaskInteractionHook} from '../src/memory-hooks.js';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readRuntimeMemoryIndex(stateDir) {
  try {
    const raw = await fs.readFile(path.join(stateDir, 'memory', 'index.json'), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {version: 1, activeTaskId: '', tasks: []};
  }
}

async function summarizeActiveMemoryTimeline(stateDir) {
  const index = await readRuntimeMemoryIndex(stateDir);
  const activeTaskId = index?.activeTaskId ? String(index.activeTaskId) : '';
  const entry = Array.isArray(index?.tasks) ? index.tasks.find((item) => String(item.taskId) === activeTaskId) : null;
  if (!activeTaskId || !entry?.timelinePath) {
    return {
      activeTaskId: activeTaskId || null,
      available: false,
      timelinePath: entry?.timelinePath || null,
      summary: null
    };
  }

  const timeline = await fs.readFile(entry.timelinePath, 'utf8');
  const summary = String(timeline || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .slice(0, 7);

  return {
    activeTaskId,
    title: entry.title || null,
    available: true,
    timelinePath: entry.timelinePath,
    summary,
    updatedAt: entry.updatedAt || null
  };
}

async function main() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sofia-memory-timeline-'));
  const stateDir = path.join(tempRoot, '.sofia', 'state');
  const runtime = {stateDir};
  const task = {
    id: 'task-memory-timeline-1',
    title: 'Validate memory timeline continuity',
    risk: 'medium',
    workflowTemplate: 'planner_builder_verifier',
    status: 'active'
  };
  const run = {
    id: 'run-memory-timeline-1',
    workerRole: 'builder',
    modelProfile: 'sofia-hard'
  };

  await afterResumeHook({
    runtime,
    task,
    reason: 'validation_resume',
    sourceText: 'Resume the active validation workflow'
  });

  await captureTaskInteractionHook({
    runtime,
    task,
    role: 'user',
    reason: 'validation_user_input',
    text: 'Please continue the validation workflow and preserve recent context.'
  });

  await beforeCompactionHook({
    runtime,
    task,
    run,
    reason: 'validation_before_compaction'
  });

  await afterMilestoneHook({
    runtime,
    task,
    run,
    milestone: 'execution_completed',
    detail: 'Validation builder phase completed successfully.',
    artifactUri: '.sofia/artifacts/run-memory-timeline-1',
    replyText: 'Builder phase done; ready for the next phase.',
    sourceText: 'Continue after builder validation'
  });

  const taskDir = path.join(stateDir, 'memory', 'tasks', String(task.id));
  const timelinePath = path.join(taskDir, 'timeline.md');
  const resumePath = path.join(taskDir, 'resume-block.md');
  const indexPath = path.join(stateDir, 'memory', 'index.json');

  const [timeline, resumeBlock, indexRaw] = await Promise.all([
    fs.readFile(timelinePath, 'utf8'),
    fs.readFile(resumePath, 'utf8'),
    fs.readFile(indexPath, 'utf8')
  ]);
  const index = JSON.parse(indexRaw);

  assert(timeline.includes('Current objective:'), 'timeline.md missing current objective');
  assert(timeline.includes('Next safe action:'), 'timeline.md missing next safe action');
  assert(timeline.includes('Latest artifact:'), 'timeline.md missing latest artifact');
  assert(resumeBlock.includes('## Active Timeline'), 'resume block missing active timeline section');
  assert(Array.isArray(index.tasks) && index.tasks.length === 1, 'memory index missing task entry');
  assert(index.tasks[0].timelinePath === timelinePath, 'memory index missing timeline path');

  const activeTimeline = await summarizeActiveMemoryTimeline(stateDir);
  const recentTurnsRaw = await fs.readFile(path.join(taskDir, 'recent-turns.json'), 'utf8');
  const recentTurns = JSON.parse(recentTurnsRaw);
  assert(Array.isArray(recentTurns.turns) && recentTurns.turns.some((turn) => turn.role === 'user' && String(turn.reason || '').includes('validation_user_input')), 'recent turns missing captured user interaction');

  assert(activeTimeline?.activeTaskId === task.id, 'runtime-style timeline summary task id mismatch');
  assert(activeTimeline?.timelinePath === timelinePath, 'runtime-style timeline summary path mismatch');
  assert(Array.isArray(activeTimeline?.summary) && activeTimeline.summary.some((line) => line.includes('Next safe action:')), 'runtime-style timeline summary missing next safe action bullet');

  console.log('[sofia] memory timeline validation passed');
  console.log(JSON.stringify({
    timelinePath,
    resumePath,
    activeTaskId: activeTimeline.activeTaskId,
    summary: activeTimeline.summary
  }, null, 2));
}

main().catch((error) => {
  console.error('[sofia] memory timeline validation failed');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});

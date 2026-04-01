import fs from 'node:fs/promises';
import path from 'node:path';

function nowIso() {
  return new Date().toISOString();
}

function uniq(items = []) {
  return [...new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean))];
}

function memoryRoot(runtime) {
  return path.join(runtime.stateDir, 'memory');
}

function taskMemoryDir(runtime, taskId) {
  return path.join(memoryRoot(runtime), 'tasks', String(taskId));
}

function taskStatePath(runtime, taskId) {
  return path.join(taskMemoryDir(runtime, taskId), 'working-memory.json');
}

function taskRecentTurnsPath(runtime, taskId) {
  return path.join(taskMemoryDir(runtime, taskId), 'recent-turns.json');
}

function taskResumeBlockPath(runtime, taskId) {
  return path.join(taskMemoryDir(runtime, taskId), 'resume-block.md');
}

function memoryIndexPath(runtime) {
  return path.join(memoryRoot(runtime), 'index.json');
}

async function ensureDir(dir) {
  await fs.mkdir(dir, {recursive: true});
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, value) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function ensureTaskState(task, taskId) {
  return {
    version: 1,
    updatedAt: nowIso(),
    taskId,
    currentTask: task?.title || `Task ${taskId}`,
    goal: task?.title || '',
    rollingSummary: '',
    unresolvedGoals: [],
    decisions: [],
    constraints: uniq([
      task?.risk ? `Risk level: ${task.risk}` : '',
      task?.workflowTemplate ? `Workflow: ${task.workflowTemplate}` : ''
    ]),
    fileTaskReferences: [],
    nextSteps: [],
    openLoops: [],
    criticalContext: [],
    milestones: []
  };
}

function ensureRecentTurns() {
  return {
    version: 1,
    updatedAt: nowIso(),
    turns: []
  };
}

function renderResumeBlock(state, recentTurns) {
  const bullets = (items) => items?.length ? items.map((item) => `- ${item}`).join('\n') : '- (none)';
  const recent = recentTurns?.turns?.length
    ? recentTurns.turns.slice(-8).map((turn) => {
        const text = String(turn.text || '').replace(/\s+/g, ' ').trim();
        return `- ${turn.role}: ${text.slice(0, 240)}${text.length > 240 ? '...' : ''}`;
      }).join('\n')
    : '- (none)';

  return [
    '# Sofia Resume Block',
    '',
    '## Active Task State',
    `- Current task: ${state.currentTask || '(unset)'}`,
    `- Goal: ${state.goal || '(unset)'}`,
    `- Rolling summary: ${state.rollingSummary || '(none)'}`,
    '',
    '## Decisions',
    bullets(state.decisions),
    '',
    '## Constraints',
    bullets(state.constraints),
    '',
    '## Unresolved Goals',
    bullets(state.unresolvedGoals),
    '',
    '## Next Steps',
    bullets(state.nextSteps),
    '',
    '## File / Task References',
    bullets(state.fileTaskReferences),
    '',
    '## Recent Turns',
    recent,
    ''
  ].join('\n');
}

async function updateIndex(runtime, task, taskId) {
  const indexPath = memoryIndexPath(runtime);
  const index = await readJson(indexPath, {version: 1, updatedAt: nowIso(), activeTaskId: '', tasks: []});
  const existing = index.tasks.find((entry) => entry.taskId === taskId);
  const nextEntry = {
    taskId,
    title: task?.title || `Task ${taskId}`,
    updatedAt: nowIso(),
    status: task?.status || 'active',
    workingMemoryPath: taskStatePath(runtime, taskId),
    recentTurnsPath: taskRecentTurnsPath(runtime, taskId),
    resumeBlockPath: taskResumeBlockPath(runtime, taskId)
  };
  if (existing) {
    Object.assign(existing, nextEntry);
  } else {
    index.tasks.push(nextEntry);
  }
  index.activeTaskId = taskId;
  index.updatedAt = nowIso();
  await writeJson(indexPath, index);
}

async function loadTaskContext(runtime, task, taskId) {
  const statePath = taskStatePath(runtime, taskId);
  const recentPath = taskRecentTurnsPath(runtime, taskId);
  const state = await readJson(statePath, ensureTaskState(task, taskId));
  const recentTurns = await readJson(recentPath, ensureRecentTurns());
  return {statePath, recentPath, state, recentTurns};
}

async function persistTaskContext(runtime, task, taskId, state, recentTurns) {
  state.updatedAt = nowIso();
  recentTurns.updatedAt = nowIso();
  await writeJson(taskStatePath(runtime, taskId), state);
  await writeJson(taskRecentTurnsPath(runtime, taskId), recentTurns);
  await ensureDir(taskMemoryDir(runtime, taskId));
  await fs.writeFile(taskResumeBlockPath(runtime, taskId), renderResumeBlock(state, recentTurns), 'utf8');
  await updateIndex(runtime, task, taskId);
}

function appendRecentTurn(recentTurns, role, text, meta = {}) {
  recentTurns.turns.push({role, text, timestamp: nowIso(), ...meta});
  recentTurns.turns = recentTurns.turns.slice(-12);
}

function pushMilestone(state, milestone) {
  state.milestones = state.milestones || [];
  state.milestones.push({timestamp: nowIso(), ...milestone});
  state.milestones = state.milestones.slice(-30);
}

export async function afterResumeHook({runtime, task, reason = 'resume'}) {
  const taskId = task?.id;
  if (!taskId) return {ok: false, skipped: true, reason: 'missing_task_id'};
  const {state, recentTurns} = await loadTaskContext(runtime, task, taskId);
  state.currentTask = task?.title || state.currentTask;
  state.goal = state.goal || task?.title || '';
  state.constraints = uniq([
    ...(state.constraints || []),
    task?.risk ? `Risk level: ${task.risk}` : '',
    task?.workflowTemplate ? `Workflow: ${task.workflowTemplate}` : ''
  ]);
  state.rollingSummary = state.rollingSummary || `Task resumed via ${reason}.`;
  state.nextSteps = uniq([...(state.nextSteps || []), 'Continue the active workflow from the current phase.']);
  appendRecentTurn(recentTurns, 'system', `Task resumed: ${task.title}`, {reason});
  await persistTaskContext(runtime, task, taskId, state, recentTurns);
  return {ok: true, taskId, hook: 'after_resume'};
}

export async function beforeCompactionHook({runtime, task, run, reason = 'before_compaction'}) {
  const taskId = task?.id;
  if (!taskId) return {ok: false, skipped: true, reason: 'missing_task_id'};
  const {state, recentTurns} = await loadTaskContext(runtime, task, taskId);
  state.currentTask = task?.title || state.currentTask;
  state.goal = state.goal || task?.title || '';
  state.rollingSummary = `Preparing compact carry-forward state before executing phase ${run?.workerRole || 'builder'}.`;
  state.constraints = uniq([
    ...(state.constraints || []),
    task?.risk ? `Risk level: ${task.risk}` : '',
    run?.modelProfile ? `Model profile: ${run.modelProfile}` : ''
  ]);
  state.nextSteps = uniq([
    ...(state.nextSteps || []),
    `Execute phase ${run?.workerRole || 'builder'} for run ${run?.id || 'unknown'}.`
  ]);
  state.fileTaskReferences = uniq([
    ...(state.fileTaskReferences || []),
    run?.id ? `.sofia/state/runs/${run.id}` : '',
    task?.id ? `.sofia/state/tasks/${task.id}` : ''
  ]);
  pushMilestone(state, {hook: 'before_compaction', runId: run?.id || null, workerRole: run?.workerRole || null, reason});
  appendRecentTurn(recentTurns, 'system', `Before compaction hook for ${task.title} / phase ${run?.workerRole || 'builder'}`, {runId: run?.id || null});
  await persistTaskContext(runtime, task, taskId, state, recentTurns);
  return {ok: true, taskId, hook: 'before_compaction'};
}

export async function afterMilestoneHook({runtime, task, run, milestone, detail = ''}) {
  const taskId = task?.id;
  if (!taskId) return {ok: false, skipped: true, reason: 'missing_task_id'};
  const {state, recentTurns} = await loadTaskContext(runtime, task, taskId);
  state.currentTask = task?.title || state.currentTask;
  state.goal = state.goal || task?.title || '';
  state.rollingSummary = detail || state.rollingSummary || `Milestone reached: ${milestone}`;

  if (milestone === 'execution_completed') {
    state.decisions = uniq([...(state.decisions || []), `Completed phase ${run?.workerRole || 'builder'} for run ${run?.id || 'unknown'}.`]);
    state.nextSteps = uniq([...(state.nextSteps || []), 'Proceed to the next queued phase or finalize the workflow.']);
  } else if (milestone === 'execution_failed') {
    state.openLoops = uniq([...(state.openLoops || []), `Investigate failed run ${run?.id || 'unknown'}.`]);
    state.nextSteps = uniq([...(state.nextSteps || []), 'Inspect failure details and decide whether to retry or request approval.']);
  } else if (milestone === 'approval_requested') {
    state.unresolvedGoals = uniq([...(state.unresolvedGoals || []), 'Await approval before continuing the workflow.']);
  } else if (milestone === 'workflow_completed') {
    state.decisions = uniq([...(state.decisions || []), `Workflow completed for task ${task?.title || taskId}.`]);
    state.unresolvedGoals = [];
    state.nextSteps = uniq([...(state.nextSteps || []), 'Archive artifacts and prepare final report.']);
  } else if (milestone === 'next_phase_enqueued') {
    state.nextSteps = uniq([...(state.nextSteps || []), `Next phase enqueued after ${run?.workerRole || 'builder'}.`]);
  }

  state.fileTaskReferences = uniq([
    ...(state.fileTaskReferences || []),
    run?.id ? `.sofia/artifacts/${run.id}` : '',
    task?.id ? `.sofia/state/tasks/${task.id}` : ''
  ]);
  pushMilestone(state, {hook: 'after_milestone', milestone, runId: run?.id || null, workerRole: run?.workerRole || null, detail});
  appendRecentTurn(recentTurns, 'system', `${milestone}: ${detail || task?.title || taskId}`, {runId: run?.id || null});
  await persistTaskContext(runtime, task, taskId, state, recentTurns);
  return {ok: true, taskId, hook: 'after_milestone', milestone};
}

export async function safeMemoryHook(fn, payload) {
  try {
    return await fn(payload);
  } catch (error) {
    return {
      ok: false,
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error)
      }
    };
  }
}

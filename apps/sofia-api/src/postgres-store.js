import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';

import pg from 'pg';

import {resolveModelProfile} from '../../../packages/policy-engine/src/index.js';

const {Pool} = pg;
const schemaInitState = new Map();
const TASK_RETURNING_COLUMNS = [
  'id',
  'project_id',
  'template_id',
  'title',
  'risk',
  'workflow_template',
  'current_phase',
  'status',
  'created_at',
  'updated_at'
].join(', ');
const RUN_RETURNING_COLUMNS = [
  'id',
  'task_id',
  'status',
  'worker_role',
  'model_profile',
  'phase_index',
  'storage_mode',
  'attempt_count',
  'lease_owner',
  'lease_expires_at',
  'last_heartbeat_at',
  'next_retry_at',
  'dead_letter_reason',
  'dead_lettered_at',
  'created_at',
  'updated_at'
].join(', ');
const DEFAULT_WORKFLOW_TEMPLATE = 'planner_builder_verifier';
const WORKFLOW_TEMPLATES = {
  planner_builder_verifier: ['planner', 'builder', 'verifier'],
  builder_only: ['builder']
};
const INITIAL_SCHEMA_VERSION = '001_initial_schema.sql';

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function rowToTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    templateId: row.template_id || 'default',
    title: row.title,
    risk: row.risk,
    workflowTemplate: row.workflow_template || DEFAULT_WORKFLOW_TEMPLATE,
    currentPhase: row.current_phase || 'planner',
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    storageMode: 'postgres'
  };
}

function rowToRun(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    status: row.status,
    workerRole: row.worker_role,
    modelProfile: row.model_profile,
    phaseIndex: row.phase_index ?? 0,
    storageMode: row.storage_mode || 'postgres',
    attemptCount: row.attempt_count ?? 0,
    leaseOwner: row.lease_owner ?? null,
    leaseExpiresAt: row.lease_expires_at ?? null,
    lastHeartbeatAt: row.last_heartbeat_at ?? null,
    nextRetryAt: row.next_retry_at ?? null,
    deadLetterReason: row.dead_letter_reason ?? null,
    deadLetteredAt: row.dead_lettered_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToRunStep(row) {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    stepName: row.step_name,
    status: row.status,
    details: row.details || {},
    createdAt: row.created_at
  };
}

function rowToDecision(row) {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    category: row.category,
    subject: row.subject,
    outcome: row.outcome,
    evidence: row.evidence || {},
    createdAt: row.created_at
  };
}

function rowToUsage(row) {
  if (!row) return null;
  return {
    id: row.id,
    runId: row.run_id,
    modelProfile: row.model_profile,
    provider: row.provider,
    fallbackDepth: row.fallback_depth,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    createdAt: row.created_at
  };
}

function rowToApproval(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.task_id,
    requestedByRunId: row.requested_by_run_id,
    phaseName: row.phase_name,
    status: row.status,
    channel: row.channel ?? null,
    target: row.target ?? null,
    decisionBy: row.decision_by ?? null,
    note: row.note ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decidedAt: row.decided_at ?? null
  };
}

function normalizeWorkflowTemplate(template) {
  const normalized = String(template || DEFAULT_WORKFLOW_TEMPLATE).trim().toLowerCase();
  return WORKFLOW_TEMPLATES[normalized] ? normalized : DEFAULT_WORKFLOW_TEMPLATE;
}

function getWorkflowPhases(template) {
  return WORKFLOW_TEMPLATES[normalizeWorkflowTemplate(template)];
}

function getPhaseIndexForRole(template, workerRole) {
  return getWorkflowPhases(template).indexOf(String(workerRole || '').trim().toLowerCase());
}

function resolveNextWorkerRole(currentRole, template) {
  const phases = getWorkflowPhases(template);
  const currentIndex = getPhaseIndexForRole(template, currentRole);
  if (currentIndex < 0) {
    return null;
  }
  return phases[currentIndex + 1] || null;
}

function requiresApproval(task, nextWorkerRole) {
  const risk = String(task?.risk || '').trim().toLowerCase();
  const role = String(nextWorkerRole || '').trim().toLowerCase();
  return (risk === 'high' || risk === 'critical') && role === 'builder';
}

export function createPostgresStore(
  databaseUrl = process.env.SOFIA_DATABASE_URL || 'postgres://sofia:sofia@127.0.0.1:5432/sofia'
) {
  if (!databaseUrl) {
    throw new Error('SOFIA_DATABASE_URL is required for PostgreSQL mode');
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500
  });
  return {
    pool,
    databaseUrl
  };
}

export async function closePostgresStore(store) {
  if (store?.pool) {
    await store.pool.end();
  }
}

async function withTransaction(store, callback) {
  const client = await store.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Ignore rollback cleanup failures and surface the original error.
    }
    throw error;
  } finally {
    client.release();
  }
}

async function insertRunStepQuery(client, runId, stepName, status, details = {}) {
  const result = await client.query(
    `
      INSERT INTO run_steps (id, run_id, step_name, status, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, run_id, step_name, status, details, created_at
    `,
    [createId('step'), runId, stepName, status, details]
  );
  return rowToRunStep(result.rows[0]);
}

async function insertDecisionQuery(client, runId, category, subject, outcome, evidence = {}) {
  const result = await client.query(
    `
      INSERT INTO decisions (id, run_id, category, subject, outcome, evidence)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, run_id, category, subject, outcome, evidence, created_at
    `,
    [createId('decision'), runId, category, subject, outcome, evidence]
  );
  return rowToDecision(result.rows[0]);
}

async function deadLetterRunQuery(client, runId, reason, details = {}) {
  const runResult = await client.query(
    `
      UPDATE runs
      SET status = 'dead_lettered',
          lease_owner = NULL,
          lease_expires_at = NULL,
          next_retry_at = NULL,
          dead_letter_reason = $2,
          dead_lettered_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING ${RUN_RETURNING_COLUMNS}
    `,
    [runId, reason]
  );
  const run = rowToRun(runResult.rows[0]);

  await client.query(
    `
      UPDATE tasks
      SET status = 'failed',
          current_phase = 'dead_lettered',
          updated_at = NOW()
      WHERE id = $1
    `,
    [run.taskId]
  );

  const artifactId = createId('artifact');
  await client.query(
    `
      INSERT INTO artifacts (id, run_id, kind, uri)
      VALUES ($1, $2, $3, $4)
    `,
    [artifactId, runId, 'error', reason]
  );

  await insertRunStepQuery(client, runId, 'dead_lettered', 'failed', {
    reason,
    ...details,
    attemptCount: run.attemptCount
  });

  if (details.failureClass || details.retryAction) {
    await insertDecisionQuery(client, runId, 'durability', 'retry_policy', 'classified', {
      failureClass: details.failureClass || 'manual_review',
      retryAction: details.retryAction || 'manual_review',
      recommendedBackoffSeconds: details.recommendedBackoffSeconds ?? 0,
      reason
    });
  }

  return {
    run,
    errorArtifact: {
      id: artifactId,
      kind: 'error',
      uri: reason
    }
  };
}

function resolveBackoffSeconds(attemptCount, options = {}) {
  const baseSeconds = Math.max(0, Number(options.backoffBaseSeconds || process.env.SOFIA_RUN_BACKOFF_BASE_SECONDS || 5));
  const maxSeconds = Math.max(baseSeconds, Number(options.backoffMaxSeconds || process.env.SOFIA_RUN_BACKOFF_MAX_SECONDS || 60));

  if (attemptCount <= 1 || baseSeconds === 0) {
    return 0;
  }

  return Math.min(maxSeconds, baseSeconds * 2 ** (attemptCount - 2));
}

function classifyFailurePolicy(errorMessage, options = {}) {
  const message = String(errorMessage || '')
    .trim()
    .toLowerCase();
  const baseSeconds = Math.max(0, Number(options.backoffBaseSeconds || process.env.SOFIA_RUN_BACKOFF_BASE_SECONDS || 5));

  if (!message) {
    return {
      class: 'manual_review',
      action: 'manual_review',
      recommendedBackoffSeconds: baseSeconds
    };
  }

  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('rate limit') ||
    message.includes('temporar') ||
    message.includes('connection reset') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('econnrefused') ||
    message.includes('network')
  ) {
    return {
      class: 'transient',
      action: 'retry',
      recommendedBackoffSeconds: Math.max(baseSeconds, 15)
    };
  }

  if (
    message.includes('no active credentials') ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('invalid api key') ||
    message.includes('config invalid') ||
    message.includes('not valid for workflow') ||
    message.includes('awaiting approval')
  ) {
    return {
      class: 'permanent',
      action: 'manual_fix_required',
      recommendedBackoffSeconds: 0
    };
  }

  return {
    class: 'manual_review',
    action: 'manual_review',
    recommendedBackoffSeconds: baseSeconds
  };
}

export async function probePostgres(store) {
  const startedAt = Date.now();
  try {
    const result = await store.pool.query('select current_database() as name, current_user as current_user');
    return {
      ok: true,
      durationMs: Date.now() - startedAt,
      database: result.rows[0]?.name || null,
      user: result.rows[0]?.current_user || null
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Date.now() - startedAt,
      error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        code: error?.code ?? null
      }
    };
  }
}

export async function ensureSchema(store) {
  const key = store?.databaseUrl || 'default';
  if (!schemaInitState.has(key)) {
    schemaInitState.set(
      key,
      (async () => {
        const sqlPath = fileURLToPath(new URL('../../../sql/001_initial_schema.sql', import.meta.url));
        const sql = await fs.readFile(sqlPath, 'utf8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');
        await store.pool.query(`
          CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            checksum TEXT NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )
        `);
        const existing = await store.pool.query(
          `
            SELECT version, checksum, applied_at
            FROM schema_migrations
            WHERE version = $1
          `,
          [INITIAL_SCHEMA_VERSION]
        );
        if (existing.rows[0]?.checksum === checksum) {
          return;
        }

        await withTransaction(store, async (client) => {
          await client.query(sql);
          await client.query(
            `
              INSERT INTO schema_migrations (version, checksum, applied_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (version)
              DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = EXCLUDED.applied_at
            `,
            [INITIAL_SCHEMA_VERSION, checksum]
          );
        });
      })().catch((error) => {
        schemaInitState.delete(key);
        throw error;
      })
    );
  }

  await schemaInitState.get(key);
}

export async function listSchemaMigrations(store) {
  await ensureSchema(store);
  const result = await store.pool.query(
    `
      SELECT version, checksum, applied_at
      FROM schema_migrations
      ORDER BY applied_at ASC, version ASC
    `
  );
  return result.rows.map((row) => ({
    version: row.version,
    checksum: row.checksum,
    appliedAt: row.applied_at
  }));
}

export async function ensureDefaultProject(store, projectId = 'project_sofia_default') {
  await store.pool.query(
    `
      INSERT INTO projects (id, name)
      VALUES ($1, $2)
      ON CONFLICT (id) DO NOTHING
    `,
    [projectId, 'Sofia Default Project']
  );
  return projectId;
}

export async function createTaskInPostgres(store, input = {}) {
  const projectId = await ensureDefaultProject(store);
  const taskId = createId('task');
  const templateId = String(input.templateId || 'default').trim().toLowerCase();
  const workflowTemplate = normalizeWorkflowTemplate(input.workflowTemplate);
  const initialPhase = getWorkflowPhases(workflowTemplate)[0] || 'builder';
  const result = await store.pool.query(
    `
      INSERT INTO tasks (id, project_id, template_id, title, risk, workflow_template, current_phase, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'created')
      RETURNING ${TASK_RETURNING_COLUMNS}
    `,
    [taskId, projectId, templateId, input.title || 'Scaffold task', input.risk || 'medium', workflowTemplate, initialPhase]
  );
  return rowToTask(result.rows[0]);
}

export async function getTaskFromPostgres(store, taskId) {
  const result = await store.pool.query(
    `
      SELECT ${TASK_RETURNING_COLUMNS}
      FROM tasks
      WHERE id = $1
    `,
    [taskId]
  );
  return rowToTask(result.rows[0]);
}

export async function listTaskRuns(store, taskId) {
  const result = await store.pool.query(
    `
      SELECT ${RUN_RETURNING_COLUMNS}
      FROM runs
      WHERE task_id = $1
      ORDER BY phase_index ASC, created_at ASC
    `,
    [taskId]
  );
  return result.rows.map((row) => rowToRun(row));
}

export async function listRunsInPostgres(store, options = {}) {
  const params = [];
  const conditions = [];

  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }

  if (options.taskId) {
    params.push(options.taskId);
    conditions.push(`task_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(100, Number(options.limit || 25)));
  params.push(limit);

  const result = await store.pool.query(
    `
      SELECT ${RUN_RETURNING_COLUMNS}
      FROM runs
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows.map((row) => rowToRun(row));
}

export async function listTaskApprovals(store, taskId) {
  const result = await store.pool.query(
    `
      SELECT id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
      FROM approvals
      WHERE task_id = $1
      ORDER BY created_at ASC
    `,
    [taskId]
  );
  return result.rows.map((row) => rowToApproval(row));
}

export async function listTasksInPostgres(store, options = {}) {
  const params = [];
  const conditions = [];
  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(100, Number(options.limit || 25)));
  params.push(limit);

  const result = await store.pool.query(
    `
      SELECT ${TASK_RETURNING_COLUMNS}
      FROM tasks
      ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows.map((row) => rowToTask(row));
}

export async function listPendingApprovalsInPostgres(store, options = {}) {
  const limit = Math.max(1, Math.min(100, Number(options.limit || 25)));
  const result = await store.pool.query(
    `
      SELECT id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
      FROM approvals
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT $1
    `,
    [limit]
  );
  return result.rows.map((row) => rowToApproval(row));
}

export async function listApprovalsInPostgres(store, options = {}) {
  const params = [];
  const conditions = [];

  if (options.status) {
    params.push(options.status);
    conditions.push(`status = $${params.length}`);
  }

  if (options.taskId) {
    params.push(options.taskId);
    conditions.push(`task_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(100, Number(options.limit || 25)));
  params.push(limit);

  const result = await store.pool.query(
    `
      SELECT id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
      FROM approvals
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length}
    `,
    params
  );
  return result.rows.map((row) => rowToApproval(row));
}

export async function summarizeRuntimeInPostgres(store) {
  const [taskCountsResult, runCountsResult, approvalsResult] = await Promise.all([
    store.pool.query(
      `
        SELECT status, COUNT(*)::int AS total
        FROM tasks
        GROUP BY status
      `
    ),
    store.pool.query(
      `
        SELECT status, COUNT(*)::int AS total
        FROM runs
        GROUP BY status
      `
    ),
    store.pool.query(
      `
        SELECT COUNT(*)::int AS pending_approvals
        FROM approvals
        WHERE status = 'pending'
      `
    )
  ]);

  return {
    tasksByStatus: Object.fromEntries(taskCountsResult.rows.map((row) => [row.status, row.total])),
    runsByStatus: Object.fromEntries(runCountsResult.rows.map((row) => [row.status, row.total])),
    pendingApprovals: approvalsResult.rows[0]?.pending_approvals ?? 0
  };
}

export async function approveTaskInPostgres(store, taskId, input = {}) {
  return withTransaction(store, async (client) => {
    const approvalResult = await client.query(
      `
        SELECT id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
        FROM approvals
        WHERE task_id = $1
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE
      `,
      [taskId]
    );
    const approval = rowToApproval(approvalResult.rows[0]);
    if (!approval) {
      throw new Error(`No pending approval found for task ${taskId}`);
    }

    const taskResult = await client.query(
      `
        SELECT ${TASK_RETURNING_COLUMNS}
        FROM tasks
        WHERE id = $1
      `,
      [taskId]
    );
    const task = rowToTask(taskResult.rows[0]);
    const phaseIndex = getPhaseIndexForRole(task.workflowTemplate, approval.phaseName);
    const modelProfile = resolveModelProfile({role: approval.phaseName, risk: task.risk});

    const updatedApprovalResult = await client.query(
      `
        UPDATE approvals
        SET status = 'approved',
            decision_by = $2,
            note = $3,
            updated_at = NOW(),
            decided_at = NOW()
        WHERE id = $1
        RETURNING id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
      `,
      [approval.id, input.decisionBy || 'operator', input.note || 'approved']
    );
    const updatedApproval = rowToApproval(updatedApprovalResult.rows[0]);

    const taskUpdateResult = await client.query(
      `
        UPDATE tasks
        SET status = 'queued',
            current_phase = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${TASK_RETURNING_COLUMNS}
      `,
      [taskId, approval.phaseName]
    );
    const updatedTask = rowToTask(taskUpdateResult.rows[0]);

    const nextRunId = createId('run');
    const nextRunResult = await client.query(
      `
        INSERT INTO runs (id, task_id, status, worker_role, model_profile, phase_index, storage_mode)
        VALUES ($1, $2, 'queued', $3, $4, $5, 'postgres')
        RETURNING ${RUN_RETURNING_COLUMNS}
      `,
      [nextRunId, taskId, approval.phaseName, modelProfile, phaseIndex]
    );
    const nextRun = rowToRun(nextRunResult.rows[0]);

    await insertRunStepQuery(client, nextRun.id, 'queued', 'completed', {
      taskStatus: 'queued',
      workerRole: approval.phaseName,
      phaseIndex,
      workflowTemplate: task.workflowTemplate,
      currentPhase: approval.phaseName,
      requestedProfile: modelProfile,
      approvalId: approval.id,
      previousRunId: approval.requestedByRunId
    });

    await insertDecisionQuery(client, nextRun.id, 'routing', 'requested_profile', 'selected', {
      role: approval.phaseName,
      risk: task.risk,
      requestedProfile: modelProfile,
      degraded: modelProfile === 'sofia-free-fallback'
    });

    await insertDecisionQuery(client, nextRun.id, 'workflow', 'phase_selected', 'queued', {
      workflowTemplate: task.workflowTemplate,
      currentPhase: approval.phaseName,
      phaseIndex,
      previousRunId: approval.requestedByRunId,
      approvalId: approval.id
    });

    if (approval.requestedByRunId) {
      await insertDecisionQuery(client, approval.requestedByRunId, 'workflow', 'approval_decision', 'approved', {
        approvalId: approval.id,
        decisionBy: updatedApproval.decisionBy,
        gatedPhase: approval.phaseName
      });
    }

    return {
      task: updatedTask,
      approval: updatedApproval,
      run: nextRun
    };
  });
}

export async function rejectTaskInPostgres(store, taskId, input = {}) {
  return withTransaction(store, async (client) => {
    const approvalResult = await client.query(
      `
        SELECT id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
        FROM approvals
        WHERE task_id = $1
          AND status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE
      `,
      [taskId]
    );
    const approval = rowToApproval(approvalResult.rows[0]);
    if (!approval) {
      throw new Error(`No pending approval found for task ${taskId}`);
    }

    const updatedApprovalResult = await client.query(
      `
        UPDATE approvals
        SET status = 'rejected',
            decision_by = $2,
            note = $3,
            updated_at = NOW(),
            decided_at = NOW()
        WHERE id = $1
        RETURNING id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
      `,
      [approval.id, input.decisionBy || 'operator', input.note || 'rejected']
    );
    const updatedApproval = rowToApproval(updatedApprovalResult.rows[0]);

    const taskUpdateResult = await client.query(
      `
        UPDATE tasks
        SET status = 'failed',
            current_phase = 'rejected',
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${TASK_RETURNING_COLUMNS}
      `,
      [taskId]
    );
    const updatedTask = rowToTask(taskUpdateResult.rows[0]);

    if (approval.requestedByRunId) {
      await insertDecisionQuery(client, approval.requestedByRunId, 'workflow', 'approval_decision', 'rejected', {
        approvalId: approval.id,
        decisionBy: updatedApproval.decisionBy,
        gatedPhase: approval.phaseName,
        note: updatedApproval.note
      });
    }

    return {
      task: updatedTask,
      approval: updatedApproval
    };
  });
}

export async function queueTaskRunInPostgres(store, taskId, options = {}) {
  const task = await getTaskFromPostgres(store, taskId);
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  if (task.status === 'awaiting_approval') {
    throw new Error(`Task ${taskId} is awaiting approval for phase ${task.currentPhase}`);
  }
  if (task.status === 'completed' || task.status === 'failed') {
    throw new Error(`Task ${taskId} is already ${task.status}`);
  }

  const workerRole = String(options.workerRole || task.currentPhase || '').trim().toLowerCase();
  const phaseIndex = getPhaseIndexForRole(task.workflowTemplate, workerRole);
  if (phaseIndex < 0) {
    throw new Error(`Worker role ${workerRole || '(missing)'} is not valid for workflow ${task.workflowTemplate}`);
  }

  const runId = createId('run');
  const modelProfile = resolveModelProfile({role: workerRole, risk: task.risk});

  return withTransaction(store, async (client) => {
    await client.query(
      `
        UPDATE tasks
        SET status = 'queued',
            current_phase = $2,
            updated_at = NOW()
        WHERE id = $1
      `,
      [taskId, workerRole]
    );

    const runResult = await client.query(
      `
        INSERT INTO runs (id, task_id, status, worker_role, model_profile, phase_index, storage_mode)
        VALUES ($1, $2, 'queued', $3, $4, $5, 'postgres')
        RETURNING ${RUN_RETURNING_COLUMNS}
      `,
      [runId, taskId, workerRole, modelProfile, phaseIndex]
    );

    await insertRunStepQuery(client, runId, 'queued', 'completed', {
      taskStatus: 'queued',
      workerRole,
      phaseIndex,
      workflowTemplate: task.workflowTemplate,
      currentPhase: workerRole,
      requestedProfile: modelProfile
    });

    await insertDecisionQuery(client, runId, 'routing', 'requested_profile', 'selected', {
      role: workerRole,
      risk: task.risk,
      requestedProfile: modelProfile,
      degraded: modelProfile === 'sofia-free-fallback'
    });

    await insertDecisionQuery(client, runId, 'workflow', 'phase_selected', 'queued', {
      workflowTemplate: task.workflowTemplate,
      currentPhase: workerRole,
      phaseIndex
    });

    return {
      task: {
        ...task,
        status: 'queued',
        currentPhase: workerRole
      },
      run: rowToRun(runResult.rows[0])
    };
  });
}

export async function startRunInPostgres(store, runId, options = {}) {
  const workerId = options.workerId || `worker-${process.pid}`;
  const leaseSeconds = Math.max(1, Number(options.leaseSeconds || process.env.SOFIA_RUN_LEASE_SECONDS || 90));
  const backoffSeconds = resolveBackoffSeconds(1, options);
  return withTransaction(store, async (client) => {
    const result = await client.query(
      `
        UPDATE runs
        SET status = 'running',
            attempt_count = attempt_count + 1,
            lease_owner = $2,
            lease_expires_at = NOW() + make_interval(secs => $3::int),
            last_heartbeat_at = NOW(),
            next_retry_at = NOW() + make_interval(secs => ($3::int + $4::int)),
            dead_letter_reason = NULL,
            dead_lettered_at = NULL,
            updated_at = NOW()
        WHERE id = $1
          AND status = 'queued'
        RETURNING ${RUN_RETURNING_COLUMNS}
      `,
      [runId, workerId, leaseSeconds, backoffSeconds]
    );
    const run = rowToRun(result.rows[0]);
    if (!run) {
      return null;
    }
    await insertRunStepQuery(client, runId, 'running', 'completed', {
      taskId: run.taskId,
      workerRole: run.workerRole,
      requestedProfile: run.modelProfile,
      workerId,
      leaseSeconds,
      backoffSeconds,
      attemptCount: run.attemptCount,
      nextRetryAt: run.nextRetryAt
    });
    return run;
  });
}

export async function claimStaleRunInPostgres(store, options = {}) {
  const workerId = options.workerId || `worker-${process.pid}`;
  const leaseSeconds = Math.max(1, Number(options.leaseSeconds || process.env.SOFIA_RUN_LEASE_SECONDS || 90));
  const maxAttempts = Math.max(1, Number(options.maxAttempts || process.env.SOFIA_RUN_MAX_ATTEMPTS || 3));
  const targetRunId = options.runId || null;

  return withTransaction(store, async (client) => {
    const candidateParams = [];
    let runFilter = '';
    if (targetRunId) {
      candidateParams.push(targetRunId);
      runFilter = `AND id = $${candidateParams.length}`;
    }

    const candidateResult = await client.query(
      `
        SELECT ${RUN_RETURNING_COLUMNS}
        FROM runs
        WHERE status = 'running'
          AND lease_expires_at IS NOT NULL
          AND lease_expires_at < NOW()
          AND (next_retry_at IS NULL OR next_retry_at < NOW())
          ${runFilter}
        ORDER BY lease_expires_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `,
      candidateParams
    );

    const candidate = rowToRun(candidateResult.rows[0]);
    if (!candidate) {
      return null;
    }

    if (candidate.attemptCount >= maxAttempts) {
      const reason = `Stale run exceeded retry cap after ${candidate.attemptCount} attempts`;
      const deadLettered = await deadLetterRunQuery(client, candidate.id, reason, {
        workerId,
        leaseSeconds,
        maxAttempts,
        previousAttemptCount: candidate.attemptCount
      });
      return {
        ...deadLettered.run,
        deadLettered: true,
        deadLetterReason: reason,
        errorArtifact: deadLettered.errorArtifact
      };
    }

    const nextAttemptCount = candidate.attemptCount + 1;
    const backoffSeconds = resolveBackoffSeconds(nextAttemptCount, options);
    const result = await client.query(
      `
        UPDATE runs
        SET attempt_count = attempt_count + 1,
            lease_owner = $2,
            lease_expires_at = NOW() + make_interval(secs => $3::int),
            last_heartbeat_at = NOW(),
            next_retry_at = NOW() + make_interval(secs => ($3::int + $4::int)),
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${RUN_RETURNING_COLUMNS}
      `,
      [candidate.id, workerId, leaseSeconds, backoffSeconds]
    );

    const run = rowToRun(result.rows[0]);
    if (!run) {
      return null;
    }

    await insertRunStepQuery(client, run.id, 'lease_reclaimed', 'completed', {
      workerId,
      leaseSeconds,
      backoffSeconds,
      attemptCount: run.attemptCount,
      nextRetryAt: run.nextRetryAt
    });

    return run;
  });
}

export async function heartbeatRunLease(store, runId, options = {}) {
  const workerId = options.workerId || `worker-${process.pid}`;
  const leaseSeconds = Math.max(1, Number(options.leaseSeconds || process.env.SOFIA_RUN_LEASE_SECONDS || 90));
  const backoffSeconds = resolveBackoffSeconds(Math.max(1, Number(options.attemptCount || 1)), options);
  const result = await store.pool.query(
    `
      UPDATE runs
      SET lease_expires_at = NOW() + make_interval(secs => $3::int),
          last_heartbeat_at = NOW(),
          next_retry_at = NOW() + make_interval(secs => ($3::int + $4::int)),
          updated_at = NOW()
      WHERE id = $1
        AND status = 'running'
        AND lease_owner = $2
      RETURNING ${RUN_RETURNING_COLUMNS}
    `,
    [runId, workerId, leaseSeconds, backoffSeconds]
  );
  return rowToRun(result.rows[0]);
}

export async function completeRunInPostgres(store, runId, artifact, usageInfo = {}) {
  return withTransaction(store, async (client) => {
    const runResult = await client.query(
      `
        UPDATE runs
        SET status = 'completed',
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_retry_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${RUN_RETURNING_COLUMNS}
      `,
      [runId]
    );
    const run = rowToRun(runResult.rows[0]);
    const taskResult = await client.query(
      `
        SELECT ${TASK_RETURNING_COLUMNS}
        FROM tasks
        WHERE id = $1
      `,
      [run.taskId]
    );
    const task = rowToTask(taskResult.rows[0]);

    const artifactId = createId('artifact');
    await client.query(
      `
        INSERT INTO artifacts (id, run_id, kind, uri)
        VALUES ($1, $2, $3, $4)
      `,
      [artifactId, runId, artifact.kind, artifact.uri]
    );

    const usageId = createId('usage');
    await client.query(
      `
        INSERT INTO provider_usage (id, run_id, model_profile, provider, fallback_depth, tokens_in, tokens_out)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        usageId,
        runId,
        usageInfo.modelProfile || run.modelProfile,
        usageInfo.provider || 'router9',
        usageInfo.fallbackDepth || 0,
        usageInfo.tokensIn || 0,
        usageInfo.tokensOut || 0
      ]
    );

    await insertRunStepQuery(client, runId, 'completed', 'completed', {
      artifactKind: artifact.kind,
      artifactUri: artifact.uri,
      phaseIndex: run.phaseIndex,
      workerRole: run.workerRole,
      provider: usageInfo.provider || 'router9',
      modelProfile: usageInfo.modelProfile || run.modelProfile,
      fallbackDepth: usageInfo.fallbackDepth || 0,
      tokensIn: usageInfo.tokensIn || 0,
      tokensOut: usageInfo.tokensOut || 0
    });

    const nextWorkerRole = resolveNextWorkerRole(run.workerRole, task.workflowTemplate);
    let nextRun = null;
    let nextTask = null;
    let pendingApproval = null;

    if (nextWorkerRole) {
      if (requiresApproval(task, nextWorkerRole)) {
        const taskUpdateResult = await client.query(
          `
            UPDATE tasks
            SET status = 'awaiting_approval',
                current_phase = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING ${TASK_RETURNING_COLUMNS}
          `,
          [run.taskId, nextWorkerRole]
        );
        nextTask = rowToTask(taskUpdateResult.rows[0]);

        const approvalResult = await client.query(
          `
            INSERT INTO approvals (id, task_id, requested_by_run_id, phase_name, status, channel, target, note)
            VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
            RETURNING id, task_id, requested_by_run_id, phase_name, status, channel, target, decision_by, note, created_at, updated_at, decided_at
          `,
          [
            createId('approval'),
            run.taskId,
            run.id,
            nextWorkerRole,
            'telegram',
            process.env.SOFIA_REPORT_TARGET || null,
            `Approval required before phase ${nextWorkerRole}`
          ]
        );
        pendingApproval = rowToApproval(approvalResult.rows[0]);

        await insertDecisionQuery(client, run.id, 'workflow', 'approval_required', 'pending', {
          workflowTemplate: task.workflowTemplate,
          completedPhase: run.workerRole,
          gatedPhase: nextWorkerRole,
          approvalId: pendingApproval.id
        });
      } else {
        const nextPhaseIndex = getPhaseIndexForRole(task.workflowTemplate, nextWorkerRole);
        const nextModelProfile = resolveModelProfile({role: nextWorkerRole, risk: task.risk});

        const taskUpdateResult = await client.query(
          `
            UPDATE tasks
            SET status = 'queued',
                current_phase = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING ${TASK_RETURNING_COLUMNS}
          `,
          [run.taskId, nextWorkerRole]
        );
        nextTask = rowToTask(taskUpdateResult.rows[0]);

        const nextRunId = createId('run');
        const nextRunResult = await client.query(
          `
            INSERT INTO runs (id, task_id, status, worker_role, model_profile, phase_index, storage_mode)
            VALUES ($1, $2, 'queued', $3, $4, $5, 'postgres')
            RETURNING ${RUN_RETURNING_COLUMNS}
          `,
          [nextRunId, run.taskId, nextWorkerRole, nextModelProfile, nextPhaseIndex]
        );
        nextRun = rowToRun(nextRunResult.rows[0]);

        await insertRunStepQuery(client, nextRun.id, 'queued', 'completed', {
          taskStatus: 'queued',
          workerRole: nextWorkerRole,
          phaseIndex: nextPhaseIndex,
          workflowTemplate: task.workflowTemplate,
          currentPhase: nextWorkerRole,
          requestedProfile: nextModelProfile,
          previousRunId: run.id
        });

        await insertDecisionQuery(client, nextRun.id, 'routing', 'requested_profile', 'selected', {
          role: nextWorkerRole,
          risk: task.risk,
          requestedProfile: nextModelProfile,
          degraded: nextModelProfile === 'sofia-free-fallback'
        });

        await insertDecisionQuery(client, nextRun.id, 'workflow', 'phase_selected', 'queued', {
          workflowTemplate: task.workflowTemplate,
          currentPhase: nextWorkerRole,
          phaseIndex: nextPhaseIndex,
          previousRunId: run.id
        });

        await insertDecisionQuery(client, run.id, 'workflow', 'phase_transition', 'queued_next_phase', {
          workflowTemplate: task.workflowTemplate,
          completedPhase: run.workerRole,
          nextPhase: nextWorkerRole,
          nextRunId: nextRun.id
        });
      }
    } else {
      const taskUpdateResult = await client.query(
        `
          UPDATE tasks
          SET status = 'completed',
              current_phase = 'completed',
              updated_at = NOW()
          WHERE id = $1
          RETURNING ${TASK_RETURNING_COLUMNS}
        `,
        [run.taskId]
      );
      nextTask = rowToTask(taskUpdateResult.rows[0]);

      await insertDecisionQuery(client, run.id, 'workflow', 'phase_transition', 'workflow_completed', {
        workflowTemplate: task.workflowTemplate,
        completedPhase: run.workerRole
      });
    }

    return {
      run,
      task: nextTask,
      artifact: {
        id: artifactId,
        kind: artifact.kind,
        uri: artifact.uri
      },
      usage: {
        id: usageId,
        runId,
        provider: usageInfo.provider || 'router9',
        modelProfile: usageInfo.modelProfile || run.modelProfile,
        fallbackDepth: usageInfo.fallbackDepth || 0,
        tokensIn: usageInfo.tokensIn || 0,
        tokensOut: usageInfo.tokensOut || 0
      },
      nextRun,
      pendingApproval
    };
  });
}

export async function failRunInPostgres(store, runId, errorMessage) {
  return withTransaction(store, async (client) => {
    const failurePolicy = classifyFailurePolicy(errorMessage);
    const runResult = await client.query(
      `
        UPDATE runs
        SET status = 'failed',
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_retry_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${RUN_RETURNING_COLUMNS}
      `,
      [runId]
    );
    const run = rowToRun(runResult.rows[0]);

    await client.query(
      `
        UPDATE tasks
        SET status = 'failed',
            current_phase = 'failed',
            updated_at = NOW()
        WHERE id = $1
      `,
      [run.taskId]
    );

    const artifactId = createId('artifact');
    await client.query(
      `
        INSERT INTO artifacts (id, run_id, kind, uri)
        VALUES ($1, $2, $3, $4)
      `,
      [artifactId, runId, 'error', errorMessage]
    );

    await insertRunStepQuery(client, runId, 'failed', 'failed', {
      error: errorMessage,
      failureClass: failurePolicy.class,
      retryAction: failurePolicy.action,
      recommendedBackoffSeconds: failurePolicy.recommendedBackoffSeconds
    });

    await insertDecisionQuery(client, runId, 'durability', 'retry_policy', 'classified', {
      failureClass: failurePolicy.class,
      retryAction: failurePolicy.action,
      recommendedBackoffSeconds: failurePolicy.recommendedBackoffSeconds,
      reason: errorMessage
    });

    return {
      run,
      errorArtifact: {
        id: artifactId,
        kind: 'error',
        uri: errorMessage
      },
      failurePolicy
    };
  });
}

export async function recordRunStep(store, runId, stepName, status, details = {}) {
  return insertRunStepQuery(store.pool, runId, stepName, status, details);
}

export async function recordArtifact(store, runId, artifact) {
  const result = await store.pool.query(
    `
      INSERT INTO artifacts (id, run_id, kind, uri)
      VALUES ($1, $2, $3, $4)
      RETURNING id, run_id, kind, uri, created_at
    `,
    [createId('artifact'), runId, artifact.kind, artifact.uri]
  );
  return {
    id: result.rows[0].id,
    runId: result.rows[0].run_id,
    kind: result.rows[0].kind,
    uri: result.rows[0].uri,
    createdAt: result.rows[0].created_at
  };
}

export async function listRunSteps(store, runId) {
  const result = await store.pool.query(
    `
      SELECT id, run_id, step_name, status, details, created_at
      FROM run_steps
      WHERE run_id = $1
      ORDER BY created_at ASC
    `,
    [runId]
  );
  return result.rows.map((row) => rowToRunStep(row));
}

export async function recordDecision(store, runId, {category, subject, outcome, evidence = {}}) {
  return insertDecisionQuery(store.pool, runId, category, subject, outcome, evidence);
}

export async function listRunDecisions(store, runId) {
  const result = await store.pool.query(
    `
      SELECT id, run_id, category, subject, outcome, evidence, created_at
      FROM decisions
      WHERE run_id = $1
      ORDER BY created_at ASC
    `,
    [runId]
  );
  return result.rows.map((row) => rowToDecision(row));
}

export async function listRunUsage(store, runId) {
  const result = await store.pool.query(
    `
      SELECT id, run_id, model_profile, provider, fallback_depth, tokens_in, tokens_out, created_at
      FROM provider_usage
      WHERE run_id = $1
      ORDER BY created_at ASC
    `,
    [runId]
  );
  return result.rows.map((row) => rowToUsage(row));
}

export async function getRunFromPostgres(store, runId) {
  const result = await store.pool.query(
    `
      SELECT ${RUN_RETURNING_COLUMNS}
      FROM runs
      WHERE id = $1
    `,
    [runId]
  );
  return rowToRun(result.rows[0]);
}

export async function deadLetterRunInPostgres(store, runId, reason, details = {}) {
  return withTransaction(store, async (client) => deadLetterRunQuery(client, runId, reason, details));
}

export async function replayDeadLetterRunInPostgres(store, runId, options = {}) {
  return withTransaction(store, async (client) => {
    const runResult = await client.query(
      `
        SELECT ${RUN_RETURNING_COLUMNS}
        FROM runs
        WHERE id = $1
        FOR UPDATE
      `,
      [runId]
    );
    const run = rowToRun(runResult.rows[0]);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    if (run.status !== 'dead_lettered') {
      throw new Error(`Run ${runId} is not dead_lettered`);
    }

    const taskResult = await client.query(
      `
        SELECT ${TASK_RETURNING_COLUMNS}
        FROM tasks
        WHERE id = $1
        FOR UPDATE
      `,
      [run.taskId]
    );
    const task = rowToTask(taskResult.rows[0]);

    const replayModelProfile = options.modelProfileOverride || run.modelProfile;
    const updatedRunResult = await client.query(
      `
        UPDATE runs
        SET status = 'queued',
            model_profile = $2,
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_retry_at = NULL,
            dead_letter_reason = NULL,
            dead_lettered_at = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${RUN_RETURNING_COLUMNS}
      `,
      [runId, replayModelProfile]
    );
    const updatedRun = rowToRun(updatedRunResult.rows[0]);

    const updatedTaskResult = await client.query(
      `
        UPDATE tasks
        SET status = 'queued',
            current_phase = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING ${TASK_RETURNING_COLUMNS}
      `,
      [run.taskId, run.workerRole]
    );
    const updatedTask = rowToTask(updatedTaskResult.rows[0]);

    await insertRunStepQuery(client, runId, 'dead_letter_replayed', 'completed', {
      previousStatus: run.status,
      workerRole: run.workerRole,
      replayedBy: options.replayedBy || 'operator',
      replayReason: options.replayReason || options.note || null,
      previousModelProfile: run.modelProfile,
      replayModelProfile
    });

    await insertDecisionQuery(client, runId, 'durability', 'dead_letter_replay', 'queued', {
      replayedBy: options.replayedBy || 'operator',
      replayReason: options.replayReason || options.note || null,
      taskStatus: task.status,
      currentPhase: updatedTask.currentPhase,
      previousModelProfile: run.modelProfile,
      selectedOption: replayModelProfile,
      replayState: {
        source: 'dead_letter',
        replayReason: options.replayReason || options.note || null,
        previousModelProfile: run.modelProfile,
        replayModelProfile,
        memoryAware: true
      }
    });

    return {
      task: updatedTask,
      run: updatedRun
    };
  });
}

export async function listRunArtifacts(store, runId) {
  const result = await store.pool.query(
    `
      SELECT id, run_id, kind, uri, created_at
      FROM artifacts
      WHERE run_id = $1
      ORDER BY created_at ASC
    `,
    [runId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    runId: row.run_id,
    kind: row.kind,
    uri: row.uri,
    createdAt: row.created_at
  }));
}

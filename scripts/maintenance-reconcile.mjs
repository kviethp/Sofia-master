import fs from 'node:fs/promises';
import path from 'node:path';

import {createRedisQueue, closeRedisQueue, enqueueRun} from '../apps/sofia-api/src/redis-queue.js';
import {
  claimStaleRunInPostgres,
  closePostgresStore,
  createPostgresStore,
  ensureSchema,
  listApprovalsInPostgres,
  listRunsInPostgres,
  listTasksInPostgres
} from '../apps/sofia-api/src/postgres-store.js';
import {getRuntimeStatus} from '../apps/sofia-api/src/runtime-backend.js';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, '.sofia', 'reports');
const applyChanges = String(process.env.SOFIA_MAINTENANCE_APPLY || '').trim().toLowerCase() === 'yes';

function isExpired(timestamp) {
  if (!timestamp) {
    return false;
  }
  return new Date(timestamp).getTime() < Date.now();
}

async function main() {
  await fs.mkdir(reportDir, {recursive: true});

  const runtime = await getRuntimeStatus();
  if (runtime.mode !== 'postgres-redis') {
    throw new Error('Maintenance reconcile requires postgres-redis runtime mode');
  }

  const store = createPostgresStore();
  const queue = await createRedisQueue();

  try {
    await ensureSchema(store);

    const [runningRuns, pendingApprovals, awaitingApprovalTasks] = await Promise.all([
      listRunsInPostgres(store, {status: 'running', limit: 100}),
      listApprovalsInPostgres(store, {status: 'pending', limit: 100}),
      listTasksInPostgres(store, {status: 'awaiting_approval', limit: 100})
    ]);

    const staleRuns = runningRuns.filter((run) => isExpired(run.leaseExpiresAt));
    const approvalTaskIds = new Set(pendingApprovals.map((approval) => approval.taskId));
    const awaitingApprovalWithoutPendingRecord = awaitingApprovalTasks.filter((task) => !approvalTaskIds.has(task.id));
    const pendingApprovalsWithoutTarget = pendingApprovals.filter((approval) => !approval.target);

    const reconciledRuns = [];
    if (applyChanges) {
      for (const staleRun of staleRuns) {
        const reconciled = await claimStaleRunInPostgres(store, {
          runId: staleRun.id,
          workerId: 'maintenance-reconcile'
        });
        if (!reconciled) {
          continue;
        }
        if (!reconciled.deadLettered) {
          await enqueueRun(queue, reconciled.id);
        }
        reconciledRuns.push({
          id: reconciled.id,
          taskId: reconciled.taskId,
          status: reconciled.status,
          attemptCount: reconciled.attemptCount,
          deadLettered: Boolean(reconciled.deadLettered),
          deadLetterReason: reconciled.deadLetterReason || null
        });
      }
    }

    const report = {
      timestamp: new Date().toISOString(),
      mode: applyChanges ? 'apply' : 'dry-run',
      runtime: {
        queue: runtime.queue,
        tasksByStatus: runtime.tasksByStatus,
        runsByStatus: runtime.runsByStatus,
        pendingApprovals: runtime.pendingApprovals
      },
      findings: {
        staleRunningRuns: staleRuns.map((run) => ({
          id: run.id,
          taskId: run.taskId,
          workerRole: run.workerRole,
          attemptCount: run.attemptCount,
          leaseOwner: run.leaseOwner,
          leaseExpiresAt: run.leaseExpiresAt,
          nextRetryAt: run.nextRetryAt
        })),
        awaitingApprovalWithoutPendingRecord: awaitingApprovalWithoutPendingRecord.map((task) => ({
          id: task.id,
          title: task.title,
          risk: task.risk,
          currentPhase: task.currentPhase,
          status: task.status
        })),
        pendingApprovalsWithoutTarget: pendingApprovalsWithoutTarget.map((approval) => ({
          id: approval.id,
          taskId: approval.taskId,
          phaseName: approval.phaseName,
          channel: approval.channel,
          note: approval.note
        }))
      },
      actions: {
        reconciledRuns
      }
    };

    await fs.writeFile(path.join(reportDir, 'maintenance-reconcile.json'), JSON.stringify(report, null, 2), 'utf8');
    await fs.writeFile(
      path.join(reportDir, 'maintenance-reconcile.md'),
      [
        '# Sofia Maintenance Reconcile',
        '',
        `- Timestamp: ${report.timestamp}`,
        `- Mode: ${report.mode}`,
        `- Stale running runs: ${report.findings.staleRunningRuns.length}`,
        `- Approval mismatches: ${report.findings.awaitingApprovalWithoutPendingRecord.length}`,
        `- Pending approvals without target: ${report.findings.pendingApprovalsWithoutTarget.length}`,
        `- Reconciled runs: ${report.actions.reconciledRuns.length}`,
        ''
      ].join('\n'),
      'utf8'
    );

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await closeRedisQueue(queue);
    await closePostgresStore(store);
  }
}

await main();

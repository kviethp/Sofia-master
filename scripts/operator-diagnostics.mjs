import fs from 'node:fs/promises';
import path from 'node:path';

import {getRuntimeStatus, listApprovals, listRuns} from '../apps/sofia-api/src/runtime-backend.js';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, '.sofia', 'reports');
const includeTrace = String(process.env.SOFIA_OPERATOR_INCLUDE_TRACE || '').trim().toLowerCase() === 'yes';

function summarizeRun(run) {
  const base = {
    id: run.id,
    taskId: run.taskId,
    status: run.status,
    workerRole: run.workerRole,
    modelProfile: run.modelProfile,
    attemptCount: run.attemptCount,
    leaseOwner: run.leaseOwner,
    leaseExpiresAt: run.leaseExpiresAt,
    nextRetryAt: run.nextRetryAt,
    deadLetterReason: run.deadLetterReason,
    deadLetteredAt: run.deadLetteredAt,
    artifactCount: Array.isArray(run.artifacts) ? run.artifacts.length : 0,
    stepCount: Array.isArray(run.steps) ? run.steps.length : 0,
    decisionCount: Array.isArray(run.decisions) ? run.decisions.length : 0,
    usageCount: Array.isArray(run.usageEntries) ? run.usageEntries.length : 0
  };

  if (!includeTrace) {
    return base;
  }

  return {
    ...base,
    artifacts: run.artifacts || [],
    steps: run.steps || [],
    decisions: run.decisions || [],
    usageEntries: run.usageEntries || []
  };
}

function toMarkdown(report) {
  const lines = [
    '# Sofia Operator Diagnostics',
    '',
    `- Timestamp: ${report.timestamp}`,
    `- Runtime mode: ${report.runtime.mode}`,
    `- Pending approvals: ${report.runtime.pendingApprovals}`,
    `- Queued runs: ${report.runtime.queue?.queuedCount ?? 0}`,
    `- Dead-letter runs: ${report.runtime.queue?.deadLetterCount ?? 0}`,
    ''
  ];

  const sections = [
    ['Failed runs', report.failedRuns],
    ['Dead-letter runs', report.deadLetterRuns],
    ['Running runs', report.runningRuns],
    ['Pending approvals', report.pendingApprovals]
  ];

  for (const [title, entries] of sections) {
    lines.push(`## ${title}`, '');
    if (!entries.length) {
      lines.push('- none', '');
      continue;
    }

    for (const entry of entries) {
      lines.push(`- ${entry.id || entry.taskId}: status=${entry.status || 'pending'} task=${entry.taskId || 'n/a'}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  await fs.mkdir(reportDir, {recursive: true});

  const [runtime, failedRuns, deadLetterRuns, runningRuns, pendingApprovals] = await Promise.all([
    getRuntimeStatus(),
    listRuns({status: 'failed', limit: 20}).then((entries) => entries.map(summarizeRun)),
    listRuns({status: 'dead_lettered', limit: 20}).then((entries) => entries.map(summarizeRun)),
    listRuns({status: 'running', limit: 20}).then((entries) => entries.map(summarizeRun)),
    listApprovals({status: 'pending', limit: 20})
  ]);

  const report = {
    timestamp: new Date().toISOString(),
    runtime,
    failedRuns,
    deadLetterRuns,
    runningRuns,
    pendingApprovals
  };

  await fs.writeFile(path.join(reportDir, 'operator-diagnostics.json'), JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(path.join(reportDir, 'operator-diagnostics.md'), `${toMarkdown(report)}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));
}

await main();

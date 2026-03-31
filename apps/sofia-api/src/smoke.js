import fs from 'node:fs/promises';
import path from 'node:path';

import {runDoctor} from './doctor.js';
import {createTask, startTask} from './runtime-backend.js';
import {getRuntimePaths} from './paths.js';

export async function runSmoke() {
  const runtime = getRuntimePaths();
  const doctor = await runDoctor();
  const smokeTemplateId = process.env.SOFIA_SMOKE_TEMPLATE_ID || 'webapp-basic';
  const task = await createTask({
    title: 'Scaffold smoke task',
    templateId: smokeTemplateId
  });
  const execution = await startTask(task.id);

  const smoke = {
    timestamp: new Date().toISOString(),
    result: execution.storageMode === 'postgres-redis' ? 'runtime_pass' : 'scaffold_pass',
    storageMode: execution.storageMode || 'scaffold-filesystem',
    doctorStatus: doctor.summary.status,
    task: execution.task,
    run: execution.run,
    runs: execution.task?.runs || [],
    artifact: execution.artifact,
    artifacts: execution.artifacts || [],
    usage: execution.usage,
    steps: execution.steps || [],
    decisions: execution.decisions || [],
    smokeTemplateId,
    note:
      execution.storageMode === 'postgres-redis'
        ? `Smoke validated the PostgreSQL + Redis path using template=${smokeTemplateId}. Set SOFIA_SMOKE_TEMPLATE_ID=default to force the multi-phase workflow.`
        : 'Smoke validates the runnable scaffold path. It does not replace the future PostgreSQL and Redis-backed implementation.'
  };

  await fs.mkdir(runtime.reportDir, {recursive: true});
  await fs.writeFile(
    path.join(runtime.reportDir, 'smoke-report.json'),
    JSON.stringify(smoke, null, 2),
    'utf8'
  );

  return smoke;
}

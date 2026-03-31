import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, '.sofia', 'reports');

const steps = [
  {
    name: 'migrate',
    command: 'node',
    args: ['apps/sofia-api/scripts/migrate.js']
  },
  {
    name: 'skills_validate',
    command: 'node',
    args: ['scripts/skills-validate.mjs']
  },
  {
    name: 'skills_compile',
    command: 'node',
    args: ['scripts/skills-compile.mjs']
  },
  {
    name: 'agent_system_conformance',
    command: 'node',
    args: ['scripts/agent-system-conformance.mjs']
  },
  {
    name: 'doctor',
    command: 'node',
    args: ['apps/sofia-api/scripts/doctor.js']
  },
  {
    name: 'preflight',
    command: 'node',
    args: ['apps/sofia-api/scripts/preflight.js']
  },
  {
    name: 'smoke',
    command: 'node',
    args: ['apps/sofia-api/scripts/smoke.js']
  },
  {
    name: 'operator_diagnostics',
    command: 'node',
    args: ['scripts/operator-diagnostics.mjs']
  },
  {
    name: 'release_readiness',
    command: 'node',
    args: ['scripts/release-readiness.mjs']
  },
  {
    name: 'release_bundle',
    command: 'node',
    args: ['scripts/release-bundle.mjs']
  },
  {
    name: 'release_acceptance',
    command: 'node',
    args: ['scripts/release-acceptance.mjs']
  }
];

function runStep(step) {
  const startedAt = Date.now();
  const result = spawnSync(step.command, step.args, {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env
    }
  });

  return {
    name: step.name,
    command: `${step.command} ${step.args.join(' ')}`,
    status: result.status ?? 1,
    ok: result.status === 0,
    durationMs: Date.now() - startedAt,
    stdout: result.stdout?.trim() || '',
    stderr: result.stderr?.trim() || ''
  };
}

function toMarkdown(report) {
  const lines = [
    '# Sofia Self-Host Acceptance',
    '',
    `- Timestamp: ${report.timestamp}`,
    `- Result: ${report.result}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    ''
  ];

  lines.push('## Steps', '');
  for (const step of report.steps) {
    lines.push(`- ${step.name}: ${step.ok ? 'pass' : 'fail'} (${step.durationMs} ms)`);
  }

  return lines.join('\n');
}

async function main() {
  await fs.mkdir(reportDir, {recursive: true});
  const results = [];

  for (const step of steps) {
    const result = runStep(step);
    results.push(result);
    if (!result.ok) {
      break;
    }
  }

  const passed = results.filter((step) => step.ok).length;
  const failed = results.filter((step) => !step.ok).length;
  const report = {
    timestamp: new Date().toISOString(),
    result: failed === 0 ? 'pass' : 'fail',
    summary: {
      passed,
      failed,
      total: results.length
    },
    steps: results
  };

  await fs.writeFile(path.join(reportDir, 'self-host-acceptance.json'), JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(path.join(reportDir, 'self-host-acceptance.md'), `${toMarkdown(report)}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));

  if (report.result !== 'pass') {
    process.exit(1);
  }
}

await main();

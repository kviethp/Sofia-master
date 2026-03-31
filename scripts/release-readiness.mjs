import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, '.sofia', 'reports');
const requiredFiles = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  'docs/public/COMPATIBILITY.md',
  'docs/public/MODEL-POLICY.md',
  'docs/public/CHANGELOG.md',
  'prompts',
  'skills',
  '.env.example',
  'pnpm-workspace.yaml',
  'openapi/sofia-api.yaml',
  'infra/compose/docker-compose.yml',
  'infra/docker/Dockerfile.api',
  '.github/workflows/ci.yml',
  'packages/skill-schema/src/index.js',
  'packages/skill-compiler/src/index.js',
  'docs/25-backup-and-restore.md',
  'docs/26-release-and-rollback-playbook.md',
  'docs/27-incident-response-playbook.md',
  'docs/28-quickstart.md',
  'docs/29-migration-notes.md',
  'docs/30-operator-diagnostics.md',
  'docs/34-role-skill-matrix.md'
];
const requiredScripts = [
  'bootstrap',
  'skills:validate',
  'skills:compile',
  'agent-system:conformance',
  'doctor',
  'preflight',
  'smoke',
  'compatibility:snapshot',
  'backup',
  'restore',
  'tunnel:start',
  'tunnel:status',
  'tunnel:stop'
];
const requiredEnvVars = [
  'SOFIA_DATABASE_URL',
  'SOFIA_REDIS_URL',
  'SOFIA_ROUTER_BASE_URL',
  'SOFIA_OPENCLAW_CONFIG_PATH',
  'SOFIA_CONTROL_TOKEN',
  'SOFIA_SKILL_SOURCE_DIR',
  'SOFIA_SKILL_OUTPUT_DIR',
  'SOFIA_SKILL_MANIFEST_PATH',
  'SOFIA_SKILL_AUTO_COMPILE',
  'SOFIA_SKILL_TRUST_LEVELS',
  'SOFIA_REQUIRED_RUNTIME_SKILLS',
  'SOFIA_TUNNEL_HOST',
  'SOFIA_TUNNEL_PORT',
  'SOFIA_TUNNEL_USER',
  'SOFIA_TUNNEL_HOSTKEY',
  'SOFIA_TUNNEL_FORWARDS'
];

async function fileExists(relativePath) {
  try {
    await fs.access(path.join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
}

function toCheck(name, ok, note = '') {
  return {name, ok, note};
}

function runNodeScript(scriptPath) {
  return spawnSync('node', [scriptPath], {
    cwd: rootDir,
    encoding: 'utf8',
    env: {
      ...process.env
    }
  });
}

function toMarkdown(report) {
  const lines = [
    '# Sofia Release Readiness',
    '',
    `- Timestamp: ${report.timestamp}`,
    `- Result: ${report.result}`,
    ''
  ];

  lines.push('## Checks', '');
  for (const check of report.checks) {
    lines.push(`- ${check.name}: ${check.ok ? 'ok' : 'fail'}${check.note ? ` (${check.note})` : ''}`);
  }

  return lines.join('\n');
}

async function main() {
  await fs.mkdir(reportDir, {recursive: true});
  const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
  const envExample = await fs.readFile(path.join(rootDir, '.env.example'), 'utf8');
  const openapi = await fs.readFile(path.join(rootDir, 'openapi', 'sofia-api.yaml'), 'utf8');
  const compose = await fs.readFile(path.join(rootDir, 'infra', 'compose', 'docker-compose.yml'), 'utf8');

  const checks = [];

  for (const relativePath of requiredFiles) {
    checks.push(toCheck(`file:${relativePath}`, await fileExists(relativePath)));
  }

  for (const scriptName of requiredScripts) {
    checks.push(
      toCheck(
        `script:${scriptName}`,
        Boolean(packageJson.scripts?.[scriptName]),
        packageJson.scripts?.[scriptName] || ''
      )
    );
  }

  for (const envName of requiredEnvVars) {
    checks.push(toCheck(`env:${envName}`, envExample.includes(`${envName}=`)));
  }

  checks.push(toCheck('openapi:version', openapi.includes('openapi: 3.1.0')));
  checks.push(toCheck('openapi:security', openapi.includes('SofiaControlToken')));
  checks.push(toCheck('compose:api_service', compose.includes('api:')));
  checks.push(toCheck('compose:web_service', compose.includes('web:')));
  checks.push(toCheck('compose:admin_service', compose.includes('admin:')));
  checks.push(toCheck('compose:worker_profile', compose.includes('profiles:')));
  checks.push(toCheck('dockerfile:installs_dependencies', (await fs.readFile(path.join(rootDir, 'infra', 'docker', 'Dockerfile.api'), 'utf8')).includes('npm install --omit=dev')));

  const skillValidateResult = runNodeScript('scripts/skills-validate.mjs');
  const skillCompileResult = runNodeScript('scripts/skills-compile.mjs');
  const agentSystemConformanceResult = runNodeScript('scripts/agent-system-conformance.mjs');

  checks.push(toCheck('runtime:skills_validate', skillValidateResult.status === 0, skillValidateResult.stderr.trim() || skillValidateResult.stdout.trim()));
  checks.push(toCheck('runtime:skills_compile', skillCompileResult.status === 0, skillCompileResult.stderr.trim() || skillCompileResult.stdout.trim()));
  checks.push(
    toCheck(
      'runtime:agent_system_conformance',
      agentSystemConformanceResult.status === 0,
      agentSystemConformanceResult.stderr.trim() || agentSystemConformanceResult.stdout.trim()
    )
  );

  const report = {
    timestamp: new Date().toISOString(),
    result: checks.every((check) => check.ok) ? 'pass' : 'needs-attention',
    checks
  };

  await fs.writeFile(path.join(reportDir, 'release-readiness.json'), JSON.stringify(report, null, 2), 'utf8');
  await fs.writeFile(path.join(reportDir, 'release-readiness.md'), `${toMarkdown(report)}\n`, 'utf8');

  console.log(JSON.stringify(report, null, 2));
}

await main();

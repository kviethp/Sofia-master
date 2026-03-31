import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const bundleLabel = process.env.SOFIA_RELEASE_LABEL;
const explicitBundleDir = process.env.SOFIA_RELEASE_BUNDLE_DIR;
const latestManifestPath = path.join(rootDir, '.sofia', 'releases', 'latest.json');

const requiredPaths = [
  'README.md',
  '.env.example',
  'package.json',
  'prompts',
  'skills',
  'scripts/bootstrap.mjs',
  'scripts/skills-validate.mjs',
  'scripts/skills-compile.mjs',
  'scripts/agent-system-conformance.mjs',
  'scripts/release-readiness.mjs',
  'infra/compose/docker-compose.yml',
  'openapi/sofia-api.yaml',
  'apps/sofia-api',
  'packages/policy-engine',
  'sql/001_initial_schema.sql'
];

async function pathExists(targetPath) {
  return fs.access(targetPath).then(() => true).catch(() => false);
}

function runNodeScript(cwd, scriptPath, extraEnv = {}) {
  return spawnSync('node', [scriptPath], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv
    }
  });
}

async function main() {
  let bundleDir = explicitBundleDir || null;
  if (!bundleDir && (await pathExists(latestManifestPath))) {
    const latest = JSON.parse(await fs.readFile(latestManifestPath, 'utf8'));
    bundleDir = latest.bundleDir || null;
  }
  if (!bundleDir && bundleLabel) {
    bundleDir = path.join(rootDir, '.sofia', 'releases', bundleLabel);
  }
  if (!bundleDir) {
    bundleDir = path.join(rootDir, '.sofia', 'releases', 'latest');
  }

  if (!(await pathExists(bundleDir))) {
    throw new Error(`bundle_dir_missing:${bundleDir}`);
  }

  const missingPaths = [];
  for (const relativePath of requiredPaths) {
    if (!(await pathExists(path.join(bundleDir, relativePath)))) {
      missingPaths.push(relativePath);
    }
  }

  const manifestPath = path.join(bundleDir, 'release-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const packageJson = JSON.parse(await fs.readFile(path.join(bundleDir, 'package.json'), 'utf8'));

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sofia-release-acceptance-'));
  const acceptanceDir = path.join(tempDir, 'bundle');
  await fs.cp(bundleDir, acceptanceDir, {
    recursive: true,
    force: true
  });

  const bootstrapResult = runNodeScript(acceptanceDir, 'scripts/bootstrap.mjs');
  const skillsValidateResult = runNodeScript(acceptanceDir, 'scripts/skills-validate.mjs');
  const skillsCompileResult = runNodeScript(acceptanceDir, 'scripts/skills-compile.mjs');
  const agentSystemConformanceResult = runNodeScript(acceptanceDir, 'scripts/agent-system-conformance.mjs');
  const readinessResult = runNodeScript(acceptanceDir, 'scripts/release-readiness.mjs');

  const envCreated = await pathExists(path.join(acceptanceDir, '.env'));

  const report = {
    status:
      missingPaths.length === 0 &&
      bootstrapResult.status === 0 &&
      skillsValidateResult.status === 0 &&
      skillsCompileResult.status === 0 &&
      agentSystemConformanceResult.status === 0 &&
      readinessResult.status === 0
        ? 'pass'
        : 'fail',
    bundleDir,
    manifestVersion: manifest.version || null,
    manifestCreatedAt: manifest.createdAt || null,
    packageVersion: packageJson.version || null,
    packageManager: packageJson.packageManager || null,
    requiredPathsChecked: requiredPaths.length,
    missingPaths,
    bootstrap: {
      status: bootstrapResult.status ?? 1,
      envCreated,
      stdout: bootstrapResult.stdout.trim(),
      stderr: bootstrapResult.stderr.trim()
    },
    skillsValidate: {
      status: skillsValidateResult.status ?? 1,
      stdout: skillsValidateResult.stdout.trim(),
      stderr: skillsValidateResult.stderr.trim()
    },
    skillsCompile: {
      status: skillsCompileResult.status ?? 1,
      stdout: skillsCompileResult.stdout.trim(),
      stderr: skillsCompileResult.stderr.trim()
    },
    agentSystemConformance: {
      status: agentSystemConformanceResult.status ?? 1,
      stdout: agentSystemConformanceResult.stdout.trim(),
      stderr: agentSystemConformanceResult.stderr.trim()
    },
    releaseReadiness: {
      status: readinessResult.status ?? 1,
      stdout: readinessResult.stdout.trim(),
      stderr: readinessResult.stderr.trim()
    }
  };

  console.log(JSON.stringify(report, null, 2));

  if (report.status !== 'pass') {
    process.exit(1);
  }
}

await main();

import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const bundleRoot = path.join(rootDir, '.sofia', 'releases');
const latestManifestPath = path.join(bundleRoot, 'latest.json');
const label = process.env.SOFIA_RELEASE_LABEL || new Date().toISOString().replace(/[:]/g, '-');
const targetDir = path.join(bundleRoot, label);

function commandAvailable(command, args = ['--version']) {
  const result = spawnSync(command, args, {stdio: 'ignore'});
  return result.status === 0;
}

function installRuntimeDependencies(bundleDir) {
  const pnpmAvailable = commandAvailable('pnpm');
  const corepackAvailable = commandAvailable('corepack');

  const command = pnpmAvailable
    ? ['pnpm', ['install', '--prod', '--frozen-lockfile']]
    : corepackAvailable
      ? ['corepack', ['pnpm', 'install', '--prod', '--frozen-lockfile']]
      : [null, null];

  if (!command[0]) {
    throw new Error('runtime_deps_install_unavailable: pnpm/corepack not found');
  }

  const result = spawnSync(command[0], command[1], {
    cwd: bundleDir,
    encoding: 'utf8',
    env: {
      ...process.env
    }
  });

  if (result.status !== 0) {
    throw new Error(`runtime_deps_install_failed:${(result.stderr || result.stdout || '').trim()}`);
  }

  return {
    installer: command[0],
    args: command[1],
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

const requiredPaths = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'SUPPORT.md',
  '.env.example',
  'Makefile',
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'prompts',
  'skills',
  'openapi',
  'docs',
  'infra',
  'apps',
  'packages',
  'scripts',
  'sql',
  'templates',
  'examples',
  '.github'
];

async function copyPath(relativePath) {
  const source = path.join(rootDir, relativePath);
  const destination = path.join(targetDir, relativePath);
  await fs.mkdir(path.dirname(destination), {recursive: true});
  await fs.cp(source, destination, {
    recursive: true,
    force: true
  });
}

async function listEntries(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  const stat = await fs.stat(fullPath);
  if (stat.isDirectory()) {
    const entries = await fs.readdir(fullPath);
    return entries.length;
  }
  return stat.size;
}

async function main() {
  const packageJson = JSON.parse(await fs.readFile(path.join(rootDir, 'package.json'), 'utf8'));
  await fs.rm(targetDir, {recursive: true, force: true});
  await fs.mkdir(targetDir, {recursive: true});

  for (const relativePath of requiredPaths) {
    await copyPath(relativePath);
  }

  const runtimeDependencies = installRuntimeDependencies(targetDir);

  const manifest = {
    label,
    version: packageJson.version,
    packageManager: packageJson.packageManager || null,
    createdAt: new Date().toISOString(),
    rootDir,
    runtimeDependenciesInstalled: true,
    runtimeDependencies,
    contents: []
  };

  for (const relativePath of requiredPaths) {
    manifest.contents.push({
      path: relativePath,
      sizeHint: await listEntries(relativePath)
    });
  }

  await fs.writeFile(path.join(targetDir, 'release-manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  await fs.writeFile(
    latestManifestPath,
    JSON.stringify(
      {
        label,
        bundleDir: targetDir,
        manifest: path.join(targetDir, 'release-manifest.json'),
        updatedAt: new Date().toISOString()
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        bundleDir: targetDir,
        manifest: path.join(targetDir, 'release-manifest.json'),
        latest: latestManifestPath,
        itemCount: manifest.contents.length,
        version: manifest.version
      },
      null,
      2
    )
  );
}

await main();

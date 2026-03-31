import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

import pg from 'pg';

import {getRuntimePaths} from '../apps/sofia-api/src/paths.js';

const {Pool} = pg;

function timestamp() {
  return new Date().toISOString().replace(/[:]/g, '-');
}

function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    host: url.hostname,
    port: url.port || '5432',
    database: url.pathname.replace(/^\//, ''),
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || '')
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...options
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({code, stderr});
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr}`.trim()));
      }
    });
  });
}

async function createArtifactManifest(artifactDir, outputPath) {
  const entries = await fs.readdir(artifactDir, {withFileTypes: true}).catch(() => []);
  const manifest = [];

  for (const entry of entries) {
    const fullPath = path.join(artifactDir, entry.name);
    if (entry.isDirectory()) {
      const childEntries = await fs.readdir(fullPath).catch(() => []);
      manifest.push({
        runId: entry.name,
        files: childEntries.sort()
      });
    }
  }

  await fs.writeFile(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifest.length;
}

async function copyArtifacts(artifactDir, outputDir) {
  const exists = await fs.stat(artifactDir).then(() => true).catch(() => false);
  if (!exists) {
    return {
      copied: false,
      fileCount: 0
    };
  }

  await fs.mkdir(outputDir, {recursive: true});
  await fs.cp(artifactDir, outputDir, {
    recursive: true,
    force: true
  });

  let fileCount = 0;
  const queue = [outputDir];
  while (queue.length > 0) {
    const current = queue.pop();
    const entries = await fs.readdir(current, {withFileTypes: true});
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else if (entry.isFile()) {
        fileCount += 1;
      }
    }
  }

  return {
    copied: true,
    fileCount
  };
}

async function commandExists(command) {
  try {
    await run(process.platform === 'win32' ? 'where' : 'which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function createLogicalBackup(databaseUrl, outputPath) {
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500
  });

  try {
    const tables = ['projects', 'tasks', 'runs', 'artifacts', 'run_steps', 'decisions', 'approvals', 'provider_usage'];
    const snapshot = {};

    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM ${table} ORDER BY 1 ASC`);
      snapshot[table] = result.rows;
    }

    await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');
    return {
      mode: 'logical-json',
      outputPath
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  const runtime = getRuntimePaths();
  const backupRoot = process.env.SOFIA_BACKUP_DIR
    ? path.resolve(process.env.SOFIA_BACKUP_DIR)
    : path.join(runtime.rootDir, '.sofia', 'backups');
  const label = process.env.SOFIA_BACKUP_LABEL || timestamp();
  const targetDir = path.join(backupRoot, label);
  const artifactDir = runtime.artifactDir;
  const databaseUrl = process.env.SOFIA_DATABASE_URL || 'postgres://sofia:sofia@127.0.0.1:5432/sofia';
  const parsedDb = parseDatabaseUrl(databaseUrl);

  await fs.mkdir(targetDir, {recursive: true});
  await fs.mkdir(backupRoot, {recursive: true});

  const manifestPath = path.join(targetDir, 'artifacts-manifest.json');
  const artifactCount = await createArtifactManifest(artifactDir, manifestPath);
  const artifactBackupDir = path.join(targetDir, 'artifacts');
  const artifactCopy = await copyArtifacts(artifactDir, artifactBackupDir);

  let databaseBackup;
  if (await commandExists('pg_dump')) {
    const dumpPath = path.join(targetDir, 'sofia.sql');
    await run(
      'pg_dump',
      ['-h', parsedDb.host, '-p', parsedDb.port, '-U', parsedDb.user, '-d', parsedDb.database, '-f', dumpPath],
      {
        env: {
          ...process.env,
          PGPASSWORD: parsedDb.password
        }
      }
    );
    databaseBackup = {
      mode: 'pg_dump',
      outputPath: dumpPath
    };
  } else {
    databaseBackup = await createLogicalBackup(databaseUrl, path.join(targetDir, 'sofia.logical.json'));
  }

  const indexPath = path.join(backupRoot, 'index.json');
  const existing = await fs.readFile(indexPath, 'utf8').then((text) => JSON.parse(text)).catch(() => []);
  existing.push({
    label,
    backupDir: targetDir,
    createdAt: new Date().toISOString(),
    databaseBackup,
    artifactManifest: manifestPath,
    artifactBackupDir: artifactCopy.copied ? artifactBackupDir : null
  });
  await fs.writeFile(indexPath, JSON.stringify(existing, null, 2), 'utf8');

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        backupDir: targetDir,
        databaseBackup,
        artifactManifest: manifestPath,
        artifactBackupDir: artifactCopy.copied ? artifactBackupDir : null,
        artifactRunCount: artifactCount,
        artifactFileCount: artifactCopy.fileCount,
        backupIndex: indexPath
      },
      null,
      2
    )
  );
}

await main();

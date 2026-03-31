import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';

import pg from 'pg';

const {Pool} = pg;

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

async function commandExists(command) {
  try {
    await run(process.platform === 'win32' ? 'where' : 'which', [command]);
    return true;
  } catch {
    return false;
  }
}

async function restoreLogicalBackup(databaseUrl, dumpPath) {
  const snapshot = JSON.parse(await fs.readFile(dumpPath, 'utf8'));
  const pool = new Pool({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 1500
  });

  const tableOrder = ['provider_usage', 'approvals', 'decisions', 'run_steps', 'artifacts', 'runs', 'tasks', 'projects'];
  const restoreOrder = [...tableOrder].reverse();

  try {
    await pool.query('BEGIN');
    for (const table of tableOrder) {
      await pool.query(`DELETE FROM ${table}`);
    }

    for (const table of restoreOrder) {
      const rows = Array.isArray(snapshot[table]) ? snapshot[table] : [];
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = columns.map((column) => row[column]);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
        await pool.query(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    }
    await pool.query('COMMIT');
    return {mode: 'logical-json', rowCounts: Object.fromEntries(Object.entries(snapshot).map(([table, rows]) => [table, Array.isArray(rows) ? rows.length : 0]))};
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  } finally {
    await pool.end();
  }
}

async function resolveRestoreInputs() {
  const backupDir = String(process.env.SOFIA_RESTORE_BACKUP_DIR || '').trim();
  if (!backupDir) {
    return {
      dumpPath: process.env.SOFIA_RESTORE_SQL || '',
      logicalPath: process.env.SOFIA_RESTORE_LOGICAL_JSON || '',
      artifactBackupDir: '',
      restoreArtifacts: (process.env.SOFIA_RESTORE_ARTIFACTS || '').trim().toLowerCase() === 'yes'
    };
  }

  const sqlPath = path.join(backupDir, 'sofia.sql');
  const logicalJsonPath = path.join(backupDir, 'sofia.logical.json');
  const artifactBackupDir = path.join(backupDir, 'artifacts');

  const dumpPath = await fs.stat(sqlPath).then(() => sqlPath).catch(() => '');
  const logicalPath = await fs.stat(logicalJsonPath).then(() => logicalJsonPath).catch(() => '');
  const restoreArtifacts = await fs.stat(artifactBackupDir).then(() => true).catch(() => false);

  return {
    dumpPath,
    logicalPath,
    artifactBackupDir,
    restoreArtifacts
  };
}

async function restoreArtifacts(artifactBackupDir, artifactDir) {
  if (!artifactBackupDir) {
    return {
      restored: false,
      fileCount: 0
    };
  }

  await fs.rm(artifactDir, {recursive: true, force: true});
  await fs.mkdir(path.dirname(artifactDir), {recursive: true});
  await fs.cp(artifactBackupDir, artifactDir, {
    recursive: true,
    force: true
  });

  let fileCount = 0;
  const queue = [artifactDir];
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
    restored: true,
    fileCount
  };
}

async function main() {
  const {
    dumpPath,
    logicalPath,
    artifactBackupDir,
    restoreArtifacts: shouldRestoreArtifacts
  } = await resolveRestoreInputs();
  if (!dumpPath && !logicalPath) {
    throw new Error('SOFIA_RESTORE_SQL, SOFIA_RESTORE_LOGICAL_JSON, or SOFIA_RESTORE_BACKUP_DIR is required');
  }
  if ((process.env.SOFIA_RESTORE_CONFIRM || '').trim().toLowerCase() !== 'yes') {
    throw new Error('SOFIA_RESTORE_CONFIRM=yes is required for restore');
  }

  const databaseUrl = process.env.SOFIA_DATABASE_URL || 'postgres://sofia:sofia@127.0.0.1:5432/sofia';
  const parsedDb = parseDatabaseUrl(databaseUrl);
  const artifactDir = path.resolve(process.cwd(), process.env.SOFIA_ARTIFACT_DIR || '.sofia/artifacts');

  let restoreResult;
  if (dumpPath) {
    if (!(await commandExists('psql'))) {
      throw new Error('psql is not available; use SOFIA_RESTORE_LOGICAL_JSON instead');
    }

    await run(
      'psql',
      ['-h', parsedDb.host, '-p', parsedDb.port, '-U', parsedDb.user, '-d', parsedDb.database, '-f', dumpPath],
      {
        env: {
          ...process.env,
          PGPASSWORD: parsedDb.password
        }
      }
    );
    restoreResult = {
      mode: 'psql',
      restoredFrom: dumpPath
    };
  } else {
    restoreResult = await restoreLogicalBackup(databaseUrl, logicalPath);
  }

  const artifactRestore = shouldRestoreArtifacts
    ? await restoreArtifacts(artifactBackupDir, artifactDir)
    : {restored: false, fileCount: 0};

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        database: parsedDb.database,
        restoreResult,
        artifactRestore
      },
      null,
      2
    )
  );
}

await main();

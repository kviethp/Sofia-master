import {closePostgresStore, createPostgresStore, ensureSchema, listSchemaMigrations, probePostgres} from '../src/postgres-store.js';

const store = createPostgresStore();

try {
  const probe = await probePostgres(store);
  if (!probe.ok) {
    throw new Error(`PostgreSQL probe failed: ${probe.error?.message || 'unknown error'}`);
  }

  await ensureSchema(store);
  const migrations = await listSchemaMigrations(store);
  console.log(
    JSON.stringify(
      {
        result: 'ok',
        database: probe.database,
        user: probe.user,
        migrationCount: migrations.length,
        latestMigration: migrations.at(-1) || null
      },
      null,
      2
    )
  );
} finally {
  await closePostgresStore(store);
}

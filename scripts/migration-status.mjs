import {closePostgresStore, createPostgresStore, listSchemaMigrations, probePostgres} from '../apps/sofia-api/src/postgres-store.js';

const store = createPostgresStore();

try {
  const probe = await probePostgres(store);
  if (!probe.ok) {
    throw new Error(`PostgreSQL probe failed: ${probe.error?.message || 'unknown error'}`);
  }

  const migrations = await listSchemaMigrations(store);
  console.log(
    JSON.stringify(
      {
        result: 'ok',
        database: probe.database,
        user: probe.user,
        migrationCount: migrations.length,
        migrations
      },
      null,
      2
    )
  );
} finally {
  await closePostgresStore(store);
}

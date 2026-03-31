# Migration Notes

## 0.1.0

This milestone introduces the first real PostgreSQL schema and runtime-backed task lifecycle.

## Database changes

- `tasks`
- `runs`
- `artifacts`
- `run_steps`
- `decisions`
- `approvals`
- `provider_usage`

## Operational changes

- bootstrap now prefers Node entry points over shell placeholders
- backup and restore scripts now exist
- Web and Admin shells are now part of the local self-host surface

## Compatibility notes

- runtime expects Node.js 22+
- local Docker validation was not available on the current host
- VPS-backed runtime validation remains the source of truth for integration behavior

## Migration discipline

- `node apps/sofia-api/scripts/migrate.js` now reports the applied migration count and latest migration metadata
- `node scripts/migration-status.mjs` lists the schema migration ledger from `schema_migrations`

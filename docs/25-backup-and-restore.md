# Backup And Restore

## Scope

Current backup coverage is intentionally narrow and operational:

- PostgreSQL state via `pg_dump` when available, otherwise a logical JSON export
- artifact manifest from `.sofia/artifacts`
- artifact file copy from `.sofia/artifacts`

Redis queues are not yet snapshotted by Sofia tooling. Queue state should be considered transient.

## Backup

Run:

```bash
node scripts/backup.mjs
```

Optional variables:

- `SOFIA_BACKUP_DIR`
- `SOFIA_BACKUP_LABEL`
- `SOFIA_DATABASE_URL`

Output:

- `sofia.sql` when `pg_dump` is available
- `sofia.logical.json` when Postgres CLI tools are unavailable
- `artifacts-manifest.json`
- `artifacts/` copied from the live artifact directory when present
- backup index entry in `.sofia/backups/index.json`

## Restore

Run:

```bash
SOFIA_RESTORE_SQL=/path/to/sofia.sql node scripts/restore.mjs
```

Or:

```bash
SOFIA_RESTORE_LOGICAL_JSON=/path/to/sofia.logical.json node scripts/restore.mjs
```

Or restore directly from a backup directory:

```bash
SOFIA_RESTORE_BACKUP_DIR=/path/to/backup-dir SOFIA_RESTORE_CONFIRM=yes node scripts/restore.mjs
```

Required variables:

- `SOFIA_RESTORE_SQL` or `SOFIA_RESTORE_LOGICAL_JSON`
- or `SOFIA_RESTORE_BACKUP_DIR`
- `SOFIA_RESTORE_CONFIRM=yes`
- `SOFIA_DATABASE_URL`

Optional variables:

- `SOFIA_RESTORE_ARTIFACTS=yes`

## Current limitations

- Redis queue contents are not restored
- artifact restore copies files back into place, but does not verify artifact/db referential completeness
- logical JSON restore is intended for operational recovery, not large production datasets

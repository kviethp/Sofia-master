# Phase 1 Backup And Restore Groundwork

## Summary

This slice adds the first operational backup and restore tooling for self-hosted Sofia.

## Runtime changes

- Added `scripts/backup.mjs`
- Added `scripts/restore.mjs`
- Added `pnpm backup`
- Added `pnpm restore`
- Backup now prefers:
  - `pg_dump` when available
  - logical JSON export when Postgres CLI tools are absent

## Current backup outputs

- database snapshot
- artifact manifest

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check scripts/backup.mjs`
  - `node --check scripts/restore.mjs`
  - run `node scripts/backup.mjs`
- Result: backup completed successfully on the VPS-backed database and wrote a logical JSON snapshot plus artifact manifest

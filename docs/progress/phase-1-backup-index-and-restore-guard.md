# Phase 1 Backup Index And Restore Guard

## Summary

This slice makes backup and restore behavior safer for self-hosted operation.

## Changes

- backups now append to `.sofia/backups/index.json`
- restore now requires:
  - `SOFIA_RESTORE_CONFIRM=yes`

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check scripts/backup.mjs`
  - `node --check scripts/restore.mjs`
  - run `node scripts/backup.mjs`
- Result: backup completed successfully and now reports the backup index path

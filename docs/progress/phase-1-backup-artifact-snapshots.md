# Phase 1 Backup Artifact Snapshots

## Summary

This slice makes backup and restore less narrow by including artifact file copies and direct backup-directory restore.

## Changes

- backup now records:
  - `artifacts-manifest.json`
  - copied `artifacts/` tree when present
  - artifact backup directory in the backup index
- restore now supports:
  - `SOFIA_RESTORE_BACKUP_DIR`
  - artifact file restore when the backup contains `artifacts/`

## Remaining gaps

- Redis queue state is still transient
- artifact restore does not verify every database artifact row against on-disk contents

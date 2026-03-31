# Release And Rollback Playbook

## Scope

This playbook defines the minimum operational sequence for self-hosted Sofia releases on a single host.

## Pre-release checklist

1. run targeted validation for the changed slice
2. run checkpoint validation before a release candidate:
   - migrate
   - smoke
   - full conformance
3. create a backup:
   - `node scripts/backup.mjs`
4. record:
   - commit SHA
   - compatibility notes
   - migration notes

## Release sequence

1. deploy code and config changes
2. install or update systemd units from `infra/systemd/`
2. run migrations
3. restart API, worker, and approval poller
4. run:
   - `doctor`
   - `preflight`
   - `smoke`
   - `node scripts/self-host-acceptance.mjs`
   - `node scripts/final-readiness.mjs`
5. inspect:
   - `/v1/runtime/status`
   - `/v1/runs?status=failed&limit=10`
   - `/v1/approvals?status=pending&limit=10`

## Rollback triggers

Rollback if any of the following hold after deploy:

- doctor fails on core dependencies
- smoke fails
- queue backlog grows unexpectedly
- new runs move to `failed` or `dead_lettered` at abnormal rate
- approval processing stops unexpectedly

## Rollback sequence

1. stop worker and approval poller
2. roll back code/config to the last known-good release
3. restore database state when needed:
   - `SOFIA_RESTORE_SQL=... node scripts/restore.mjs`
   - or `SOFIA_RESTORE_LOGICAL_JSON=... node scripts/restore.mjs`
4. restart services
5. rerun:
   - doctor
   - preflight
   - smoke

## Post-incident evidence

Capture:

- release identifier
- failed validation output
- affected task IDs
- affected run IDs
- approval IDs if gating was involved
- backup label used for rollback

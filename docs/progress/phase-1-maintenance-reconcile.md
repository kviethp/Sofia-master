# Phase 1 Maintenance Reconcile

## Summary

This slice adds a dedicated operator maintenance runner for stale-run recovery and approval-state mismatch auditing.

## Added

- `scripts/maintenance-reconcile.mjs`
- `pnpm maintenance:reconcile`
- dry-run and apply modes via `SOFIA_MAINTENANCE_APPLY`

## What it does

- reports `running` runs whose lease has expired
- reports tasks in `awaiting_approval` without a pending approval record
- can apply stale-run reconciliation by reusing the existing reclaim and dead-letter logic

## Safety

- default mode is audit-only
- apply mode requires `SOFIA_MAINTENANCE_APPLY=yes`

# Phase 1 Migration Ledger

## Summary

This slice adds a real schema migration ledger instead of treating migration as a blind SQL apply step.

## Added

- `schema_migrations` table in `sql/001_initial_schema.sql`
- migration checksum tracking in `ensureSchema`
- richer `migrate` output with migration metadata
- `scripts/migration-status.mjs`
- `pnpm migration:status`

## Goal

Improve self-host and release discipline by making migration state inspectable and repeatable.

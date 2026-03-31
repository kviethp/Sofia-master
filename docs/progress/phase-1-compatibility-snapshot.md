# Phase 1 Compatibility Snapshot

## Summary

This slice adds a release-friendly compatibility artifact derived from live doctor output.

## Runtime changes

- Added `apps/sofia-api/scripts/compatibility-snapshot.js`
- Added `pnpm compatibility:snapshot`
- Compatibility snapshot captures:
  - Sofia version
  - Node version
  - package manager
  - storage mode
  - router and OpenClaw readiness
  - approval transport readiness
  - current routed model catalog

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/scripts/compatibility-snapshot.js`
  - `node apps/sofia-api/scripts/compatibility-snapshot.js`
- Result: snapshot artifact was written successfully to `.sofia/reports/compatibility-snapshot.json`

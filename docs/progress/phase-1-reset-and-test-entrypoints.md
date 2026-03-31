# Phase 1 Reset And Test Entrypoints

## Summary

This slice replaces placeholder reset and test entry points with cross-platform Node scripts.

## Runtime changes

- Added `scripts/reset.mjs`
- Added `pnpm reset`
- `scripts/test.mjs` now supports optional full conformance via:
  - `SOFIA_INCLUDE_CONFORMANCE=true`

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check scripts/reset.mjs`
  - `node --check scripts/test.mjs`
- Result: reset and test entry points are now syntactically valid and ready for checkpoint use

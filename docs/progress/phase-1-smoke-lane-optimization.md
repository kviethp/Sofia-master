# Phase 1 Smoke Lane Optimization

## Summary

This slice reduces checkpoint latency by making the default smoke path cheaper.

## Runtime changes

- `smoke` now defaults to `templateId=webapp-basic`
- multi-phase smoke remains available through:
  - `SOFIA_SMOKE_TEMPLATE_ID=default`

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/smoke.js`
  - run `runSmoke()` on the VPS-backed runtime
- Result: default smoke completed successfully in about 51 seconds with a single builder run

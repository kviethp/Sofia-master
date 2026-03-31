# Phase 1 Runtime Metrics Surface

## Summary

This slice adds a lightweight monitoring endpoint for self-hosted Sofia.

## Runtime changes

- added `GET /v1/runtime/metrics`
- current metrics include:
  - uptime
  - dependency readiness
  - queue depth
  - dead-letter depth
  - task counts by status
  - run counts by status
  - pending approval count

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/runtime-backend.js`
  - `node --check apps/sofia-api/src/index.js`
  - boot API and request `GET /v1/runtime/metrics`
- Result: endpoint returned `200` with live queue and status counters from the VPS-backed runtime

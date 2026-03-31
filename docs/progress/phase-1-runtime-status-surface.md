# Phase 1 Runtime Status Surface

## Summary

This slice adds a lightweight operational surface for the future dashboard and host operators.

## Runtime changes

- Added `GET /v1/runtime/status`.
- Runtime status now reports:
  - runtime mode and service readiness
  - worker queue names
  - Redis queue depth and dead-letter depth
  - task counts by status
  - run counts by status
  - pending approval count

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/redis-queue.js`
  - `node --check apps/sofia-api/src/postgres-store.js`
  - `node --check apps/sofia-api/src/runtime-backend.js`
  - `node --check apps/sofia-api/src/index.js`
  - boot API and request `GET /v1/runtime/status`
- Result: endpoint returned `200` on the VPS-backed runtime with live queue and workflow counts

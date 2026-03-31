# Phase 1 Run List Surface

## Summary

This slice adds a practical run-list endpoint for operators and the future admin surface.

## Runtime changes

- Added `GET /v1/runs`.
- Supports filters:
  - `status`
  - `taskId`
  - `limit`
- Run list responses include trace material:
  - `artifacts`
  - `steps`
  - `decisions`
  - `usageEntries`

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/postgres-store.js`
  - `node --check apps/sofia-api/src/runtime-backend.js`
  - `node --check apps/sofia-api/src/index.js`
  - boot API and request `GET /v1/runs?status=dead_lettered&limit=2`
- Result: endpoint returned `200` and surfaced dead-lettered runs with trace counts

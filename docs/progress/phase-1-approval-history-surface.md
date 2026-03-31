# Phase 1 Approval History Surface

## Summary

This slice extends the operator API so approval history is queryable without direct database access.

## Runtime changes

- Added `GET /v1/approvals`.
- Supports filters:
  - `status`
  - `taskId`
  - `limit`
- Kept `GET /v1/approvals/pending` for the pending-only compatibility path.

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/postgres-store.js`
  - `node --check apps/sofia-api/src/runtime-backend.js`
  - `node --check apps/sofia-api/src/index.js`
  - boot API and request `GET /v1/approvals?limit=3`
- Result: endpoint returned `200` and surfaced historical approval records with decision metadata

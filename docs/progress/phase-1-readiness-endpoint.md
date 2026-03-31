# Phase 1 Readiness Endpoint

## Summary

This slice adds a lightweight readiness endpoint for self-hosted orchestration and process managers.

## Runtime changes

- added `GET /health/ready`
- readiness currently requires:
  - PostgreSQL reachable
  - Redis reachable

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/index.js`
  - boot API and request `GET /health/ready`
- Result: endpoint returned `200` with `status=ready` on the VPS-backed runtime

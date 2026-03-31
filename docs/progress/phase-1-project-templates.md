# Phase 1 Project Templates

## Summary

This slice introduces a small but persisted project-template catalog so clients do not need to hardcode workflow defaults.

## Runtime changes

- Added `GET /v1/project-templates`.
- Added `templateId` support on task creation.
- Template defaults now resolve `risk` and `workflowTemplate` before task persistence.
- `templateId` is now stored on `tasks` and returned in task payloads.

## Current templates

- `default`
- `webapp-basic`
- `ops-rapid-response`
- `high-assurance`

## Validation

- Validation lane: medium
- Checks run:
  - `node --check apps/sofia-api/src/project-templates.js`
  - `node --check apps/sofia-api/src/postgres-store.js`
  - `node --check apps/sofia-api/src/runtime-backend.js`
  - `node --check apps/sofia-api/src/index.js`
  - `node apps/sofia-api/scripts/migrate.js`
  - boot API, request `GET /v1/project-templates`, and create a task with `templateId=webapp-basic`
- Result: template catalog returned `200`, task creation returned `201`, and the created task persisted `templateId`, `risk=low`, and `workflowTemplate=builder_only`

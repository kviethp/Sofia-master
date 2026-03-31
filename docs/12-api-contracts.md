# API Contracts

## Core endpoints

### Health and ops
- `GET /health`
- `GET /health/ready`
- `GET /v1/doctor`
- `GET /v1/runtime/status`
- `GET /v1/runtime/metrics`
- `POST /v1/smoke`

### Templates and tasks
- `GET /v1/project-templates`
- `GET /v1/tasks`
- `POST /v1/tasks`
- `GET /v1/tasks/:id`
- `POST /v1/tasks/:id/start`
- `POST /v1/tasks/:id/approve`
- `POST /v1/tasks/:id/reject`

### Runs
- `GET /v1/runs`
- `GET /v1/runs/:id`
- `POST /v1/runs/:id/replay`

### Approvals
- `GET /v1/approvals`
- `GET /v1/approvals/pending`

## Contract rule

The API should never expose raw vendor-specific request formats as primary contracts. Adapters translate internally.

## Current contract coverage

- `openapi/sofia-api.yaml` now includes component schemas for:
  - tasks
  - runs
  - approvals
  - runtime status and metrics
  - doctor and smoke reports
- contract shape now matches the current runtime surface closely enough for:
  - admin shell polling
  - web shell task creation
  - approval polling and replay tooling

## Remaining gaps

- the OpenAPI file is still scaffold-grade for examples and error variants
- request and response examples should be added before external client generation is treated as stable

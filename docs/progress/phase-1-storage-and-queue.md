# Phase 1 Progress Note - Storage and Queue Slice

## Checkpoint

Phase 1 scaffold hardening for PostgreSQL and Redis-backed task execution.

## Goal

Replace filesystem-only scaffolding with a real optional runtime path that uses PostgreSQL for state and Redis for queue coordination, while keeping a safe fallback when those services are unavailable.

## Completed

- Added PostgreSQL-backed storage functions for tasks, runs, artifacts, and provider usage.
- Added Redis-backed queue primitives for run enqueue and dequeue.
- Added a runtime backend that selects `postgres-redis` mode when both services are reachable and falls back to filesystem scaffolding otherwise.
- Added `migrate` support using `sql/001_initial_schema.sql`.
- Updated API endpoints, smoke flow, and worker flow to use the runtime backend.
- Updated the local SSH config to forward PostgreSQL and Redis from the VPS.
- Installed PostgreSQL and Redis on the VPS and created the `sofia` database and role.
- Validated the full runtime path with a tunnel-backed local test:
  - `migrate`
  - `doctor`
  - `preflight`
  - `smoke`
  - `worker`

## Key results

- `doctor` passes in `postgres-redis` mode when tunnels are active.
- `smoke` now reaches `runtime_pass` against PostgreSQL + Redis.
- The worker can consume queued runs and exits cleanly when the queue is empty.
- The repository still runs in fallback mode if PostgreSQL or Redis is absent.

## Files touched

- `apps/sofia-api/src/postgres-store.js`
- `apps/sofia-api/src/redis-queue.js`
- `apps/sofia-api/src/runtime-backend.js`
- `apps/sofia-api/src/doctor.js`
- `apps/sofia-api/src/smoke.js`
- `apps/sofia-api/src/index.js`
- `apps/sofia-api/scripts/migrate.js`
- `apps/sofia-worker/src/index.js`
- `sql/001_initial_schema.sql`
- `package.json`
- `.env.example`

## Risks

- Local full-path validation depends on an active SSH tunnel to the VPS for ports `5432` and `6379`.
- The worker path is still scaffold-grade: one run at a time, no retries, no dead-letter handling, no lease semantics.
- Task state is real in PostgreSQL now, but policy enforcement and OpenClaw execution are still not yet part of the queued run path.

## Next step

Queue-backed execution, run-step tracing, and basic policy evidence are now wired in. The next step is conformance coverage for failure handling and degraded routing, followed by richer multi-phase worker orchestration.

# Phase 1 Progress Note - Lease and Recovery

## Checkpoint

Phase 1 durability hardening for lease heartbeat and stale-run recovery.

## Goal

Make the Redis-backed worker path recoverable under crash and delay conditions:
- running work keeps an active lease while execution is healthy
- expired running work can be reclaimed by another worker
- retries remain idempotent after reclaim

## Completed

- Added lease state to `runs`:
  - `attempt_count`
  - `lease_owner`
  - `lease_expires_at`
  - `last_heartbeat_at`
- Hardened PostgreSQL claim flow to:
  - claim queued runs exactly once
  - refresh lease ownership through heartbeat
  - reclaim expired running work
  - clear lease ownership on completion or failure
- Updated the runtime backend so a worker now:
  - claims queued work with a lease
  - emits heartbeat while execution is in progress
  - reclaims stale running work when the queue is empty
- Added deterministic execution delay support so heartbeat behavior can be tested without changing production flow.
- Expanded conformance coverage with:
  - `lease_heartbeat_preserves_run`
  - `stale_running_recovered`

## Evidence

- Migration passed against the VPS-backed PostgreSQL instance after schema ordering was fixed for existing databases.
- Conformance passed against the live runtime:
  - `doctorStatus = pass`
  - `storageMode = postgres-redis`
  - `passed = 9`
  - `failed = 0`
- The stale recovery path now records `lease_reclaimed` as run trace evidence.
- Healthy long-running execution completes with:
  - `attemptCount = 1`
  - no `lease_reclaimed` step
  - refreshed `lastHeartbeatAt`

## Remaining gaps

- Dead-letter, retry-cap handling, and retry backoff now exist, but there is still no richer retry policy by failure class.
- The worker process still handles one run per invocation instead of running as a durable loop with shutdown semantics.
- Reclaim currently operates at run granularity only; there is still no step-level resume or partial-progress replay.

## Next step

Move from lease-based recovery to production-grade worker durability:
- richer retry policy
- multi-worker loop and graceful shutdown
- dead-letter replay tooling

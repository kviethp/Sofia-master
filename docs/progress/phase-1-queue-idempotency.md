# Phase 1 Progress Note - Queue Idempotency

## Checkpoint

Phase 1 queue hardening for duplicate delivery and retry safety.

## Goal

Ensure the Redis queue path behaves safely under at-least-once delivery:
- the same run must not execute twice
- requeueing a completed run must not duplicate artifacts or usage
- requeueing a failed run must not mutate it into a second failure record

## Completed

- Hardened run claiming so a run only transitions from `queued` to `running` once.
- Added skip handling when a dequeued run is already `running`, `completed`, or `failed`.
- Recorded `claim_skipped` as run trace evidence for duplicate or stale queue deliveries.
- Added usage-list retrieval so idempotency checks can verify that duplicate delivery does not create extra ledger rows.
- Expanded conformance coverage with queue-specific scenarios:
  - `duplicate_delivery_idempotent`
  - `completed_retry_idempotent`
  - `failed_retry_idempotent`

## Evidence

- Conformance passed with queue-idempotency scenarios enabled.
- Completed runs still end with exactly:
  - one final artifact row
  - one provider usage row
- Failed runs still end with:
  - one error artifact row
  - zero provider usage rows
- Duplicate queue deliveries append trace evidence instead of re-executing the run.

## Remaining gaps

- Lease heartbeat, stale-run reclaim, and dead-letter handling now exist.
- The queue remains single-run and single-worker in practice.
- There is still no retry backoff policy.

## Next step

Move from duplicate-safe delivery to production-grade durability:
- backoff policy between retries
- multi-worker lifecycle management
- dead-letter inspection and replay

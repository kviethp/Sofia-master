# Phase 1 Dead-Letter Replay And Retry Policy

## Summary

This slice hardens the durability path after stale-run recovery and dead-lettering.

## Runtime changes

- Added `replayDeadLetterRun()` to the API runtime and exposed `POST /v1/runs/{id}/replay`.
- Replayed runs are re-queued on Redis and continue through the normal worker path.
- Dead-letter replay keeps the prior error artifact for auditability and adds a new success artifact if the replayed attempt completes.
- Failure handling now emits explicit durability evidence classifying retry behavior for transient failures.

## Conformance additions

- `dead_letter_replay_requeues_run`
- `transient_failure_retry_policy_classified`

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/runtime-backend.js`
  - `node --check apps/sofia-api/src/conformance.js`
  - `node --check apps/sofia-api/src/index.js`
  - `node apps/sofia-api/scripts/conformance.js --group durability`
- Result: `durability` passed `9/9` on the VPS-backed runtime

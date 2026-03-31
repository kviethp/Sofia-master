# Phase 1 Progress Note - Dead Letter and Retry Cap

## Checkpoint

Phase 1 durability hardening for exhausted stale runs.

## Goal

Stop unsafe infinite reclaim loops by capping stale-run retries and routing exhausted work into a durable dead-letter path.

## Completed

- Added dead-letter metadata to `runs`:
  - `dead_letter_reason`
  - `dead_lettered_at`
- Added `dead_lettered` to the shared run status surface.
- Extended stale-run reclaim logic so expired work now:
  - reclaims while attempts remain under the cap
  - transitions to `dead_lettered` once the cap is exhausted
- Added Redis dead-letter queue support:
  - `sofia:runs:dead-letter`
- Recorded dead-letter evidence in the run trace:
  - `dead_lettered`
  - `dead_letter_enqueued`
  - durability decision `retry_cap`
- Expanded conformance with:
  - `stale_run_dead_lettered_after_max_attempts`

## Evidence

- Migration passed against the existing VPS-backed database after adding the dead-letter columns.
- Conformance passed against the live runtime:
  - `doctorStatus = pass`
  - `storageMode = postgres-redis`
  - `passed = 10`
  - `failed = 0`
- The exhausted stale-run scenario now proves:
  - final run status `dead_lettered`
  - error artifact written
  - zero usage rows written
  - dead-letter payload pushed to Redis

## Remaining gaps

- Backoff now exists, but there is still no richer retry policy by failure type.
- The worker can loop locally now, but it is not yet packaged as a supervised service.
- Dead-letter replay and operator tooling are not implemented.

## Next step

Move from bounded dead-letter handling to operational durability:
- richer retry policy
- durable worker service packaging
- dead-letter inspection and replay tooling

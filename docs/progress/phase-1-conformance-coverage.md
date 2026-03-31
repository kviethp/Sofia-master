# Phase 1 Progress Note - Conformance Coverage

## Checkpoint

Phase 1 failure-mode coverage for the Sofia execution slice.

## Goal

Turn the most important runtime assumptions into repeatable checks:
- routing policy does not degrade critical work to free fallback
- notification failure does not strand a run
- execution failure still leaves a complete trace
- degraded routing is recorded as evidence
- healthy long-running execution retains its lease
- stale running work can be reclaimed cleanly

## Completed

- Added a dedicated conformance runner:
  - `apps/sofia-api/src/conformance.js`
  - `apps/sofia-api/scripts/conformance.js`
- Added a package script:
  - `pnpm conformance`
- Added deterministic test hooks for:
  - forced profile selection
  - simulated notification failure
  - simulated execution failure
- Added grouped conformance execution for faster checkpoints:
  - `routing`
  - `durability`
  - `notifications`
  - `execution`
  - `execution-scaffold`
  - `execution-e2e`
- Implemented and validated these scenarios:
  - `multi_phase_golden_path`
  - `policy_critical_never_free`
  - `notification_failure_isolated`
  - `execution_failure_trace_complete`
  - `degraded_routing_evidence`
  - `lease_heartbeat_preserves_run`
  - `duplicate_delivery_idempotent`
  - `stale_running_recovered`
  - `stale_reclaim_backoff_respected`
  - `stale_run_dead_lettered_after_max_attempts`
  - `completed_retry_idempotent`
  - `failed_retry_idempotent`

## Evidence

- Conformance runner passed against the VPS-backed runtime:
  - `doctorStatus = pass`
  - `storageMode = postgres-redis`
  - `passed = 11`
  - `failed = 0`
- Reports written:
  - `.sofia/reports/conformance-report.json`
  - `.sofia/reports/conformance-report.md`

## Remaining gaps

- These are still targeted scenario checks, not a full release-grade matrix.
- Request transport edge cases such as timeout and network interruption are not yet covered.
- Dead-letter replay and error-type-specific retry policy are not yet covered.
- Only one end-to-end execution scenario currently uses the full multi-phase runtime path.

## Next step

Expand conformance from the current grouped runner to:
- dead-letter replay and richer retry policy
- request transport edge cases
- broader multi-phase orchestration and approval behavior

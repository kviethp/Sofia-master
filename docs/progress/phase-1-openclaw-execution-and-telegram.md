# Phase 1 Progress Note - OpenClaw Execution and Telegram Reporting

## Checkpoint

Phase 1 runtime wiring for queued execution through OpenClaw with operator-visible Telegram reporting.

## Goal

Move the queued run path beyond synthetic completion so Sofia can:
- select a Sofia model profile
- execute a real OpenClaw local agent turn
- record artifacts and usage in PostgreSQL
- notify the operator through Telegram

## Completed

- Extended the OpenClaw adapter to:
  - validate config
  - list and bootstrap isolated OpenClaw agents for `sofia-hard`, `sofia-fast`, and `sofia-free-fallback`
  - run local agent turns
  - send Telegram messages
- Added `run-executor.js` so queued Sofia runs can:
  - map Sofia policy profiles to OpenClaw agents
  - execute the task prompt through OpenClaw
  - persist an execution artifact under `.sofia/artifacts/<run-id>/openclaw-execution.json`
  - send `started` and `completed` or `failed` notifications to Telegram
- Hardened the PostgreSQL path so queue, completion, and failure writes now commit on a pinned transaction client instead of loose pool-level calls.
- Isolated Telegram reporting failures so notification problems do not strand a run in `running`.
- Updated the policy engine so Sofia now resolves the live runtime profiles:
  - `sofia-hard`
  - `sofia-fast`
  - `sofia-free-fallback`
- Tightened the control-plane probe prompt so execution smoke checks do not intentionally create files or call tools.
- Reconciled routing docs and examples to the `sofia-*` profile names instead of stale `gpt-5.4-mini` placeholders.

## Evidence

- Tunnel-backed local validation against the VPS runtime passed for:
  - `node apps/sofia-api/scripts/migrate.js`
  - `node apps/sofia-api/scripts/doctor.js`
  - `node apps/sofia-api/scripts/preflight.js`
  - `node apps/sofia-api/scripts/smoke.js`
- `smoke` reached:
  - `result = runtime_pass`
  - `storageMode = postgres-redis`
  - task state `completed`
  - run state `completed`
- The medium-risk builder smoke path now resolves and records:
  - `run.modelProfile = sofia-fast`
  - `provider_usage.modelProfile = sofia-fast`
- Artifact path written:
  - `.sofia/artifacts/run_*/openclaw-execution.json`
- Usage row written with the Sofia runtime profile and provider:
  - `provider = router9`
  - `modelProfile = sofia-fast` for the medium-risk builder smoke path
- Telegram reporting delivered using the configured OpenClaw bot channel.

## Remaining gaps

- The execution bridge still runs one turn at a time and has no phase separation across planner, builder, and verifier.
- Usage currently records the requested Sofia profile and provider, not the full provider-internal fallback trace from 9Router.
- The worker path is still scaffold-grade and does not yet separate planner, builder, and verifier phases.
- Embedded OpenClaw execution is still unsandboxed at the OpenClaw workspace layer, so higher-trust tasks need explicit execution policy before full rollout.
- Retry backoff, graceful shutdown, and dead-letter replay are still missing from the worker path.

## Next step

Run-step tracing, conformance, and lease recovery are now in place. The next step is multi-phase orchestration with stronger worker durability and approval semantics.

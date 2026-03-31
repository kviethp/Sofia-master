# Phase 1 Progress Note - Run Trace and Policy Evidence

## Checkpoint

Phase 1 state hardening for execution traceability and routing evidence.

## Goal

Extend Sofia's runtime state so a completed run can be inspected as more than:
- final task status
- final run status
- one artifact
- one usage row

The runtime should now retain:
- run-step trace
- routing and execution decisions
- notification outcomes

## Completed

- Extended the PostgreSQL schema with:
  - `run_steps`
  - `decisions`
- Added store helpers to:
  - append run steps
  - append decisions
  - list run steps
  - list run decisions
- Updated the runtime path so a queued run now records:
  - `queued`
  - `running`
  - `execution_requested`
  - `notify_started`
  - `notify_completed`
  - `execution_completed`
  - final `completed` or `failed`
- Recorded routing evidence at two points:
  - initial requested profile selection
  - actual OpenClaw agent execution choice
- Updated `GET /v1/runs/{id}` contract to include:
  - `artifacts`
  - `steps`
  - `decisions`
- Kept the filesystem scaffold path shape aligned by returning synthetic `steps` and `decisions`.

## Evidence

- Tunnel-backed validation passed after migration:
  - `node apps/sofia-api/scripts/migrate.js`
  - `node apps/sofia-api/scripts/smoke.js`
- Smoke now returns:
  - `artifacts`
  - `steps`
  - `decisions`
- Latest validated runtime path recorded:
  - `run.modelProfile = sofia-fast`
  - `decision.routing.requested_profile = sofia-fast`
  - `decision.routing.openclaw_agent.selectedAgentId = sofia-fast`
  - `decision.routing.openclaw_agent.actualProvider = router9`
  - `notify_started = completed`
  - `notify_completed = completed`

## Remaining gaps

- `run_steps` are append-only but still coarse; there is not yet a distinct planner/build/verify phase model.
- Decision evidence still reflects Sofia-visible routing state, not the full provider-internal fallback chain inside 9Router.
- Approval events are not yet first-class because approval flow is configured in OpenClaw but not yet emitted back into Sofia state.
- There is still no conformance suite asserting the trace contract under failure scenarios.

## Next step

Conformance coverage now exists for notification failure isolation, degraded routing evidence, and execution failure trace completeness. The next step is queue-durability coverage and then multi-phase worker orchestration.

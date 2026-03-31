# Phase 1 Multi-Phase Workflow

Status: implemented at scaffold-grade runtime depth.

What changed:
- Added workflow state to tasks with `workflow_template` and `current_phase`.
- Added `phase_index` to runs so execution order is explicit and queryable.
- Changed the default task workflow from single-run builder execution to `planner -> builder -> verifier`.
- Made run completion queue the next phase automatically until the task closes.
- Exposed task runs in the runtime response so smoke and API callers can inspect phase progression.
- Added targeted conformance for the real multi-phase golden path.

Validated on 2026-03-29:
- `migrate`
- `smoke`
- `conformance --group execution-e2e`
- `conformance --group durability`

Observed result:
- smoke completed with three ordered runs:
  - planner using `sofia-hard`
  - builder using `sofia-fast`
  - verifier using `sofia-hard`
- durability checks still passed by forcing those scenarios onto the explicit `builder_only` workflow.

Notes:
- This is still scaffold-grade orchestration, not a full planner/builder/verifier product layer.
- Approval gates, richer handoff artifacts, and per-phase policy escalation remain future work.

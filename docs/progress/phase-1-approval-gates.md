# Phase 1 Approval Gates

Status: implemented at scaffold-grade runtime depth.

What changed:
- Added PostgreSQL-backed `approvals` records.
- Added a risk gate so `high` and `critical` workflows pause before `builder`.
- Added API/runtime actions to approve or reject a pending gate.
- Added automatic resume after approval when inline worker mode is enabled.
- Added targeted conformance for pause-on-gate and resume-after-approval behavior.

Validated on 2026-03-29:
- `migrate`
- `conformance --group approvals`

Observed result:
- high-risk tasks stop after `planner` with `task.status = awaiting_approval`
- approval creates the queued `builder` phase and can drive the task to completion
- rejection path is stored in the runtime surface, though only the approval path is currently covered by conformance

Notes:
- The current gate transport is still scaffold-grade.
- Telegram can carry approval notifications, but interactive Telegram decision handling is not yet first-class state input.

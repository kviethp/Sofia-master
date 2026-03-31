# Phase 1 Compose Service Surface

Status: scaffold-grade service packaging expanded.

What changed:
- Added a Compose `api` service so the core HTTP surface can boot inside the local stack.
- Kept `worker` as an opt-in profile for loop-based queue processing.
- Added an opt-in `approval-poller` profile for Telegram approval polling.
- Kept execution mode in Compose scaffold-safe by default with `SOFIA_EXECUTION_MODE=scaffold`.

Notes:
- This is still not a production Compose topology.
- OpenClaw and 9Router are treated as external runtime dependencies in the current local stack.
- The Compose surface now matches the main runnable services more closely, which reduces drift between docs and operator workflow.

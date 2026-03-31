# Phase 1 Approval Poller Packaging

Status: scaffold-grade loop packaging added.

What changed:
- Added `pnpm approvals:loop` as the practical loop-capable entry point for Telegram approval polling.
- Added `scripts/approval-poller-loop.mjs` so approval polling can run continuously without manual shell loops.
- Updated the root startup note so the approval poller is surfaced alongside the worker loop.

Notes:
- This is a loop wrapper, not a supervised daemon.
- It is intended to pair with the existing worker loop and future service packaging.

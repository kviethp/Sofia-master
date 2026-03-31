# Phase 1 Telegram Approval Poller

Status: implemented at scaffold-grade runtime depth.

What changed:
- Added a Telegram approval poller script:
  - `pnpm approvals:poll`
- The poller reads Telegram updates from the configured OpenClaw bot token.
- Supported commands:
  - `/approve <taskId> [note]`
  - `/reject <taskId> [note]`
- Approval state stays in Sofia/PostgreSQL; Telegram is only a transport surface.
- The poller stores the Telegram update offset under `.sofia/state/telegram-approval-offset.json`.

Notes:
- This is a one-way polling transport, not a full conversational control plane yet.
- Interactive button callbacks are not wired yet.
- The poller relies on the allowlist already configured in OpenClaw Telegram settings.

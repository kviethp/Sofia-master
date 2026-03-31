# Phase 0 Migration Reconciliation Plan

## Objective

Keep the existing OpenClaw and 9Router runtime stable while Sofia Master is introduced on top of it.

## Principles

- Do not overwrite existing runtime config without backup.
- Prefer additive integration over destructive migration.
- Keep OpenClaw gateway loopback-only unless a separate access decision is recorded.
- Keep 9Router as the model gateway, not as the business logic layer.
- Keep Telegram as transport for reports and approvals, not as state storage.

## Current desired state

- Sofia Master owns orchestration, workflow, policy, audit, and artifact state.
- OpenClaw owns runtime execution and Telegram channel delivery.
- 9Router owns model routing, fallback, and provider selection.

## Migration steps

### Step 1: Preserve current runtime

- Keep `/root/.openclaw/openclaw.json` backed up for every config mutation.
- Keep current 9Router catalog and model aliases intact until Sofia policy maps are explicit.
- Avoid changing OpenClaw gateway bind from `loopback` until remote access requirements are defined.

### Step 2: Introduce Sofia as a thin orchestration layer

- Build Sofia API and worker around the current runtime rather than replacing it.
- Teach Sofia to read the current model profile names:
  - `router9/sofia-hard`
  - `router9/sofia-fast`
  - `router9/sofia-free-fallback`
- Treat the Telegram channel as a reporting and approval surface for Sofia events.

### Step 3: Add policy and state ownership

- Move task/run state into Sofia storage.
- Make routing policy explicit in Sofia artifacts.
- Persist model choice, fallback depth, and execution results in Sofia records.

### Step 4: Validate with read-only probes first

- `openclaw config validate`
- `openclaw channels status`
- 9Router model list probe
- gateway reachability probe
- Telegram send test for notifications

### Step 5: Add controlled write operations

- After probes pass, let Sofia create tasks and runs in its own storage.
- Allow Sofia to emit notifications to Telegram.
- Allow Sofia to request OpenClaw execution only after policy approval.

### Step 6: Harden and document

- Record any gateway binding, auth, or transport change in ADRs.
- Add compatibility notes before replacing any runtime default.
- Publish tested version metadata once Sofia touches the runtime more broadly.

## Reconciliation backlog

- Add a Sofia runtime inventory command.
- Add a Sofia config audit command for OpenClaw and 9Router.
- Add a machine-readable provider and model mapping for `router9/*`.
- Add a message/report schema for Telegram notifications.
- Add a checkpointed handoff format for multi-agent work.

## Rollback stance

If a future Sofia change breaks execution or Telegram delivery:
- restore `/root/.openclaw/openclaw.json` from the backup
- restart the local OpenClaw gateway
- verify `openclaw channels status`
- leave 9Router untouched unless the fault is in routing data

## Exit criteria for the reconciliation phase

- Sofia can read the runtime without mutating it.
- Sofia can emit a report to Telegram.
- Sofia can select the intended `router9/*` profile by policy.
- Runtime state remains reversible.

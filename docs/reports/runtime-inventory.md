# Phase 0 Runtime Inventory

## Scope

This inventory captures the live runtime state for the Sofia Master Phase 0 audit.

## Snapshot

- Host: `tapchiktcatbd`
- OS: `Ubuntu 22.04.3 LTS`
- VPS access: `<redacted-host>:<redacted-port>`
- OpenClaw gateway: `127.0.0.1:18789`
- 9Router base URL: `http://127.0.0.1:20128/v1`
- Telegram channel: enabled, polling, DM allowlist

## OpenClaw

- Config path: `/root/.openclaw/openclaw.json`
- Config validation: pass
- Agent default model: `router9/sofia-hard`
- Workspace: `/root/.openclaw/workspace`
- Tools profile: `coding`
- Command behavior: native `auto`, restart `true`, owner display `raw`
- Session scope: `per-channel-peer`
- Gateway mode: `local`
- Gateway bind: `loopback`
- Gateway port: `18789`
- Gateway auth: token based
- Gateway token: present, redacted in this report

### Telegram channel

- Enabled: yes
- Transport mode: polling
- DM policy: allowlist
- Allowed Telegram user ID: `<redacted-user-id>`
- Default target: `<redacted-user-id>`
- Group policy: disabled
- Approval target: DM
- Approval approvers: `<redacted-user-id>`
- Bot token: present, redacted in this report

### Confirmed behavior

- `openclaw config validate` returned `Config valid: ~/.openclaw/openclaw.json`
- `openclaw channels status` reported gateway reachable and Telegram channel running
- `openclaw message send` to Telegram succeeded during verification

## 9Router

- Service state: active
- Host bind: loopback
- Port: `20128`
- Models endpoint: `/v1/models`
- Models list: reachable
- Gateway health: HTTP `200` on the local gateway endpoint

### Active model catalog

- `sofia-hard`
- `sofia-fast`
- `sofia-free-fallback`
- Provider model groups visible in catalog:
  - `cx/*`
  - `qw/*`
  - `kr/*`
  - `cl/*`
  - `glm/*`

## Shared environment

- 9Router systemd service: active
- OpenClaw runtime: local gateway on loopback only
- SSH tunnel required for local dashboard access from the workstation
- Config backup created before Telegram changes:
  - `/root/.openclaw/openclaw.json.bak-telegram-20260329T091302Z`

## Observations

- The runtime is coherent enough for Sofia Master to treat `OpenClaw -> 9Router` as a valid integration target.
- Telegram reporting is already usable as an execution/reporting side channel.
- Gateway auth is enabled and should remain loopback-only unless a separate remote-access decision is recorded.

## Recommended next audit artifacts

- `docs/compat/phase-0-runtime-compatibility.md`
- `docs/adr/phase-0-openclaw-gateway-binding.md`
- `docs/reports/conflict-report.md`
- `docs/reports/migration-reconciliation-plan.md`

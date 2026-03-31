# Phase 0 Conflict Report

## Summary

No blocking runtime conflict was found in the current live setup. The audit did surface a few controlled risks that should be recorded before Sofia Master begins mutating runtime state.

## Conflicts and risks

### 1. Secrets exist in runtime config

- OpenClaw gateway token is stored in `/root/.openclaw/openclaw.json`
- Telegram bot token is also stored in the same config file
- These values are operationally required but should be treated as secrets, not implementation facts

Risk:
- accidental disclosure in reports, logs, or future handoff notes

Recommendation:
- keep secret values redacted in artifacts
- rotate token values if a later hardening phase requires it

### 2. Gateway is loopback-bound

- OpenClaw gateway bind is `loopback`
- Dashboard access requires SSH tunneling from the workstation

Risk:
- direct remote access will fail by design
- future automation that assumes public access will be incorrect

Recommendation:
- keep the gateway loopback-bound by default
- document any remote-access change as a separate ADR

### 3. Telegram is configured as a delivery channel, not a task owner

- Telegram is enabled as polling DM transport
- It is suitable for reports, approvals, and lightweight operator interaction

Risk:
- future agents may incorrectly treat Telegram as the system of record

Recommendation:
- keep task state and workflow state inside Sofia storage
- treat Telegram as notification and approval transport only

### 4. 9Router catalog is rich, but policy is still externalized

- `sofia-hard`, `sofia-fast`, and `sofia-free-fallback` exist
- `OpenClaw` already points at `router9/sofia-hard`

Risk:
- multi-agent work may drift if model selection policy remains only in prose

Recommendation:
- move routing and fallback behavior into Sofia policy artifacts as implementation progresses

### 5. Pack docs are stronger than runtime code

- The pack defines architecture, phase gates, and multi-agent handoff rules
- Most runtime code paths are still scaffold or placeholder

Risk:
- a worker can mistake scaffold for implemented behavior

Recommendation:
- require the status matrix before any edit
- require runtime evidence before any claim of implementation completion

## Non-blocking items

- OpenClaw config validation passes
- 9Router responds on the expected local endpoint
- Telegram delivery works
- No port collision was observed in the current snapshot

## Conclusion

Current runtime conflicts are manageable and mostly concern secret handling, access scope, and future policy drift. None of them block Phase 1 scaffold work if the next phase stays bounded and evidence-driven.

# Phase 0 Runtime Compatibility

## Tested baseline

- Host OS: Ubuntu 22.04.3 LTS
- OpenClaw gateway: local loopback bind
- 9Router: local loopback service
- Telegram channel: polling DM delivery

## Compatibility notes

### What is working

- OpenClaw config validates on the current runtime.
- OpenClaw can reach its gateway.
- OpenClaw can send Telegram messages.
- 9Router serves the model catalog and combo profiles expected by the current OpenClaw configuration.

### What is intentionally constrained

- No direct public gateway exposure.
- No assumption that every OpenAI-compatible endpoint supports the same tool-call semantics.
- No destructive runtime config mutation by default.

### What Sofia Master must preserve

- Loopback-bound gateway access unless changed by policy.
- Existing 9Router combo names and fallback behavior until Sofia owns the mapping.
- Telegram as a delivery/approval channel only.

## Release metadata to capture later

- Tested OpenClaw version: `2026.3.28`
- Tested 9Router version: record when release metadata is available from the runtime pack
- Tested Node version: record in the next runtime-verified release artifact
- Supported model profile defaults:
  - `router9/sofia-hard`
  - `router9/sofia-fast`
  - `router9/sofia-free-fallback`

## Compatibility recommendation

Sofia Master should start with read-only probes and additive integration. Do not convert the current runtime into a different access model before the orchestration layer can prove it preserves the existing behavior.

# ADR 0001: Keep OpenClaw Gateway Loopback-Bound During Sofia Phase 0

## Status

Accepted

## Context

The live OpenClaw runtime on the VPS is already configured with:
- gateway mode `local`
- gateway bind `loopback`
- token auth enabled

The current workflow also uses SSH tunneling for dashboard access from the workstation.

## Decision

Keep the OpenClaw gateway bound to `127.0.0.1` for Phase 0 and the initial Sofia scaffold phases.

## Consequences

- Dashboard access remains tunnel-based.
- The runtime is not exposed publicly by default.
- Sofia can treat gateway access as a local integration boundary instead of a network-hardening problem.
- Any future public access change must be an explicit ADR with rollback instructions.

## Rationale

- Preserves the current working runtime.
- Reduces accidental exposure while Sofia is still a scaffold.
- Keeps the migration additive and reversible.

## Follow-up

- If remote gateway access becomes required later, record a separate ADR with port exposure, auth, and rollback details.

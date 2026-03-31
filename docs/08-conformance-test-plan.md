# Conformance Test Plan

## Purpose

Conformance tests verify that Sofia, OpenClaw, and 9Router interact correctly under supported behaviors.

## Test domains

### Provider discovery
- list models
- resolve required profile
- missing profile behavior

### Request transport
- normal completion
- streaming completion
- long output
- request timeout
- network interruption

### Tool execution flow
- worker emits tool result
- tool result captured in artifacts
- retries do not duplicate final state

### Routing policy
- critical task cannot route to free tier
- fallback chain remains within allowed policy
- builder and verifier separation holds

### Run durability
- worker crash mid-run
- resume run
- duplicate message handling
- queue retry idempotency

### Audit and usage
- ledger entry written
- routing decision trace recorded
- fallback event recorded
- error normalized

## Test levels

- unit
- integration
- system
- smoke
- nightly compatibility

## Release gates

A release candidate should not be promoted unless:
- smoke passes
- provider compatibility target passes
- critical routing rules pass
- golden path demo passes

## Current implemented coverage

The current runnable implementation includes targeted checks for:
- multi-phase golden path executes `planner -> builder -> verifier` on the real OpenClaw path
- approval gates block high-risk work before `builder` and can resume after approval
- critical builder routing does not fall to `sofia-free-fallback`
- Telegram notification failure does not strand a run
- execution failure still records run trace and routing evidence
- degraded routing records the expected profile and OpenClaw agent evidence
- lease heartbeat keeps a healthy long-running execution from being reclaimed
- duplicate queue delivery does not duplicate final state
- stale running work can be reclaimed after lease expiry
- stale running work respects retry backoff before reclaim
- stale running work is dead-lettered after the retry cap is exhausted
- dead-lettered work can be replayed and complete on the next healthy attempt while preserving the prior failure artifact
- transient execution failures are classified with retry-oriented durability evidence
- retry of completed runs remains idempotent
- retry of failed runs remains idempotent

## Validation lanes

- fast lane: import checks plus one relevant conformance group
- medium lane: `migrate` plus `smoke` or one to two relevant groups
- checkpoint lane: `migrate`, `smoke`, and full conformance
- milestone lane: full validation against the VPS runtime

## Execution split

- `execution-scaffold` covers execution-path behavior with simulated failure or scaffold-friendly hooks
- `execution-e2e` is reserved for the real multi-phase golden path
- `approvals` covers approval gate pause-and-resume behavior
- Telegram stays disabled for most scenarios and is exercised only in the notification-focused checks
- durability scenarios use `builder_only` workflow to keep single-run semantics explicit
- `smoke` now defaults to `templateId=webapp-basic` for a faster single-run runtime check; set `SOFIA_SMOKE_TEMPLATE_ID=default` to force the multi-phase path

# Phase 1 Checkpoint: Policy Guardrails And Runtime Visibility

## Summary

This checkpoint closes the loop on policy guardrails by enforcing them at execution time, surfacing them in runtime/admin APIs, and validating the result on the VPS-backed stack.

## Included slices

- policy denylist enforcement
- token budget enforcement
- runtime policy visibility
- OpenAPI contract alignment for runtime, task, run, and approval entities
- operator-facing env and README updates

## Checkpoint validation

- lane: checkpoint
- steps:
  - `migrate`
  - `smoke`
  - `full conformance`
- result:
  - `migrate`: pass
  - `smoke`: `runtime_pass`
  - `full conformance`: `19/19 pass`

## Notes

- local DB/Redis validation now works again because a portable `plink.exe` tunnel is available for `5432` and `6379`
- the full checkpoint was run with report delivery disabled to keep the runtime path focused on control-plane behavior rather than Telegram noise

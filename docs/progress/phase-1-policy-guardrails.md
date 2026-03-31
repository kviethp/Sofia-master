# Phase 1 Policy Guardrails

## Summary

This slice tightens routing policy behavior for degraded execution and turns policy guardrails into runtime enforcement.

## Runtime changes

- degraded high-risk work now stays on a paid profile
- provider denylist is now enforced at execution time
- token budget caps are now enforced at execution time
- guardrail violations are recorded in run trace as policy decision evidence and explicit failed steps

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check packages/policy-engine/src/index.js`
  - `node --check apps/sofia-api/src/run-executor.js`
  - `node --check apps/sofia-api/src/conformance.js`
  - direct `runTaskWithOpenClaw()` validation for:
    - provider denylist
    - token budget cap
- Result:
  - degraded high-risk routing still resolves to paid tier
  - provider denylist blocks execution with `provider_denied`
  - token budget cap blocks execution with `total_token_budget_exceeded`

## Note

The routing conformance group still expects the VPS-backed PostgreSQL/Redis stack. On a machine without those forwarded ports, direct execution validation is the cheaper and more reliable lane for this slice.

# Phase 1 Runtime Policy Visibility

## Summary

This slice exposes active policy guardrails through the runtime API and admin surface.

## Changes

- `GET /v1/runtime/status` now includes:
  - denied providers
  - token budget caps
- `GET /v1/runtime/metrics` now includes the same policy snapshot
- `preflight` now reports active guardrail configuration
- `sofia-admin` now renders a `Policy Guardrails` panel

## Validation

- syntax/import checks passed for:
  - `runtime-backend.js`
  - `doctor.js`
  - `preflight.js`
  - `apps/sofia-admin/src/index.js`

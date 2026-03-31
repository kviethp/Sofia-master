# Phase 1 Operator Diagnostics Runner

## Summary

This slice adds a single command that aggregates the main incident-triage surfaces.

## Added

- `scripts/operator-diagnostics.mjs`
- `pnpm operator:diagnostics`
- report outputs:
  - `.sofia/reports/operator-diagnostics.json`
  - `.sofia/reports/operator-diagnostics.md`

## Coverage

- runtime status
- failed runs
- dead-letter runs
- running runs
- pending approvals

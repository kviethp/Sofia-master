# Phase 1 Admin Shell

## Summary

This slice upgrades `apps/sofia-admin` from a placeholder to a minimal operator dashboard shell.

## Runtime changes

- `apps/sofia-admin` now serves a static dashboard page
- current panels:
  - runtime health
  - runtime metrics
  - task status summary
  - run status summary
  - recent dead-letter runs
  - recent approvals
  - project templates

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-admin/src/index.js`
  - boot admin shell and request `/`
- Result: admin shell returned `200` and the page included the expected runtime and approval panels

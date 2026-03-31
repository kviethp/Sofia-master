# Phase 1 Web Shell

## Summary

This slice upgrades `apps/sofia-web` from a placeholder to a minimal user-facing shell.

## Runtime changes

- `apps/sofia-web` now serves a static page
- current capabilities:
  - list project templates
  - submit a task
  - list recent tasks

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-web/src/index.js`
  - boot web shell and request `/`
- Result: web shell returned `200` and included the task form and recent task list panels

# Phase 1 Control Token Auth

## Summary

This slice adds optional control-plane token auth to the Sofia API and thin shells.

## Changes

- `SOFIA_CONTROL_TOKEN` now protects all `/v1/*` routes when configured
- API accepts:
  - `Authorization: Bearer <token>`
  - `x-sofia-token`
- Sofia Web and Sofia Admin now allow storing the control token in local browser storage

## Validation

- syntax/import checks passed for:
  - `apps/sofia-api/src/index.js`
  - `apps/sofia-web/src/index.js`
  - `apps/sofia-admin/src/index.js`
- route probe confirmed:
  - `401` without token
  - `200` with the correct token
- both shells render:
  - control-token input
  - save-token action

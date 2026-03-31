# Phase 1 Admin Operator Actions

## Summary

This slice makes the admin shell materially more useful for runtime operations.

## Added actions

- replay dead-letter runs
- approve pending tasks
- reject pending tasks
- local action log in the admin shell

## Validation

- syntax/import check passed for `apps/sofia-admin/src/index.js`
- rendered HTML includes:
  - `Replay`
  - `Approve`
  - `Reject`
  - `Action Log`

## Remaining gap

- the admin shell still has no auth layer and remains a trusted-operator surface only

# Phase 1 OpenAPI Contract Alignment

## Summary

This slice expands the OpenAPI contract so the published API surface is closer to the current runtime.

## Contract changes

- added reusable component schemas for:
  - health and readiness
  - runtime status and metrics
  - project templates
  - tasks
  - runs
  - approvals
  - doctor and smoke reports
- added request bodies for:
  - task creation
  - approval approve/reject actions
  - dead-letter replay

## Remaining gaps

- examples are still sparse
- error variants are still generic
- external client generation should still be treated as scaffold-grade

## Validation

- parsed successfully as YAML
- current document shape:
  - `17` paths
  - `25` component schemas

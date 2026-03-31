# Phase 1 Self-Host Acceptance

## Summary

This slice adds a single acceptance runner for final self-host readiness.

## Added

- `scripts/self-host-acceptance.mjs`
- `pnpm selfhost:acceptance`
- acceptance report output under `.sofia/reports/`

## Coverage

- migrate
- doctor
- preflight
- smoke
- operator diagnostics
- release readiness
- release bundle
- release acceptance

## Goal

Reduce the final release decision to one reproducible self-host readiness report instead of a manual checklist.

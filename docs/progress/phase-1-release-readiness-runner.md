# Phase 1 Release Readiness Runner

## Summary

This slice turns the OSS/release checklist into a machine-readable report.

## Added

- `scripts/release-readiness.mjs`
- `pnpm release:readiness`
- CI step for release-readiness before doctor/preflight/smoke

## What it checks

- required OSS files
- required package scripts
- required env-example entries
- basic OpenAPI and Compose presence
- Dockerfile dependency install step

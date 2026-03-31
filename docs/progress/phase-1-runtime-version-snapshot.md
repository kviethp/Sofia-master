# Phase 1 Runtime Version Snapshot

## Summary

This slice adds release-oriented runtime version evidence to doctor reports.

## Runtime changes

- Doctor now emits:
  - Node version
  - Sofia package version
  - package manager version

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check apps/sofia-api/src/doctor.js`
  - `node apps/sofia-api/scripts/doctor.js`
- Result: doctor completed successfully on the VPS-backed runtime and included the runtime snapshot in the report

# Phase 1 CI Baseline

## Summary

This slice adds the first GitHub Actions workflow for the pack.

## Workflow scope

- checkout
- setup pnpm
- setup Node.js 22
- install dependencies
- run:
  - doctor
  - preflight
  - smoke

## Notes

- CI runs in scaffold mode
- VPS-backed runtime validation remains outside CI for now

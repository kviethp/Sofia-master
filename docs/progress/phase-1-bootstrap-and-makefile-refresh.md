# Phase 1 Bootstrap And Makefile Refresh

## Summary

This slice makes the install path more explicit and less shell-fragile.

## Changes

- added `scripts/bootstrap.mjs`
- added `pnpm bootstrap`
- updated `Makefile` to point at current Node entry points instead of shell placeholders
- updated `CONTRIBUTING.md` to use the bootstrap flow

## Validation

- Validation lane: targeted
- Checks run:
  - `node --check scripts/bootstrap.mjs`
  - `node scripts/bootstrap.mjs`
- Result: bootstrap ran successfully and reported host capability gaps such as missing `pnpm` and Docker CLI

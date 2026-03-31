# Phase 1 Release Acceptance

## Summary

This slice adds a concrete acceptance check for generated release bundles.

## Added

- `scripts/release-acceptance.mjs`
- `pnpm release:acceptance`

## What it validates

- required release paths exist in the generated bundle
- the bundled `scripts/bootstrap.mjs` can run from an out-of-tree copy
- the bundled `scripts/release-readiness.mjs` still passes from that copied bundle

## Goal

Reduce the gap between "bundle exists" and "bundle is credible as a releasable self-host artifact".

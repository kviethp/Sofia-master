# Phase 1 Release Bundle Artifact

## Summary

This slice adds a concrete release bundle artifact for OSS/self-host packaging.

## Added

- `scripts/release-bundle.mjs`
- `pnpm release:bundle`
- release manifest output under `.sofia/releases/<label>/release-manifest.json`

## Bundle contents

- root OSS docs
- `.env.example`
- `Makefile`
- `package.json`
- `pnpm-lock.yaml`
- `apps/`, `packages/`, `scripts/`, `infra/`, `docs/`, `sql/`, `templates/`, `examples/`, `.github/`

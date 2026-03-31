# OSS Packaging

## Goals

- easy to share
- easy to fork
- easy to self-host
- easy to contribute to

## Open-core layout

### Public core
- workflow engine
- policy engine
- adapters
- schema/compiler
- dashboard basic UI
- doctor/preflight
- local compose/dev mode

### Optional advanced layer
- enterprise auth
- advanced reporting
- premium integrations
- managed control plane

### Runtime artifacts
- local state
- generated reports
- temporary caches

## Installation modes

1. local development mode
2. single-host self-host mode
3. CI/test mode

## Required OSS files
- `README.md`
- `docs/public/CONTRIBUTING.md`
- `docs/public/SECURITY.md`
- `docs/public/SUPPORT.md`
- `docs/public/COMPATIBILITY.md`
- `docs/public/MODEL-POLICY.md`
- issue templates
- PR template

## Packaging outputs
- Docker Compose bundle
- `.env.example`
- bootstrap script
- quickstart guide
- `make doctor`
- `make up`
- `make smoke`
- `make reset`
- `node scripts/release-bundle.mjs`

## Current bundle artifact

Generate:

```bash
node scripts/release-bundle.mjs
```

Output:

- `.sofia/releases/<label>/`
- `release-manifest.json`

## Golden OSS user journey

- clone repo
- copy `.env.example`
- run install/bootstrap
- run `make up`
- run `make doctor`
- run golden path demo
- inspect resulting artifacts and logs

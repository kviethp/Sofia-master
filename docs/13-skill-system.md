# Skill System

## Principles

- author in Markdown if needed
- compile to JSON
- validate against schema
- runtime reads compiled assets only

## Required metadata
- skill id
- version
- owner
- description
- intent
- inputs
- constraints
- required tools
- expected outputs
- quality gates
- trust level
- signature hash

## Trust levels
- internal-trusted
- reviewed-third-party
- quarantined-experimental

## Initial priority skills
- plan-task
- decompose-task
- architecture-review
- implement-feature
- write-tests
- fix-bug
- review-change
- secret-scan
- deploy-check
- document-change

## Sofia-specific priority skills

The generic skills above are not enough for sustained Sofia development. The next skills to formalize are:

- runtime-ops
- openclaw-9router
- postgres-redis-runtime
- conformance
- release-deploy
- docs-bilingual
- ui-operator-flows

## Role bundles

Recommended bundles by role:

- Runtime Audit and Reconciliation: `runtime-ops`, `secret-scan`, `deploy-check`
- Core Platform: `implement-feature`, `postgres-redis-runtime`, `conformance`, `write-tests`
- Integrations: `openclaw-9router`, `conformance`, `review-change`
- UI and Operator Experience: `ui-operator-flows`, `document-change`, `review-change`
- OSS and Release: `release-deploy`, `docs-bilingual`, `secret-scan`, `document-change`
- QA Reviewer: `architecture-review`, `review-change`, `deploy-check`, `secret-scan`

## Current limitation

These skills can be authored in Markdown, validated, compiled into JSON artifacts, and loaded by the runtime. OpenClaw execution now checks the compiled skill registry plus allowed trust levels before it runs. Third-party trust policy and richer role-to-skill execution selection are still intentionally narrow.

## Current commands

- `pnpm skills:validate`
- `pnpm skills:compile`
- `pnpm agent-system:conformance`

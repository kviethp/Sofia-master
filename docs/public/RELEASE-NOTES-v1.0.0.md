# Sofia Master v1.0.0

## Summary

`v1.0.0` is the first publish-ready Sofia Master release.

This release delivers a self-hostable orchestration layer on top of OpenClaw and 9Router, with validated single-host deployment, staging/production separation, and operator tooling.

## Included

- PostgreSQL and Redis-backed runtime
- multi-phase `planner -> builder -> verifier` workflow
- policy-driven model routing
- approval gates and approval polling
- run trace, artifacts, usage evidence, and decisions
- retry classification, stale-run recovery, dead-letter handling, and replay
- Sofia Web and Sofia Admin operator surfaces
- release bundle, release acceptance, self-host acceptance, and final readiness gates
- systemd templates for single-host self-host deployment
- Nginx reverse proxy template
- backup and restore tooling
- staging and production split on one VPS

## Operational scope

Validated deployment model:

- single VPS self-host
- OpenClaw runtime
- 9Router model gateway
- PostgreSQL
- Redis
- Nginx reverse proxy
- systemd-managed services

## Documentation

Primary docs:

- `README.md`
- `docs/public/PRODUCT-OVERVIEW.md`
- `docs/28-quickstart.md`
- `docs/31-vps-operations.md`
- `docs/32-staging-prod-layout.md`
- `docs/33-github-publish-checklist.md`

## Validation

Release readiness evidence includes:

- doctor
- smoke
- conformance
- release-readiness
- release-acceptance
- self-host-acceptance
- final-readiness

## Notes

- this release is self-host oriented
- HTTPS/domain setup is still deployment-specific and should be completed by operators
- private operator credentials and runtime artifacts are intentionally excluded from the public repository

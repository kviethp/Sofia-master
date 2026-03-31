# Sofia Master

Language:
- [English](./README.md)
- [Tiếng Việt](./README.vi.md)

Sofia Master is a self-hostable orchestration and operations layer for AI product engineering.

It is designed to run above:
- **OpenClaw** for agent execution
- **9Router** for model routing, fallback, and provider abstraction

Sofia adds:
- task and run lifecycle control
- policy-aware model selection
- multi-phase workflows such as `planner -> builder -> verifier`
- approval gates for risky work
- artifacts, decisions, usage evidence, and audit trail
- recovery, replay, and operator tooling for self-hosted runtime

See [PRODUCT-OVERVIEW.md](./docs/public/PRODUCT-OVERVIEW.md) for the product-level summary.

## Highlights

- self-host first
- vendor-neutral runtime stack
- deployable on a single VPS
- built-in backup, restore, release, rollback, and diagnostics
- supports staging and production split on the same host

## Repository layout

- `apps/` API, worker, web, and admin surfaces
- `packages/` policy, adapters, routing, shared contracts
- `docs/` architecture, install, release, and operations guides
- `infra/` Compose, Docker, systemd, and Nginx templates
- `prompts/` canonical multi-agent role prompts
- `scripts/` doctor, smoke, conformance, release, backup, restore, diagnostics
- `skills/` authored skill sources compiled into `.sofia/skills`
- `sql/` PostgreSQL schema
- `openapi/` HTTP contract

## Install

### Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL
- Redis
- OpenClaw
- 9Router

For local Compose bootstrap, also install Docker.

### Quick install

1. Copy `.env.example` to `.env`
2. Run `node scripts/bootstrap.mjs`
3. Run `pnpm install`
4. Start the stack:

```bash
docker compose -f infra/compose/docker-compose.yml up -d postgres redis api web admin
```

5. Initialize runtime:

```bash
node apps/sofia-api/scripts/migrate.js
node apps/sofia-api/scripts/doctor.js
node apps/sofia-api/scripts/smoke.js
```

Full install detail is in [28-quickstart.md](./docs/28-quickstart.md).

## Quickstart

Open:
- Web: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3001`
- API health: `http://127.0.0.1:8080/health`

Create a task:

```bash
curl -X POST http://127.0.0.1:8080/v1/tasks \
  -H "content-type: application/json" \
  -d "{\"title\":\"Add a simple login page scaffold to a demo app\",\"templateId\":\"default\"}"
```

Then inspect:
- `/v1/tasks`
- `/v1/runs`
- `/v1/runtime/status`
- `.sofia/reports/`
- `.sofia/artifacts/`

## Deploy

### Single-host self-host

Use:
- systemd templates in `infra/systemd/`
- Nginx template in `infra/nginx/sofia.conf`
- release scripts in `scripts/`

Recommended deploy flow:

```bash
node scripts/release-bundle.mjs
node scripts/release-acceptance.mjs
node scripts/self-host-acceptance.mjs
node scripts/final-readiness.mjs
```

Operational references:
- [31-vps-operations.md](./docs/31-vps-operations.md)
- [32-staging-prod-layout.md](./docs/32-staging-prod-layout.md)
- [25-backup-and-restore.md](./docs/25-backup-and-restore.md)
- [26-release-and-rollback-playbook.md](./docs/26-release-and-rollback-playbook.md)
- [27-incident-response-playbook.md](./docs/27-incident-response-playbook.md)

## Runtime validation

The pack includes machine-readable gates for self-host readiness:

- `skills:validate`
- `skills:compile`
- `agent-system:conformance`
- `doctor`
- `smoke`
- `conformance`
- `release-readiness`
- `release-acceptance`
- `self-host-acceptance`
- `final-readiness`

These scripts are intended to prove that the deployable artifact, not just the source tree, is healthy.

## Publish status

This repository is structured to be publish-ready as a self-host implementation pack and runnable Sofia Master scaffold.

Primary docs:
- [PRODUCT-OVERVIEW.md](./docs/public/PRODUCT-OVERVIEW.md)
- [PRODUCT-OVERVIEW.vi.md](./docs/vi/public/PRODUCT-OVERVIEW.md)
- [Documentation Index (EN)](./docs/README.md)
- [Documentation Index (VI)](./docs/README.vi.md)
- [28-quickstart.md](./docs/28-quickstart.md)
- [31-vps-operations.md](./docs/31-vps-operations.md)
- [32-staging-prod-layout.md](./docs/32-staging-prod-layout.md)
- [33-github-publish-checklist.md](./docs/33-github-publish-checklist.md)
- [RELEASE-NOTES-v1.0.0.md](./docs/public/RELEASE-NOTES-v1.0.0.md)

Additional public docs:
- [CHANGELOG.md](./docs/public/CHANGELOG.md)
- [CHANGELOG.vi.md](./docs/vi/public/CHANGELOG.md)
- [CONTRIBUTING.md](./docs/public/CONTRIBUTING.md)
- [CONTRIBUTING.vi.md](./docs/vi/public/CONTRIBUTING.md)
- [COMPATIBILITY.md](./docs/public/COMPATIBILITY.md)
- [COMPATIBILITY.vi.md](./docs/vi/public/COMPATIBILITY.md)
- [MODEL-POLICY.md](./docs/public/MODEL-POLICY.md)
- [MODEL-POLICY.vi.md](./docs/vi/public/MODEL-POLICY.md)
- [SECURITY.md](./docs/public/SECURITY.md)
- [SECURITY.vi.md](./docs/vi/public/SECURITY.md)
- [SUPPORT.md](./docs/public/SUPPORT.md)
- [SUPPORT.vi.md](./docs/vi/public/SUPPORT.md)
- [RELEASE-NOTES-v1.0.0.vi.md](./docs/vi/public/RELEASE-NOTES-v1.0.0.md)

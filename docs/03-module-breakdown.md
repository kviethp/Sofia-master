# Module Breakdown

## Applications

- `apps/sofia-api`: REST API and orchestration endpoints
- `apps/sofia-worker`: queue worker and execution controller
- `apps/sofia-web`: user-facing interface
- `apps/sofia-admin`: operator/admin dashboard

## Shared packages

- `packages/shared-types`
- `packages/skill-schema`
- `packages/skill-compiler`
- `packages/policy-engine`
- `packages/router-client`
- `packages/openclaw-adapter`
- `packages/telemetry`
- `packages/security`
- `packages/config-audit`

## Infra

- `infra/docker`
- `infra/k8s`
- `infra/compose`
- `sql/`

## Examples and templates

- `examples/config`
- `examples/policies`
- `examples/golden-path`
- `templates/projects`

## Ownership guidance

- core policy, schema, and contracts should remain stable and tightly reviewed
- adapters may evolve faster
- examples should track stable behavior, not experiments

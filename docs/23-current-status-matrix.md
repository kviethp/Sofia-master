# Current Status Matrix

## Status definitions

- `canonical-doc`: authoritative documentation for current intended behavior
- `draft`: useful contract or design artifact, but not fully proven in runtime
- `scaffold`: code or infra exists and has minimal working shape, but is not yet complete
- `placeholder`: path exists mostly to reserve structure; implementation is not materially there yet
- `example`: illustrative seed content only; not authoritative runtime behavior
- `implemented`: materially working behavior with evidence

## Repository status

| Area | Paths | Status | Notes |
| --- | --- | --- | --- |
| Start and architecture docs | `docs/00-start-here.md` to `docs/05-risk-treatment-plan.md` | `canonical-doc` | best current source for system shape and constraints |
| Runtime, compatibility, conformance, release, and ops docs | `docs/06-existing-runtime-audit.md` to `docs/20-agent-handoff.md`, `docs/25-backup-and-restore.md` to `docs/33-github-publish-checklist.md` | `canonical-doc` | defines operational expectations and the current recovery/release playbooks, with codified single-host VPS operations plus staging/prod split |
| Multi-agent coordination docs | `docs/21-implementation-truth-map.md` to `docs/24-multi-agent-operating-model.md` | `canonical-doc` | governs parallel development and handoff discipline |
| Role and skill coordination docs | `docs/34-role-skill-matrix.md`, `docs/vi/34-role-skill-matrix.md` | `canonical-doc` | maps role prompts, owned paths, recommended skills, and evidence standards |
| Public OSS docs | `README.md`, `README.vi.md`, `docs/public/*`, `docs/vi/public/*`, `pnpm-workspace.yaml` | `draft` | publish-facing packaging surface and bilingual public docs |
| GitHub automation and hygiene | `.github/` | `scaffold` | issue templates, PR template, CODEOWNERS, and a scaffold CI workflow now exist; VPS-backed validation is still outside CI |
| API app | `apps/sofia-api` | `scaffold` | health, readiness, doctor, preflight, smoke, HTTP task, run, and approval endpoints, project template catalog, PostgreSQL/Redis path, runtime status and metrics endpoints, runtime policy visibility, optional control-token auth, multi-phase `planner -> builder -> verifier` workflow, approval gates for high-risk builder entry, Telegram approval polling, OpenClaw execution bridge, compiled skill registry surfacing, run trace evidence, lease-based recovery, retry backoff, dead-letter handling, and dead-letter replay now exist |
| Worker app | `apps/sofia-worker` | `scaffold` | can run in one-shot or loop mode, handle graceful shutdown, consume queued or stale leased runs, and now has a practical loop wrapper for host or Compose usage; richer retry policy and supervision are still missing |
| Web app | `apps/sofia-web` | `scaffold` | static user-facing shell now exists for task submission, create-and-start flow, recent task actions, and optional control-token storage; it is API-driven and intentionally minimal |
| Admin app | `apps/sofia-admin` | `scaffold` | static operator dashboard shell now exists for runtime health, runtime policy guardrails, dead-letter runs, approvals, project templates, basic operator actions such as replay plus approve/reject, and optional control-token storage; it still depends on the API surface and has no user management layer |
| Shared types | `packages/shared-types` | `scaffold` | run status enum exists, including `dead_lettered`, but contract surface is still minimal |
| Policy engine | `packages/policy-engine` | `scaffold` | resolves current `sofia-*` model profiles and now enforces provider denylist, token budgets, required runtime skills, and allowed skill trust levels at execution time, but broader escalation and spend policy depth are still missing |
| Router client | `packages/router-client` | `scaffold` | performs real model-list fetch and returns normalized evidence |
| OpenClaw adapter | `packages/openclaw-adapter` | `scaffold` | reads config, bootstraps OpenClaw agents, executes local agent turns, and can send Telegram reports |
| Config audit | `packages/config-audit` | `scaffold` | performs recursive config comparison with warnings and conflicts |
| Skill schema | `packages/skill-schema` | `implemented` | schema version, trust levels, recommended skill ids, validation, and normalization now exist |
| Skill compiler | `packages/skill-compiler` | `implemented` | Markdown-plus-JSON-frontmatter skills now compile to JSON artifacts with signature hashes, manifests, and a runtime-loadable registry surface |
| Telemetry | `packages/telemetry` | `scaffold` | trace envelope helper now includes metadata and finish timestamps, but it is not an observability system |
| Security | `packages/security` | `scaffold` | recursive redaction helper now exists for strings, arrays, and objects, but it is not a full security layer |
| SQL schema | `sql/001_initial_schema.sql` | `scaffold` | schema migrates successfully and backs tasks, runs, artifacts, usage, run steps, decisions, lease metadata, retry-backoff metadata, dead-letter metadata, and a `schema_migrations` ledger |
| OpenAPI spec | `openapi/sofia-api.yaml` | `draft` | now includes reusable schemas for runtime, tasks, runs, approvals, doctor, and smoke responses, but still needs richer examples and external-client hardening |
| Compose stack | `infra/compose/docker-compose.yml` | `scaffold` | Postgres, Redis, API, Web, and Admin services are defined; worker and approval-poller profiles exist; restart policy and API healthcheck now exist, but compose wiring was not runtime-tested on this host because Docker CLI is unavailable |
| Dockerfiles | `infra/docker` | `scaffold` | generic runtime image now installs production dependencies and is used by API, Web, Admin, Worker, and Approval Poller, but dedicated images and container-level smoke validation are still missing |
| Root scripts and Makefile | `scripts/`, `Makefile` | `scaffold` | Node-based entry points exist for doctor, compatibility snapshot, smoke, grouped conformance, worker loop, approval poller loop, managed VPS tunnel lifecycle, backup/restore, release acceptance, self-host acceptance, final readiness, migration status, maintenance reconcile, skill validation, skill compilation, and agent-system conformance; backup now snapshots artifact files, restore supports backup-directory replay, release bundles can be re-validated out of tree, stale run recovery can be audited or applied from a dedicated operator script, migration state can be inspected from a schema ledger, and final roadmap exit criteria can now be evaluated from machine-readable evidence |
| VPS reverse proxy and backup automation | `infra/nginx`, `infra/systemd/sofia-backup.*` | `implemented` | single-host reverse proxy and scheduled backup templates now exist for the deployed VPS shape |
| Examples and templates | `examples/`, `templates/` | `example` | seed material only, not implementation proof |

## Gate summary

- Spec readiness: medium-high
- Runnable readiness: medium-high
- Multi-agent readiness: high if agents obey the truth map, ownership map, status matrix, role-skill matrix, and compiled prompt-plus-skill bundle
- OSS preview readiness: medium
- Self-host readiness: medium

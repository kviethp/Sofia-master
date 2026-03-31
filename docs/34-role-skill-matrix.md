# Role-Skill Matrix

## Purpose

This document maps each active agent role to its owned paths, required prompt, recommended skill bundle, and evidence standard.

Use it together with:

- `docs/21-implementation-truth-map.md`
- `docs/22-agent-ownership-map.md`
- `docs/23-current-status-matrix.md`
- `docs/24-multi-agent-operating-model.md`

## Prompt inventory

Canonical prompt bundle lives in `prompts/`:

- `sofia-master-implementation-agent-prompt-full.md`
- `sofia-master-main-agent-orchestration-prompt-full.md`
- `sofia-master-qa-reviewer-prompt-full.md`
- `sofia-master-runtime-audit-agent-prompt-full.md`
- `sofia-master-core-platform-agent-prompt-full.md`
- `sofia-master-integrations-agent-prompt-full.md`
- `sofia-master-ui-operator-agent-prompt-full.md`
- `sofia-master-oss-release-agent-prompt-full.md`

## Recommended skills

Current high-value Sofia skills:

- `runtime-ops`
- `openclaw-9router`
- `postgres-redis-runtime`
- `conformance`
- `release-deploy`
- `docs-bilingual`
- `secret-scan`
- `ui-operator-flows`

These are no longer only control-plane intent. The current repository can validate and compile the skill set into JSON artifacts, and the runtime now gates execution on the compiled skill registry plus allowed trust levels. Third-party trust policy is still intentionally conservative.

## Current commands

- `pnpm skills:validate`
- `pnpm skills:compile`
- `pnpm agent-system:conformance`

## Matrix

| Role | Primary prompt | Owned paths | Recommended skills | Evidence required |
| --- | --- | --- | --- | --- |
| Main Orchestrator | `sofia-master-main-agent-orchestration-prompt-full.md` | checkpoint notes, phase sequencing, ownership reassignment | `plan-task`, `decompose-task`, `architecture-review`, `document-change` | assignment clarity, checkpoint summary, open risks, next owner |
| Implementation | `sofia-master-implementation-agent-prompt-full.md` | broad implementation when no narrower role is active | `implement-feature`, `write-tests`, `fix-bug`, `review-change` | code, docs, validation lane, assumptions |
| Runtime Audit and Reconciliation | `sofia-master-runtime-audit-agent-prompt-full.md` | `docs/reports/`, `docs/compat/`, `docs/progress/`, `docs/adr/`, `packages/config-audit` | `runtime-ops`, `secret-scan`, `deploy-check` | observed config, drift report, rollback notes, risk level |
| Core Platform | `sofia-master-core-platform-agent-prompt-full.md` | `apps/sofia-api`, `apps/sofia-worker`, `packages/shared-types`, `packages/policy-engine`, `sql/`, `openapi/` | `implement-feature`, `postgres-redis-runtime`, `conformance`, `write-tests` | API or runtime behavior, migration impact, targeted validation |
| Integrations | `sofia-master-integrations-agent-prompt-full.md` | `packages/router-client`, `packages/openclaw-adapter`, integration evidence | `openclaw-9router`, `conformance`, `review-change` | exercised adapter path, normalized result, compatibility risk |
| UI and Operator Experience | `sofia-master-ui-operator-agent-prompt-full.md` | `apps/sofia-web`, `apps/sofia-admin` | `ui-operator-flows`, `document-change`, `review-change` | route evidence, API dependency list, unsupported flow list |
| OSS and Release | `sofia-master-oss-release-agent-prompt-full.md` | `docs/public/`, `docs/vi/public/`, `.github/`, release docs | `release-deploy`, `docs-bilingual`, `secret-scan`, `document-change` | public-safe claims, supported modes, release gaps |
| QA Reviewer | `sofia-master-qa-reviewer-prompt-full.md` | review artifacts and reports | `architecture-review`, `review-change`, `secret-scan`, `deploy-check` | findings, verdict, exact next action |

## Operating rules

- One role owns one path at a time per checkpoint.
- Role prompt, ownership map, and status matrix must agree before work starts.
- If a role lacks a prompt, either add the prompt or reassign ownership explicitly.
- If a role depends on a skill that is not implemented as a runtime artifact yet, treat that skill as a documented working method, not as proof of runtime capability.

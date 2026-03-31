# Agent Ownership Map

## Purpose

This document defines ownership boundaries for multi-agent implementation so parallel work does not drift or overwrite adjacent modules without coordination.

## Operating principles

- One primary owner per path per checkpoint.
- Cross-boundary edits require explicit handoff or orchestrator approval.
- Integration fixes should be as narrow as possible and documented in the handoff notes.
- Agents should prefer adding explicit contracts over making silent cross-package assumptions.

## Ownership table

| Role | Primary paths | Responsibilities | Must not do by default |
| --- | --- | --- | --- |
| Main Orchestrator | `docs/progress/`, `docs/adr/`, `docs/reports/`, `docs/compat/`, checkpoint notes | phase planning, assignment, checkpoint control, final decision logging, integration sequencing | own every code path directly or bypass package ownership |
| Runtime Audit and Reconciliation | runtime inventory artifacts, conflict reports, migration notes, `packages/config-audit`, config safety docs | audit current runtime, compare desired vs actual config, define reversible migration path, protect existing OpenClaw and 9Router setups | rewrite core API or routing logic without handoff |
| Core Platform | `apps/sofia-api`, `apps/sofia-worker`, `packages/shared-types`, `packages/policy-engine`, `sql/`, `openapi/` | API, worker, contracts, state model, migrations, executable policy, task and run lifecycle | modify adapter internals or UI surfaces without coordination |
| Integrations | `packages/router-client`, `packages/openclaw-adapter`, compatibility and usage artifacts, provider mapping files | 9Router bridge, OpenClaw bridge, normalization, retries, compatibility handling, routing evidence | redefine product scope or mutate unrelated platform modules |
| UI and Operator Experience | `apps/sofia-web`, `apps/sofia-admin`, user-facing and operator-facing flows | minimal web and admin surfaces, operator workflows, dashboard integration points | change storage contracts or routing behavior without Core Platform and Integrations alignment |
| OSS and Release | `docs/public/`, `docs/vi/public/`, `.github/`, packaging docs, release checklists, install flow docs | README, QUICKSTART, public-safe packaging guidance, CONTRIBUTING, SECURITY, SUPPORT, COMPATIBILITY, release hygiene | treat examples or aspirational docs as proof of implementation |
| QA Reviewer | review artifacts and reports | independent review, release readiness, defect log, evidence-based verdicts | implement production code unless explicitly asked to fix a defect in a controlled scope |

## Handoff contract

Every handoff between agents must include:
- objective and checkpoint
- owned paths
- canonical docs used
- current status of affected modules
- evidence produced
- known risks
- explicit open questions, if any remain

## Escalation rules

- If two agents need to edit the same path in the same checkpoint, the Main Orchestrator must reassign ownership first.
- If a fix requires crossing from one owned area into another, the agent should patch only the minimum necessary surface and record the boundary crossing in the handoff notes.
- If a module has no clear owner, default ownership goes to the Main Orchestrator until reassigned.

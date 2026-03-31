# Implementation Truth Map

## Purpose

This document defines which artifacts are authoritative when prompts, docs, scaffold code, examples, and runtime remnants disagree.

## Precedence order

1. Proven runtime safety decisions recorded in current ADRs, reports, or reconciliation artifacts.
2. This truth map.
3. Canonical domain docs that define architecture, data contracts, policy, security, and runtime expectations.
4. The current ownership map and status matrix for the active branch.
5. Implementation starter, scaffold plan, roadmap, and agent handoff docs.
6. Examples and templates.
7. Scaffold code in `apps/`, `packages/`, `infra/`, `openapi/`, `sql/`, and `scripts/`.
8. `README.md` and summary-style onboarding docs.

## Canonical domain sources

### Product position and scope
- `docs/01-vision-and-scope.md`
- `docs/00-start-here.md`

### Architecture and module boundaries
- `docs/02-architecture-overview.md`
- `docs/03-module-breakdown.md`

### Routing, risk, trust, and compatibility
- `docs/04-routing-policy.md`
- `docs/05-risk-treatment-plan.md`
- `docs/09-compatibility-matrix.md`
- `docs/14-security-trust-policy.md`

### Runtime audit and operational safety
- `docs/06-existing-runtime-audit.md`
- `docs/10-doctor-and-preflight.md`

### Data model and API contracts
- `docs/11-data-model.md`
- `docs/12-api-contracts.md`

### Skill system
- `docs/13-skill-system.md`

### Packaging and release expectations
- `docs/07-oss-packaging.md`
- `docs/17-oss-release-engineering.md`

### Implementation order and milestone criteria
- `docs/15-implementation-starter.md`
- `docs/16-runnable-scaffold-plan.md`
- `docs/18-golden-path-demo.md`
- `docs/19-roadmap-to-completion.md`
- `docs/20-agent-handoff.md`

## How to treat scaffold code

- Code under `apps/`, `packages/`, `infra/`, `openapi/`, `sql/`, and `scripts/` is implementation evidence only when the status matrix marks it as more than placeholder or scaffold.
- If scaffold code conflicts with canonical docs and the status matrix marks that code as `placeholder`, `scaffold`, or `draft`, the docs win.
- Examples under `examples/` and `templates/` are reference material, not production contracts.
- `README.md` is onboarding guidance, not final authority for architecture or behavior.

## Conflict resolution rules

1. Prefer the narrower and more operationally specific canonical doc.
2. Prefer the safer, reversible path when runtime compatibility is at risk.
3. Record an ADR when two canonical docs cannot both be true.
4. Update the status matrix when a module moves from placeholder or scaffold into implemented behavior.
5. Update the ownership map before assigning parallel work that crosses package boundaries.

## Required check before editing

Before changing any module, the responsible agent must identify:
- the canonical docs for that module
- the current status from `docs/23-current-status-matrix.md`
- the owning role from `docs/22-agent-ownership-map.md`
- any active risks or reconcile notes that constrain the change

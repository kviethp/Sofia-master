# Multi-Agent Operating Model

## Purpose

This document defines how Sofia Master should be developed with multiple agents without creating ownership collisions, fake progress, or architecture drift.

## Recommended team shapes

### Minimal setup

Use this when only one main builder and one independent reviewer are active.

- Main Orchestrator and Builder
- QA Reviewer

This setup can work with the three control-plane prompts if the agents also read the truth map, ownership map, and status matrix.

### Practical setup for 3 to 5 agents

Use this when the project is moving beyond scaffold work.

- Main Orchestrator
- Runtime Audit and Reconciliation
- Core Platform
- Integrations
- QA Reviewer

Optional:
- UI and Operator Experience
- OSS and Release

### Larger setup for longer-running development

Use dedicated roles when parallel work is sustained across multiple checkpoints.

- Main Orchestrator
- Runtime Audit and Reconciliation
- Core Platform
- Integrations
- UI and Operator Experience
- OSS and Release
- QA Reviewer

## Mandatory operating rules

1. Every agent must read `docs/21-implementation-truth-map.md`, `docs/22-agent-ownership-map.md`, and `docs/23-current-status-matrix.md` before editing or reviewing.
2. Every checkpoint must state who owns which paths.
3. Placeholder, scaffold, and draft artifacts must never be described as implemented without runtime evidence.
4. Cross-boundary edits must be explicit and minimal.
5. Every checkpoint handoff must include evidence, open risks, and next-owner information.

## Do you need separate prompt files per role

### Not required yet

If the team is small and work is still concentrated around a narrow slice, the three control-plane prompts are enough:
- implementation
- main orchestration
- QA reviewer

This is only safe if the coordination docs in `docs/21` to `docs/24` are treated as mandatory.

### Strongly recommended

Create separate prompt files when:
- more than one implementation agent is editing code in parallel
- runtime audit becomes a distinct ongoing stream of work
- integrations are complex enough to deserve their own acceptance criteria
- release and OSS hardening run in parallel with core implementation

The first extra role-specific prompts worth adding are:
- Runtime Audit and Reconciliation
- Core Platform
- Integrations
- UI and Operator Experience
- OSS and Release

### Required

Separate role-specific prompts become required when:
- 5 or more agents work concurrently for multiple checkpoints
- ownership boundaries are no longer obvious from the repository layout
- the same package is repeatedly touched by multiple roles
- the project starts carrying long-lived operational state and release discipline

## Recommended prompt strategy for this repository

- Keep the control-plane prompts for orchestration, implementation, and QA.
- Add role-specific prompts for roles with sustained parallel work.
- Do not create a separate prompt for every small task.
- Prefer stable role prompts plus checkpoint-specific handoff notes over many one-off prompts.

## Immediate recommendation

For the current Sofia Master pack:
- keep orchestration, implementation, and QA as the base control plane
- maintain dedicated prompts for Runtime Audit, Core Platform, Integrations, UI and Operator Experience, and OSS and Release
- use `docs/34-role-skill-matrix.md` to keep role inventory, prompt inventory, and recommended skill bundles aligned

# Sofia Master

Language:
- [English](./PRODUCT-OVERVIEW.md)
- [Tiếng Việt](../vi/public/PRODUCT-OVERVIEW.md)

Sofia Master is a self-hostable orchestration layer for AI product engineering teams.

It sits above:
- **OpenClaw** for agent runtime and execution
- **9Router** for model routing, provider abstraction, fallback, and quota strategy

## What Sofia adds

Sofia is the control plane that those runtimes are missing on their own.

Key capabilities:
- task lifecycle management
- policy-driven model selection
- multi-phase workflows such as `planner -> builder -> verifier`
- approval gates for risky work
- audit trail, artifacts, and usage evidence
- dead-letter handling, replay, and recovery
- self-host operations with backup, restore, release, and rollback tooling

## Why it exists

Teams can already run agents. The harder problem is running them with discipline.

Sofia addresses:
- when to escalate to stronger models
- how to preserve evidence and artifacts
- how to separate fast-path execution from high-risk work
- how to recover from worker failure and replay stuck runs
- how to expose a usable operator surface for runtime, approvals, and queue state

## Product advantages

1. **Vendor-neutral**
- works with OpenClaw and 9Router rather than locking the system to one provider

2. **Operationally opinionated**
- includes doctor, smoke, conformance, self-host acceptance, and final readiness checks

3. **Self-host focused**
- designed to run on a single VPS first, then scale to more structured environments

4. **Policy-aware**
- model profile routing, denylist guardrails, token budgets, and approval flows are first-class runtime concerns

5. **Deployable**
- release bundles, systemd templates, reverse proxy templates, backup automation, and staging/prod split are already part of the pack

## Intended users

- solo builders operating agent systems on a VPS
- small AI product teams needing a control plane above agent runtimes
- teams that want staging/prod discipline without a large platform investment

## Current product state

This repository is publishable as a self-host implementation pack and runnable product scaffold.

It includes:
- product docs
- install and deploy docs
- runnable services
- operations playbooks
- release and validation tooling

The recommended entry points are:
- [README.md](../../README.md)
- [README.vi.md](../../README.vi.md)
- [docs/README.md](../README.md)
- [docs/README.vi.md](../README.vi.md)
- [docs/28-quickstart.md](../28-quickstart.md)
- [docs/31-vps-operations.md](../31-vps-operations.md)
- [docs/32-staging-prod-layout.md](../32-staging-prod-layout.md)

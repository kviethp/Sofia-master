# Start Here

## Intent

This repository pack is the single merged source of truth for Sofia Master after consolidating:
- v1.0 architecture/spec direction
- v1.1 runtime audit and OSS packaging additions
- v1.2 implementation starter, conformance, and golden path additions
- v1.3+ completion roadmap up to OSS-ready and production-ready self-host

## Mandatory reading for multi-agent work

Before parallel implementation starts, agents should also read:
- `docs/21-implementation-truth-map.md`
- `docs/22-agent-ownership-map.md`
- `docs/23-current-status-matrix.md`
- `docs/24-multi-agent-operating-model.md`

## Build order

1. Existing runtime audit
2. Compatibility contract and provider normalization
3. Core data model and API
4. OpenClaw execution bridge
5. 9Router routing and usage ledger
6. Doctor / preflight / smoke
7. Golden path demo
8. Quality gates and hardening
9. OSS packaging completion
10. Internal alpha, hardening, beta, OSS-ready, self-host production

## Non-goals

- Not a replacement for CI/CD, Git protection, secret scanning, or observability tools
- Not a general-purpose LLM platform
- Not a promise that every OpenAI-compatible endpoint behaves identically
- Not tied to Claude or Anthropic workflows

## Core design rules

- Policy must be executable, not only documented
- Skills are compiled assets, not free-form runtime prompts
- Routing decisions are traceable
- Fallback is controlled by risk policy
- Runtime configuration must be auditable and reversible
- External skills are never trusted by default

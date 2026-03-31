# Routing Policy

## Policy philosophy

Routing is not delegated entirely to 9Router. Sofia decides the allowed profile, then 9Router provides the transport and fallback execution within approved boundaries.

## Risk classes

- `low`
- `medium`
- `high`
- `critical`

## Default profile mapping

### Planner
- preferred: `sofia-hard`
- fallback: `sofia-fast`
- forbidden: free tier for `high` and `critical`

### Builder
- preferred: `sofia-fast`
- escalation: `sofia-hard` for hard debugging or architecture-sensitive changes
- cheap tier allowed for `low` and some `medium`
- free tier blocked for auth, infra, payments, migrations, security code

### Verifier
- preferred: profile distinct from builder
- high/critical review should favor `sofia-hard`

### Triage / classify / extract
- allowed to use `sofia-fast`

## Runtime profile mapping

- `sofia-hard`
  - quality-first combo
  - targets hard tasks and sensitive review
  - may fall back within the approved paid tier before dropping lower
- `sofia-fast`
  - speed-first combo
  - targets low-cost or interactive work
  - may escalate upward inside 9Router when the preferred fast path is unavailable
- `sofia-free-fallback`
  - explicit degraded profile
  - reserved for low-risk work or exhausted paid quota conditions

## Routing safety rules

- free model fallback must never happen for `critical`
- if fallback occurs across trust tiers, the run gets elevated for review
- builder and verifier should not share the same exact model profile for sensitive tasks
- every resolved routing decision must be recorded in usage ledger and run trace

## Dynamic controls

- budget cap per run
- latency cap for interactive flows
- retry ceiling
- provider denylist support

## Current implementation notes

- degraded mode no longer drops `high` or `critical` work to `sofia-free-fallback`
- runtime execution now enforces provider denylist through `SOFIA_DENY_PROVIDERS`
- runtime execution now enforces token budgets through:
  - `SOFIA_MAX_TOKENS_IN`
  - `SOFIA_MAX_TOKENS_OUT`
  - `SOFIA_MAX_TOKENS_TOTAL`
- guardrail violations fail the run and are recorded as:
  - `policy/execution_guardrails` decision evidence
  - `policy_guardrail_violation` run step

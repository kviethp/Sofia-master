# Security and Trust Policy

## Baseline
- no secrets in artifacts
- no uncontrolled free-tier fallback for sensitive tasks
- no unreviewed external skill in production workflows
- no direct deploy without gates and approval policy

## Tool allowlist
Only approved tools should be callable by workers in sensitive workflows.

## Sensitive domains
- auth
- billing
- secrets
- infra
- migrations
- compliance logic

## Review elevation rules
A run must be elevated for manual review if:
- a lower trust-tier model was used
- a sensitive file path was modified
- secret scan found potential issues
- fallback chain crossed a trust boundary

## Logging
- redact secrets
- capture routing and policy decisions
- keep error normalization structured

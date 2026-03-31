# Doctor and Preflight

## Commands

- `sofia doctor`
- `sofia preflight`
- `sofia verify-runtime`
- `sofia smoke`

## Doctor responsibilities
- detect reachable OpenClaw
- detect reachable 9Router
- call model listing endpoint
- validate required profiles exist
- verify config files and env vars
- detect port conflicts
- detect `localhost` vs `127.0.0.1` mismatch
- check write access to artifact directories

## Preflight responsibilities
- validate run policy
- validate selected workflow
- validate risk-to-profile mapping
- validate required gates configured
- validate storage and queue connectivity
- validate approval transport readiness for gated workflows

## Exit behavior
- fail fast on critical preconditions
- emit structured report
- suggest remediation hints
- avoid mutating runtime by default

## Required outputs
- `doctor-report.json`
- `doctor-report.md`
- `preflight-report.json`

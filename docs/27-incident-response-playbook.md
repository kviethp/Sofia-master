# Incident Response Playbook

## Initial triage

Check:

1. `GET /v1/runtime/status`
2. `GET /v1/runs?status=running&limit=20`
3. `GET /v1/runs?status=dead_lettered&limit=20`
4. `GET /v1/runs?status=failed&limit=20`
5. `GET /v1/approvals?status=pending&limit=20`

## Common failure classes

### Dependency outage

Symptoms:

- doctor reports Redis or Postgres unavailable
- queue processing halts

Actions:

1. restore dependency connectivity
2. rerun doctor
3. inspect runtime status queue depth

### Routing or provider failure

Symptoms:

- runs fail during execution
- retry-policy evidence shows transient or permanent provider problems

Actions:

1. inspect run decisions and steps
2. verify 9Router and OpenClaw health
3. replay dead-lettered runs only after route health is restored

### Approval pipeline failure

Symptoms:

- tasks accumulate in `awaiting_approval`
- Telegram poller is not progressing approvals

Actions:

1. inspect pending approvals
2. restart approval poller
3. verify Telegram transport config

### Worker degradation

Symptoms:

- queue depth rises
- stale reclaim or dead-letter count rises

Actions:

1. inspect `running` and `dead_lettered` runs
2. restart worker loop
3. review retry policy evidence
4. run `node scripts/maintenance-reconcile.mjs`

## Recovery notes

- do not replay dead-lettered runs blindly
- take a fresh backup before destructive restore actions
- prefer targeted replay over broad queue mutation
- use `SOFIA_MAINTENANCE_APPLY=yes node scripts/maintenance-reconcile.mjs` only after reviewing the dry-run report

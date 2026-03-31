# Data Model

## Core tables

- projects
- tasks
- runs
- run_steps
- artifacts
- decisions
- approvals
- provider_usage

## Design notes

- `runs` represent execution instances
- `tasks` are user-facing units of work
- `run_steps` capture state transitions and worker phases
- `artifacts` store outputs, reports, patches, screenshots, logs
- `provider_usage` records every routing and usage decision

## Data guarantees

- PostgreSQL is source of truth
- Redis is transient coordination only
- local artifact storage currently stores generated artifacts and reports
- current runtime tracks:
  - task status
  - run status
  - approval status
  - workflow template
  - worker role / phase index
  - lease metadata
  - retry/backoff metadata
  - dead-letter metadata

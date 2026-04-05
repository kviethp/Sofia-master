# Quickstart

## Goal

Bring Sofia up on one machine and verify the golden path without external guesswork.

## Prerequisites

- Node.js 22+
- pnpm
- Docker Desktop or another Docker engine for compose mode

If `pnpm` is missing but `corepack` is available, enable it first:

```bash
corepack enable pnpm
```

## One-click setup

Recommended for new users:

```bash
node scripts/setup.mjs
```

The setup flow supports:
- quick mode for minimal questions
- advanced mode for custom ports, execution mode, and token setup
- `same-window` launch mode to bring up the core stack and stream logs in the current terminal
- `guide-only` mode to stop after setup and print the exact commands needed to start services manually

If you choose not to start everything in one window, the script prints the service start commands for:
- core compose services
- optional worker loop
- optional approval poller
- doctor and smoke checks


## Bootstrap

1. copy `.env.example` to `.env`
2. optional for protected control-plane APIs:
   - set `SOFIA_CONTROL_TOKEN`
3. optional when runtime lives on a VPS instead of locally:
   - set `SOFIA_TUNNEL_*`
   - run `node scripts/tunnel-vps.mjs start`
4. run:

```bash
node scripts/bootstrap.mjs
```

5. install dependencies:

```bash
pnpm install
```

## Start local stack

```bash
docker compose -f infra/compose/docker-compose.yml up -d postgres redis api web admin
```

Optional:

```bash
node scripts/worker-loop.mjs
node scripts/approval-poller-loop.mjs
```

## Initialize runtime

```bash
node scripts/skills-compile.mjs
node apps/sofia-api/scripts/migrate.js
node apps/sofia-api/scripts/doctor.js
node apps/sofia-api/scripts/smoke.js
```

Optional final self-host acceptance:

```bash
node scripts/self-host-acceptance.mjs
```

## Open local surfaces

- Web: `http://127.0.0.1:3000`
- Admin: `http://127.0.0.1:3001`
- API health: `http://127.0.0.1:8080/health`

If `SOFIA_CONTROL_TOKEN` is set:
- paste it into the token field in Sofia Web and Sofia Admin
- or send `Authorization: Bearer <token>` to `/v1/*`

## Golden path

Use the web shell or call the API:

```bash
curl -X POST http://127.0.0.1:8080/v1/tasks ^
  -H "content-type: application/json" ^
  -d "{\"title\":\"Add a simple login page scaffold to a demo app\",\"templateId\":\"default\"}"
```

Then inspect:

- `/v1/tasks`
- `/v1/runs`
- `/v1/runtime/status`
- `.sofia/reports/`
- `.sofia/artifacts/`

## Reset local reports

```bash
node scripts/reset.mjs
```

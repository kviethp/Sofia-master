# VPS Operations

## Runtime layout

- Active release: `/opt/sofia/current`
- Release store: `/opt/sofia/releases`
- Shared artifacts: `/opt/sofia/shared/artifacts`
- Environment file: `/etc/sofia/sofia.env`

## Services

- `sofia-api`
- `sofia-worker`
- `sofia-approval-poller`
- `sofia-web`
- `sofia-admin`
- `sofia-backup.timer`

## Reverse proxy

Use `infra/nginx/sofia.conf` for single-host reverse proxy.

Routes:
- `/` -> Sofia Web on `127.0.0.1:3000`
- `/admin/` -> Sofia Admin on `127.0.0.1:3001`
- `/api/` -> Sofia API on `127.0.0.1:8080`

## Backup schedule

Use:
- `infra/systemd/sofia-backup.service`
- `infra/systemd/sofia-backup.timer`

Default cadence:
- every 6 hours
- persistent across reboot

## Hardening notes

- Rotate `SOFIA_CONTROL_TOKEN` after deployment.
- Keep API, web, and admin behind Nginx on loopback.
- Review `/etc/sofia/sofia.env` permissions after manual edits.

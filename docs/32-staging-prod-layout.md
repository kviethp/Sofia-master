# Staging And Production Layout

Single-host long-term operation should keep two Sofia stacks:

## Production

- API: `127.0.0.1:8080`
- Web: `127.0.0.1:3000`
- Admin: `127.0.0.1:3001`
- Database: `sofia`
- Redis DB: `0`
- Artifacts: `/opt/sofia/shared/artifacts`
- Environment: `/etc/sofia/sofia.env`

## Staging

- API: `127.0.0.1:18080`
- Web: `127.0.0.1:13000`
- Admin: `127.0.0.1:13001`
- Database: `sofia_staging`
- Redis DB: `1`
- Artifacts: `/opt/sofia-staging/shared/artifacts`
- Environment: `/etc/sofia/sofia-staging.env`

## Reverse proxy

- `/` -> production web
- `/admin/` -> production admin
- `/api/` -> production API
- `/staging/` -> staging web
- `/staging/admin/` -> staging admin
- `/staging/api/` -> staging API

## Operational rule

- Deploy new work to staging first.
- Validate in staging.
- Promote to production only after acceptance passes.

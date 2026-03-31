# Phase 1 Compose Runtime Packaging

## Summary

This slice makes the Compose path materially closer to runnable self-host packaging.

## Changes

- `infra/docker/Dockerfile.api` now installs production dependencies before copying app code
- `.dockerignore` now excludes local state, logs, and `node_modules`
- `docker-compose.yml` now adds:
  - restart policy for long-lived services
  - API healthcheck

## Remaining gaps

- Compose build was not executed on this host because Docker CLI is still unavailable locally
- worker and approval-poller still share the same generic image instead of specialized Dockerfiles

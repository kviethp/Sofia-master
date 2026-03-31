# Phase 1 Systemd Templates

## Summary

This slice adds baseline systemd unit templates for single-host self-host deployment.

## Added

- `infra/systemd/sofia-api.service`
- `infra/systemd/sofia-worker.service`
- `infra/systemd/sofia-approval-poller.service`
- `infra/systemd/sofia-web.service`
- `infra/systemd/sofia-admin.service`

## Goal

Reduce the last-mile gap between passing release acceptance in the repo and operating Sofia as services on a VPS.

# Phase 1 VPS Tunnel Helper

## Summary

This slice adds a repo-native helper for forwarding PostgreSQL, Redis, 9Router, and OpenClaw from a VPS to the local machine.

## Added commands

- `node scripts/tunnel-vps.mjs start`
- `node scripts/tunnel-vps.mjs status`
- `node scripts/tunnel-vps.mjs stop`

## Environment

- `SOFIA_TUNNEL_HOST`
- `SOFIA_TUNNEL_PORT`
- `SOFIA_TUNNEL_USER`
- `SOFIA_TUNNEL_PASSWORD`
- `SOFIA_TUNNEL_HOSTKEY`
- `SOFIA_TUNNEL_FORWARDS`

## Validation

- syntax check passed for `scripts/tunnel-vps.mjs`
- `start -> status -> stop -> start` lifecycle was exercised on Windows using portable `plink.exe`
- local `5432` connectivity was restored through the managed tunnel

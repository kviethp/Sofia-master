# Phase 1 Env Example Refresh

## Summary

This slice updates `.env.example` so the documented install path matches the current runtime surface.

## Added variables

- dead-letter queue
- report channel
- lease and heartbeat controls
- retry cap and backoff controls
- worker loop controls
- approval poller loop controls
- backup and restore variables

## Validation

- Validation lane: syntax and doc sync
- Result: `.env.example` now reflects the current runtime and operational scripts

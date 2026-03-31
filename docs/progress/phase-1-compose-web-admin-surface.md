# Phase 1 Compose Web Admin Surface

## Summary

This slice extends the compose stack to include the new Web and Admin shells.

## Runtime changes

- added `web` service
- added `admin` service
- updated bootstrap instructions in `scripts/up.mjs`
- updated README bootstrap path for the new local URLs

## Validation

- Validation lane: syntax and wiring review
- Checks run:
  - `node --check scripts/up.mjs`
  - compose file review
- Limitation:
  - Docker CLI is not available on this host, so compose runtime validation could not be executed here

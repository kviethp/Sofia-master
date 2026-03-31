# Existing Runtime Audit

This document should be completed before Sofia starts managing any environment that already has OpenClaw and 9Router installed.

## Inventory checklist

### OpenClaw
- config file path
- provider entries
- base URL
- API key source
- model aliases
- workspace path
- logging mode
- container or native process
- Node version
- shell aliases / wrappers

### 9Router
- version / source
- port
- host binding
- provider list
- combo / fallback definitions
- account rotation config
- dashboard vs file config
- cache / state paths
- restart manager

### Shared environment
- `.env` files
- service unit files
- Docker compose files
- reverse proxies
- firewall / port exposure
- secret injection mechanism

## Conflict detection rules

- same port bound by multiple services
- Sofia-generated profiles naming collision with existing aliases
- provider names differ only by case
- `localhost` vs `127.0.0.1` mismatch
- duplicate model slug aliases with different capabilities
- conflicting environment variable sources

## Outputs

- `audit-inventory.json`
- `audit-drift-report.md`
- `audit-reconciliation-plan.md`

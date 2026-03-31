# Changelog

## 1.0.0

First publish-ready Sofia Master release.

### Added

- product-facing README and `docs/public/PRODUCT-OVERVIEW.md`
- publish-ready install, deploy, and operations documentation
- single-host Nginx reverse proxy template
- systemd backup service and timer templates
- staging and production split documentation and deployment model
- GitHub publish checklist
- release notes for `v1.0.0`

### Runtime

- PostgreSQL and Redis runtime path
- OpenClaw and 9Router integration
- multi-phase workflow execution
- approval gates and approval polling
- run trace, artifact, usage, and decision evidence
- retry classification, stale-run recovery, dead-letter handling, and replay
- Sofia Web and Sofia Admin shells

### Validation

- local final readiness: pass
- deployed VPS final readiness: pass
- deployed VPS conformance: 19/19 pass

## 0.1.0

Initial runnable alpha-to-beta implementation pack milestone.

### Added

- PostgreSQL and Redis-backed runtime path
- OpenClaw and 9Router execution bridge
- multi-phase workflow support
- approval gates and Telegram approval polling
- run trace, policy evidence, dead-letter replay, and retry classification
- runtime status, metrics, runs, approvals, and project-template API surfaces
- minimal Web and Admin shells
- backup, restore, compatibility snapshot, bootstrap, and playbook groundwork

### Validation

- checkpoint validation passed:
  - migrate
  - smoke
  - full conformance

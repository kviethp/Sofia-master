# Phase 1 Checkpoint After Ops And Install Hardening

## Checkpoint scope

This checkpoint closes the slices added after the previous validated milestone:

- dead-letter replay and retry policy evidence
- runtime status surface
- project templates
- run list surface
- approval history surface
- backup and restore groundwork
- release and incident playbooks
- runtime version snapshot
- compatibility snapshot
- env example refresh
- reset and test entry points
- smoke lane optimization
- `ensureSchema` bootstrap locking fix

## Validation lane

- checkpoint

## Results

- `migrate`: pass
- `smoke`: pass
- `full conformance`: pass

## Notes

- full conformance status: `16 passed, 0 failed`
- smoke now defaults to the faster `webapp-basic` template
- `ensureSchema` is now cached per process to keep DDL out of the runtime hot path and avoid bootstrap deadlocks

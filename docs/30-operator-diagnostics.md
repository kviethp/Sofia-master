# Operator Diagnostics

## API surfaces

Use these endpoints first:

- `/health`
- `/health/ready`
- `/v1/runtime/status`
- `/v1/runtime/metrics`
- `/v1/runs?status=failed&limit=20`
- `/v1/runs?status=dead_lettered&limit=20`
- `/v1/approvals?status=pending&limit=20`

Or generate one aggregate report:

```bash
node scripts/operator-diagnostics.mjs
```

This writes:

- `.sofia/reports/operator-diagnostics.json`
- `.sofia/reports/operator-diagnostics.md`

Default output is summary-oriented.

To include full run trace material:

```bash
SOFIA_OPERATOR_INCLUDE_TRACE=yes node scripts/operator-diagnostics.mjs
```

## Generated reports

Inspect:

- `.sofia/reports/doctor-report.json`
- `.sofia/reports/smoke-report.json`
- `.sofia/reports/conformance-report.json`
- `.sofia/reports/compatibility-snapshot.json`

## Artifact paths

Inspect:

- `.sofia/artifacts/`
- `.sofia/backups/`

## Restore discipline

- take a backup before destructive restore actions
- require `SOFIA_RESTORE_CONFIRM=yes`
- prefer replay of targeted dead-letter runs before broad database restore

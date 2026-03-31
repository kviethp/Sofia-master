# Compatibility

This project targets a tested compatibility window across:
- Node.js
- OpenClaw
- 9Router
- supported provider contracts

See release notes for exact pinned versions.

## Snapshot artifact

Generate a current runtime compatibility snapshot with:

```bash
node apps/sofia-api/scripts/compatibility-snapshot.js
```

This writes:

- `.sofia/reports/compatibility-snapshot.json`

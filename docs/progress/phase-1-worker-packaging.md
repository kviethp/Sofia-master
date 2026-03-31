# Phase 1 Worker Packaging

Status: scaffold-grade packaging added.

What changed:
- Added `pnpm worker:loop` as the practical loop-capable worker entry point.
- Added `scripts/worker-loop.mjs` as a shared wrapper for host and container usage.
- Added an opt-in Compose `worker` service under the `worker` profile.
- Kept the packaging surface aligned with the current scaffold and the existing loop-capable worker runtime.

Notes:
- The worker service is opt-in so the base compose file still stays minimal.
- The repo can now call the loop-capable worker without needing to remember the env flags each time.

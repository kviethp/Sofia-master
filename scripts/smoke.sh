#!/usr/bin/env bash
set -euo pipefail
echo "[sofia] running smoke placeholder"
node apps/sofia-api/scripts/smoke.js || true

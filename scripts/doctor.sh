#!/usr/bin/env bash
set -euo pipefail
echo "[sofia] running doctor"
node apps/sofia-api/scripts/doctor.js || true

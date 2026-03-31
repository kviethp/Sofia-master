#!/usr/bin/env bash
set -euo pipefail
echo "[sofia] reset placeholder"
rm -rf .sofia/tmp || true
mkdir -p .sofia/tmp

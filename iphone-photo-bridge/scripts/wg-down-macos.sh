#!/usr/bin/env bash
set -euo pipefail
CONF="${RUNNER_TEMP:-/tmp}/iphone-photo-bridge-wg.conf"
if command -v wg-quick >/dev/null 2>&1; then
  if [[ -f "$CONF" ]]; then
    sudo wg-quick down "$CONF" >/dev/null 2>&1 || true
    rm -f "$CONF"
  fi
fi

#!/usr/bin/env bash
set -euo pipefail
IFACE="${WG_INTERFACE:-wg0}"
if command -v wg-quick >/dev/null 2>&1; then
  sudo wg-quick down "$IFACE" >/dev/null 2>&1 || true
fi

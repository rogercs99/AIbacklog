#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f "dev.pid" ]; then
  echo "No hay dev.pid (no parece haber servidor en segundo plano)."
  exit 0
fi

PID="$(cat dev.pid || true)"
if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
  echo "Parando dev server (PID=${PID})..."
  kill "${PID}" || true
fi

rm -f dev.pid
echo "Dev server parado."


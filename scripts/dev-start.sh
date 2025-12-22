#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -d "node_modules" ]; then
  npm install
fi

if [ -f "dev.pid" ]; then
  PID="$(cat dev.pid || true)"
  if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
    echo "Dev server ya está corriendo (PID=${PID})."
    exit 0
  fi
  rm -f dev.pid
fi

nohup npm run dev > dev.log 2>&1 & echo $! > dev.pid
echo "Dev server iniciado: http://localhost:3000 (PID=$(cat dev.pid))"


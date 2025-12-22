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
    kill "${PID}" || true
  fi
  rm -f dev.pid
fi

echo "Iniciando en modo LOCAL_AI_MODE=basic (sin llamadas externas)..."

LOCAL_AI_MODE=basic \
AI_PROVIDER=local \
AI_API_KEY= \
OPENAI_API_KEY= \
AI_BASE_URL= \
LOCAL_AI_URL= \
LOCAL_AI_MODEL= \
GEMINI_API_KEY= \
nohup npm run dev > dev.log 2>&1 & echo $! > dev.pid

echo "Dev server iniciado: http://localhost:3000 (PID=$(cat dev.pid))"


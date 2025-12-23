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

# Limpia artefactos para evitar errores de webpack-runtime (./xyz.js missing)
rm -rf .next
rm -f dev.log

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

# Intentar detectar el puerto real (Next puede saltar a 3001 si 3000 está ocupado).
URL=""
for _ in {1..60}; do
  if [ -f "dev.log" ] && grep -q "Local:" dev.log; then
    URL="$(grep -m 1 "Local:" dev.log | sed -E 's/.*(http[^ ]+).*/\\1/' | tr -d '\r' | head -n 1)"
    break
  fi
  sleep 0.1
done

if [ -z "${URL}" ]; then
  URL="http://localhost:3000"
fi

echo "Dev server iniciado: ${URL} (PID=$(cat dev.pid))"

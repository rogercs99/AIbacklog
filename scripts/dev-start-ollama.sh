#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODEL="${1:-qwen2.5:0.5b}"

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

echo "Iniciando app contra Ollama (modelo: $MODEL)"
echo "Asegúrate de tener Ollama corriendo y el modelo descargado:"
echo "  scripts/start-ollama.sh"
echo "  bin/ollama pull $MODEL"

AI_PROVIDER=local \
AI_API_KEY= \
OPENAI_API_KEY= \
AI_BASE_URL= \
LOCAL_AI_URL="http://127.0.0.1:11434/v1" \
LOCAL_AI_MODEL="$MODEL" \
AI_ALLOW_NO_KEY=1 \
nohup npm run dev > dev.log 2>&1 & echo $! > dev.pid

echo "Dev server iniciado: http://localhost:3000 (PID=$(cat dev.pid))"


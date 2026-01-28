#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OLLAMA_BIN="${OLLAMA_BIN:-$ROOT_DIR/bin/ollama}"
if [ ! -x "$OLLAMA_BIN" ]; then
  echo "No se encontró Ollama en $OLLAMA_BIN."
  echo "Instálalo con: scripts/install-ollama.sh"
  exit 1
fi

export OLLAMA_MODELS="${OLLAMA_MODELS:-$ROOT_DIR/data/ollama-models}"
mkdir -p "$OLLAMA_MODELS"

if [ -f "ollama.pid" ]; then
  PID="$(cat ollama.pid || true)"
  if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
    echo "Ollama ya está corriendo (PID=${PID})."
    exit 0
  fi
  rm -f ollama.pid
fi

nohup "$OLLAMA_BIN" serve > ollama.log 2>&1 & echo $! > ollama.pid
echo "Ollama corriendo en http://127.0.0.1:11434 (PID=$(cat ollama.pid))"
echo "Modelos en: $OLLAMA_MODELS"


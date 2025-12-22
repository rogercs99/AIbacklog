#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p bin

TARGET="$ROOT_DIR/bin/ollama"
URL="https://ollama.com/download/ollama-linux-amd64"

echo "Descargando Ollama..."
curl -fsSL -L -o "$TARGET" "$URL"
chmod +x "$TARGET"

echo "Ollama instalado en: $TARGET"
echo "Siguiente paso:"
echo "  scripts/start-ollama.sh"
echo "  bin/ollama pull qwen2.5:0.5b"


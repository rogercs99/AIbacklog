#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AXET_DESKTOP_BIN="/home/deck/Desktop/AXET/axetflows-desktop-deb-prod/aXet.flows-Desktop"
AXET_DESKTOP_URL="https://localhost:65430/api/app/desktop/internal-config"

cd "$ROOT_DIR"

# Ensure .env.local points to the Axet flow gateway
if [ ! -f .env.local ]; then
  touch .env.local
fi

upsert_env() {
  local key="$1"
  local value="$2"
  if grep -qE "^${key}=" .env.local; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env.local
  else
    echo "${key}=${value}" >> .env.local
  fi
}

upsert_env "AI_PROVIDER" "axet"
upsert_env "AXET_FLOW_URL" "http://localhost:46228/axetflow/ai"
upsert_env "AXET_FLOW_JSON_URL" "http://localhost:46228/axetflow/ai"
upsert_env "AXET_FLOW_CHAT_URL" "http://localhost:46228/axetflow/ai"

# Start Axet Desktop if not running
if ! pgrep -f "aXet.flows-Desktop" >/dev/null 2>&1; then
  if [ ! -x "$AXET_DESKTOP_BIN" ]; then
    echo "Axet Desktop binary not found at: $AXET_DESKTOP_BIN" >&2
    exit 1
  fi
  nohup "$AXET_DESKTOP_BIN" >/tmp/axet-desktop.log 2>&1 &
fi

# Wait for Axet Desktop API
for _ in {1..60}; do
  if curl -ks "$AXET_DESKTOP_URL" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Start Next.js dev server
bash scripts/dev-start.sh

echo "Stack iniciado."

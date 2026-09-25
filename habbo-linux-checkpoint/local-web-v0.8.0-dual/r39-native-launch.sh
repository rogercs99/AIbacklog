#!/usr/bin/env bash
set -euo pipefail
: "${FLASHPLAYER:?set FLASHPLAYER to verified Adobe standalone player}"
: "${SSO_TICKET:?set fresh one-use SSO_TICKET}"
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-12323}"
ASSET_ORIGIN="${ASSET_ORIGIN:-http://127.0.0.1:18080}"
BASE="$ASSET_ORIGIN/gordon/RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438/"
SWF="${BASE}Habbo.swf"
VARS="$ASSET_ORIGIN/flash/gamedata/external_variables.txt"
TEXTS="$ASSET_ORIGIN/flash/gamedata/external_flash_texts.txt"
URL="${SWF}?client.allow.cross.domain=1&client.notify.cross.domain=0&connection.info.host=${HOST}&connection.info.port=${PORT}&site.url=${ASSET_ORIGIN}/&url.prefix=${ASSET_ORIGIN}/&client.reload.url=/disconnected&client.fatal.error.url=${ASSET_ORIGIN}/disconnected&client.connection.failed.url=${ASSET_ORIGIN}/disconnected&external.variables.txt=${VARS}?&external.texts.txt=${TEXTS}?&use.sso.ticket=1&sso.ticket=${SSO_TICKET}&processlog.enabled=1&account_id=1&client.starting=Please%20wait!%20Habbo%20is%20starting%20up&flash.client.url=${BASE}&user.hash=ticket&has.identity=0&flash.client.origin=popup&country_code=US"
exec "$FLASHPLAYER" "$URL"

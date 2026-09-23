#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/backups/manual-$TS"
install -d -m 700 "$OUT"
install -m 600 "$ROOT/docker-compose.yml" "$OUT/docker-compose.yml"
install -m 600 "$ROOT/PROJECT_CONTEXT.md" "$OUT/PROJECT_CONTEXT.md"
tar -C "$ROOT" -czf "$OUT/ops-overlay.tar.gz" ops
install -m 600 /etc/systemd/system/habbo-stack.service "$OUT/habbo-stack.service"
install -m 600 /etc/systemd/system/habbo-static.service "$OUT/habbo-static.service"
install -m 600 /etc/systemd/system/habbo-websockify.service "$OUT/habbo-websockify.service"
install -m 600 /etc/cloudflared-stremio-legacy/config.yml "$OUT/cloudflared-stremio-legacy-config.yml"
tar -C "$ROOT" -czf "$OUT/web-frontend-overlay.tar.gz" web-frontend-assets
install -m 600 "$ROOT/v31/client/vars.txt" "$OUT/v31-vars.txt"
install -m 600 "$ROOT/web/client/v39/gamedata/external_variables_vps1.txt" "$OUT/r39-external_variables_vps1.txt"
readlink "$ROOT/web/gordon/RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438/config_habbo.xml" > "$OUT/r39-config_habbo-symlink.txt"
docker exec habbo-mariadb-1 sh -lc 'mariadb-dump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" --single-transaction --routines --triggers "$MARIADB_DATABASE"' | gzip -9 > "$OUT/havana.sql.gz"
chmod 600 "$OUT"/*
sha256sum "$OUT"/* > "$OUT/SHA256SUMS"
chmod 600 "$OUT/SHA256SUMS"
printf "%s\n" "$OUT" > "$ROOT/LATEST_PUBLIC_WEB_BACKUP"
chmod 600 "$ROOT/LATEST_PUBLIC_WEB_BACKUP"
echo "$OUT"

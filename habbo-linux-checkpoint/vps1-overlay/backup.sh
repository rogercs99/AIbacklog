#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
PREV=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP" 2>/dev/null || true)
MIN_FREE_KB=1048576
free_kb=$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')
if [[ "$free_kb" -lt "$MIN_FREE_KB" ]]; then
  echo "FAIL: refusing backup with less than 1 GiB free on filesystem containing $ROOT" >&2
  exit 1
fi
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$ROOT/backups/manual-$TS"
install -d -m 700 "$OUT"
install -m 600 "$ROOT/docker-compose.yml" "$OUT/docker-compose.yml"
install -m 600 "$ROOT/PROJECT_CONTEXT.md" "$OUT/PROJECT_CONTEXT.md"
tar -C "$ROOT" -czf "$OUT/ops-overlay.tar.gz" ops
install -m 600 /etc/systemd/system/habbo-stack.service "$OUT/habbo-stack.service"
install -m 600 /etc/systemd/system/habbo-static.service "$OUT/habbo-static.service"
install -m 600 /etc/systemd/system/habbo-websockify.service "$OUT/habbo-websockify.service"
install -m 600 /etc/systemd/system/habbo-postboot-validate.service "$OUT/habbo-postboot-validate.service"
install -m 600 /etc/systemd/system/habbo-runtime-healthcheck.service "$OUT/habbo-runtime-healthcheck.service"
install -m 600 /etc/systemd/system/habbo-runtime-healthcheck-failed.service "$OUT/habbo-runtime-healthcheck-failed.service"
install -m 600 /etc/systemd/system/habbo-runtime-healthcheck.timer "$OUT/habbo-runtime-healthcheck.timer"
install -m 600 /etc/systemd/system/habbo-backup-daily.service "$OUT/habbo-backup-daily.service"
install -m 600 /etc/systemd/system/habbo-backup-daily.timer "$OUT/habbo-backup-daily.timer"
install -m 600 /etc/cloudflared-stremio-legacy/config.yml "$OUT/cloudflared-stremio-legacy-config.yml"
tar -C "$ROOT" -czf "$OUT/web-frontend-overlay.tar.gz" web-frontend-assets
install -m 600 "$ROOT/v31/client/vars.txt" "$OUT/v31-vars.txt"
install -m 600 "$ROOT/web/client/v39/gamedata/external_variables_vps1.txt" "$OUT/r39-external_variables_vps1.txt"
readlink "$ROOT/web/gordon/RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438/config_habbo.xml" > "$OUT/r39-config_habbo-symlink.txt"
docker exec habbo-mariadb-1 sh -lc 'mariadb-dump -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" --single-transaction --routines --triggers "$MARIADB_DATABASE"' | gzip -9 > "$OUT/havana.sql.gz"
chmod 600 "$OUT"/*
if [[ -n "$PREV" && -d "$PREV" && "$PREV" != "$OUT" ]]; then
  deduped=0
  for new in "$OUT"/*; do
    [[ -f "$new" ]] || continue
    name=${new##*/}
    [[ "$name" == "SHA256SUMS" ]] && continue
    old="$PREV/$name"
    if [[ -f "$old" ]] && cmp -s "$old" "$new"; then
      ln -f "$old" "$new"
      ((deduped+=1))
    fi
  done
  echo "dedup_hardlinks=$deduped previous=$PREV"
fi
sha256sum "$OUT"/* > "$OUT/SHA256SUMS"
chmod 600 "$OUT/SHA256SUMS"
if [[ -x "$ROOT/ops/verify-latest-backup.sh" ]]; then
  "$ROOT/ops/verify-latest-backup.sh" "$OUT"
fi
printf "%s\n" "$OUT" > "$ROOT/LATEST_PUBLIC_WEB_BACKUP"
chmod 600 "$ROOT/LATEST_PUBLIC_WEB_BACKUP"
echo "$OUT"
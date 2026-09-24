#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
B=${1:-$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")}
[[ -d "$B" ]]
WORK=$(mktemp -d /dev/shm/habbo-restore-verify.XXXXXX)
DB="habbo_restore_verify_$(date +%s)_$$"
root_sql() {
  docker exec habbo-mariadb-1 sh -lc "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" $*"
}
cleanup() {
  docker exec habbo-mariadb-1 sh -lc "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" -e 'DROP DATABASE IF EXISTS $DB'" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cd "$B"
sha256sum -c SHA256SUMS
test -f "$B/.env"
test -f "$B/cloudflared-tunnel-credentials.json"
test "$(stat -c %a "$B/cloudflared-tunnel-credentials.json")" = 600
python3 - "$B/cloudflared-stremio-legacy-config.yml" "$B/cloudflared-tunnel-credentials.json" <<'PYCF'
import json,re,sys
cfg=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'(?m)^\s*tunnel:\s*([^#\s]+)',cfg)
if not m: raise SystemExit('Cloudflare tunnel id missing from backed-up config')
with open(sys.argv[2],encoding='utf-8') as f: obj=json.load(f)
for key in ('AccountTag','TunnelSecret','TunnelID'):
    if not obj.get(key): raise SystemExit('Cloudflare credential missing required field: '+key)
if str(obj['TunnelID']) != m.group(1).strip():
    raise SystemExit('Cloudflare credential TunnelID does not match config')
PYCF
test "$(stat -c %a "$B/.env")" = 600
grep -q '^HABBO_DB_PASSWORD=.' "$B/.env"
grep -q '^HABBO_DB_ROOT_PASSWORD=.' "$B/.env"
docker compose --env-file "$B/.env" -f "$B/docker-compose.yml" config >/dev/null 2>"$WORK/compose-config.err"
if grep -qi 'is not set\|Defaulting to a blank string' "$WORK/compose-config.err"; then
  echo 'FAIL: backed-up Compose environment is incomplete' >&2
  cat "$WORK/compose-config.err" >&2
  exit 1
fi
gzip -t havana.sql.gz

tar -C "$WORK" -xzf ops-overlay.tar.gz
tar -C "$WORK" -xzf web-frontend-overlay.tar.gz

test -x "$WORK/ops/smoke-test.sh"
test -x "$WORK/ops/public-web-smoke.sh"
test -f "$WORK/ops/public-web-direct-assets-audit.py"
test -f "$WORK/ops/ensure-home-libs2-overlay.sh"
test -f "$WORK/ops/public-web-webkit-smoke.py"
test -x "$WORK/ops/network-perimeter-smoke.sh"
test -x "$WORK/ops/deployment-final-validate.sh"
test -x "$WORK/ops/backup-retention-report.sh"
test -x "$WORK/ops/disk-health-smoke.sh"
test -x "$WORK/ops/cloudflare-ingress-smoke.sh"
test -x "$WORK/ops/postboot-validate.sh"
test -f "$B/habbo-postboot-validate.service"
test -x "$WORK/ops/runtime-healthcheck.sh"
test -x "$WORK/ops/runtime-healthcheck-failed.sh"
test -x "$WORK/ops/habbo-status.sh"
test -x "$WORK/ops/db-backup-consistency-smoke.sh"
test -x "$WORK/ops/secret-permissions-smoke.sh"
test -x "$WORK/ops/habbo-backup-daily.sh"
test -f "$B/habbo-backup-daily.service"
test -f "$B/habbo-backup-daily.timer"
test -f "$B/habbo-runtime-healthcheck-failed.service"
test -f "$B/habbo-runtime-healthcheck.service"
test -f "$B/habbo-runtime-healthcheck.timer"
test -f "$WORK/web-frontend-assets/templates/index_v32.tpl"
grep -q 'static/js/libs2.js' "$WORK/web-frontend-assets/templates/index_v32.tpl"

docker exec habbo-mariadb-1 sh -lc "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" -e 'CREATE DATABASE $DB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci'"
gzip -cd "$B/havana.sql.gz" | docker exec -i habbo-mariadb-1 sh -lc "mariadb -uroot -p\"\$MARIADB_ROOT_PASSWORD\" $DB"
mapfile -t vals < <(docker exec habbo-mariadb-1 sh -lc "mariadb -N -B -uroot -p\"\$MARIADB_ROOT_PASSWORD\" $DB -e \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB'; SELECT COUNT(*) FROM navigator_styles; SELECT COUNT(*) FROM users WHERE username='RogerVideo'; SELECT COUNT(*) FROM rooms WHERE id=1000;\"")
tables=${vals[0]:-0}; nav=${vals[1]:-0}; user=${vals[2]:-0}; room=${vals[3]:-0}
[[ "$tables" -ge 80 ]]
[[ "$nav" -ge 1 ]]
[[ "$user" -ge 1 ]]
[[ "$room" -ge 1 ]]
printf 'PASS: backup restore verifier\nbackup=%s\ntables=%s navigator_styles=%s RogerVideo=%s room1000=%s\n' "$B" "$tables" "$nav" "$user" "$room"
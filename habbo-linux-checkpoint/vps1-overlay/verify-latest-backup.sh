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
gzip -t havana.sql.gz

tar -C "$WORK" -xzf ops-overlay.tar.gz
tar -C "$WORK" -xzf web-frontend-overlay.tar.gz

test -x "$WORK/ops/smoke-test.sh"
test -x "$WORK/ops/public-web-smoke.sh"
test -f "$WORK/ops/public-web-direct-assets-audit.py"
test -f "$WORK/ops/ensure-home-libs2-overlay.sh"
test -f "$WORK/ops/public-web-webkit-smoke.py"\ntest -x "$WORK/ops/network-perimeter-smoke.sh"\ntest -x "$WORK/ops/deployment-final-validate.sh"
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

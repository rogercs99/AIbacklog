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
test -f "$B/DISASTER_RECOVERY_MANIFEST.md"
test -f "$B/HOST_PREREQUISITES.md"
test -f "$B/cloudflared-stremio-legacy.service"
grep -q "cloudflared.*--config /etc/cloudflared-stremio-legacy/config.yml tunnel run" "$B/cloudflared-stremio-legacy.service"
test -f "$B/havana-source-b550f00.bundle"
test -f "$B/habbo-library-chunks-sha256.txt"
test -f "$B/habbo-runtime-prefix-parts-sha256.txt"
test -f "$B/habbo-2009-dual-linux-FINAL-v2-20260923.zip"
echo 'f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec  '"$B"'/habbo-2009-dual-linux-FINAL-v2-20260923.zip' | sha256sum -c - >/dev/null
echo '77672bee2a6b8f879aa8cb0acbac41b7bc203b4487e1464ebacbc1848564bcb5  '"$B"'/havana-source-b550f00.bundle' | sha256sum -c - >/dev/null
echo '31f607e2c83bbc3859687492236b21b1c5da2439939b1e715abc3eebdb6260d8  '"$B"'/habbo-library-chunks-sha256.txt' | sha256sum -c - >/dev/null
echo '33574318d69e29e4ddfa2430af4d87467836626432085cac2326f7efdf47fec6  '"$B"'/habbo-runtime-prefix-parts-sha256.txt' | sha256sum -c - >/dev/null
git bundle list-heads "$B/havana-source-b550f00.bundle" | grep -q '^b550f00f27788145d26723fd19e943aa63504a63 ' || { echo 'FAIL: backed-up Havana bundle commit mismatch' >&2; exit 1; }
unzip -tqq "$B/habbo-2009-dual-linux-FINAL-v2-20260923.zip" || { echo 'FAIL: backed-up FINAL-v2 ZIP is unreadable' >&2; exit 1; }
[[ "$(wc -l < "$B/habbo-library-chunks-sha256.txt")" -eq 15 ]] || { echo 'FAIL: Library backend/WWW manifest line count mismatch' >&2; exit 1; }
[[ "$(wc -l < "$B/habbo-runtime-prefix-parts-sha256.txt")" -eq 7 ]] || { echo 'FAIL: Library runtime/prefix manifest line count mismatch' >&2; exit 1; }
mkdir -p "$WORK/havana-bundle-verify"
git init -q "$WORK/havana-bundle-verify"
git -C "$WORK/havana-bundle-verify" bundle verify "$B/havana-source-b550f00.bundle" >/dev/null 2>&1 || { echo 'FAIL: backed-up Havana bundle verification failed' >&2; exit 1; }
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=advice.detachedHead GIT_CONFIG_VALUE_0=false git clone -q "$B/havana-source-b550f00.bundle" "$WORK/Havana-offline" || { echo 'FAIL: backed-up Havana bundle cannot be cloned offline' >&2; exit 1; }
[[ "$(git -C "$WORK/Havana-offline" rev-parse HEAD)" == 'b550f00f27788145d26723fd19e943aa63504a63' ]] || { echo 'FAIL: offline Havana clone HEAD mismatch' >&2; exit 1; }
test -f "$WORK/Havana-offline/Dockerfile-Server"
test -f "$WORK/Havana-offline/Dockerfile-Web"
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
test -x "$WORK/ops/disaster-recovery-source-smoke.sh"
test -x "$WORK/ops/disaster-restore-drill.sh"
test -x "$WORK/ops/habbo-backup-daily.sh"
test -f "$B/habbo-backup-daily.service"
test -f "$B/habbo-backup-daily.timer"
test -f "$B/habbo-disaster-drill.service"
test -f "$B/habbo-disaster-drill.timer"
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
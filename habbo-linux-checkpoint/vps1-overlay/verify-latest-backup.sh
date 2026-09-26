#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
B=${1:-$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")}
[[ -d "$B" ]]
WORK=$(mktemp -d /dev/shm/habbo-restore-verify.XXXXXX)
VERIFY_CONTAINER="habbo-backup-restore-verify-$$"
EXPECTED_MARIADB_DIGEST='mariadb@sha256:2d50fe0f77dac919396091e527e5e148a9de690e58f32875f113bef6506a17f5'
VERIFY_IMAGE=$(docker inspect habbo-mariadb-1 --format '{{.Image}}')
cleanup() {
  docker rm -f "$VERIFY_CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

cd "$B"
sha256sum -c SHA256SUMS
find "$B" -maxdepth 1 -mindepth 1 -type f ! -name SHA256SUMS -printf '%f\n' | sort > "$WORK/top-files.list"
awk '{print $2}' "$B/SHA256SUMS" | sed 's#^\./##' | sort > "$WORK/manifest-files.list"
cmp -s "$WORK/top-files.list" "$WORK/manifest-files.list" || { echo 'FAIL: SHA256SUMS does not cover every top-level backup file exactly once' >&2; diff -u "$WORK/top-files.list" "$WORK/manifest-files.list" >&2 || true; exit 1; }
grep -Fxq '.env' "$WORK/manifest-files.list" || { echo 'FAIL: .env is not covered by SHA256SUMS' >&2; exit 1; }
test -f "$B/db-backup-contract.txt"
[[ "$(stat -c '%a %U:%G' "$B/db-backup-contract.txt")" == '600 root:root' ]] || { echo 'FAIL: DB backup contract permissions invalid' >&2; exit 1; }
grep -Fxq 'contract_version=1' "$B/db-backup-contract.txt" || { echo 'FAIL: DB backup contract version mismatch' >&2; exit 1; }
grep -Fxq 'consistency=global-read-lock' "$B/db-backup-contract.txt" || { echo 'FAIL: DB backup consistency contract mismatch' >&2; exit 1; }
grep -Fxq 'dump_tool=mariadb-dump' "$B/db-backup-contract.txt" || { echo 'FAIL: DB dump tool contract mismatch' >&2; exit 1; }
db_flags=$(awk -F= '$1=="dump_flags" {sub(/^[^=]*=/,""); print; exit}' "$B/db-backup-contract.txt")
for required in --lock-all-tables --routines --triggers --events --hex-blob; do
  grep -qw -- "$required" <<<"$db_flags" || { echo "FAIL: DB backup contract missing flag $required" >&2; exit 1; }
done
expected_engines=$(awk -F= '$1=="engine_counts" {sub(/^[^=]*=/,""); print; exit}' "$B/db-backup-contract.txt")
expected_objects=$(awk -F= '$1=="object_counts" {sub(/^[^=]*=/,""); print; exit}' "$B/db-backup-contract.txt")
expected_binary=$(awk -F= '$1=="binary_columns" {print $2; exit}' "$B/db-backup-contract.txt")
[[ "$expected_engines" =~ (^|,)MyISAM:[1-9][0-9]*($|,) ]] || { echo 'FAIL: DB backup contract lost MyISAM inventory' >&2; exit 1; }
[[ "$expected_binary" =~ ^[0-9]+$ ]] || { echo 'FAIL: DB backup contract binary column count invalid' >&2; exit 1; }
test -f "$B/.env"
test -f "$B/DISASTER_RECOVERY_MANIFEST.md"
test -f "$B/HOST_PREREQUISITES.md"
test -f "$B/cloudflared-stremio-legacy.service"
test -f "$B/bridge-reverse-ssh.service"
grep -F -- '-R 127.0.0.1:22022:127.0.0.1:22 bridge-new' "$B/bridge-reverse-ssh.service" >/dev/null
grep -Fq -- "--config /etc/cloudflared-stremio-legacy/config.yml" "$B/cloudflared-stremio-legacy.service"
grep -Fq -- "--metrics 127.0.0.1:20241" "$B/cloudflared-stremio-legacy.service"
grep -Fq -- "tunnel run" "$B/cloudflared-stremio-legacy.service"
test -f "$B/havana-source-b550f00.bundle"
test -f "$B/habbo-library-chunks-sha256.txt"
test -f "$B/habbo-runtime-prefix-parts-sha256.txt"
test -f "$B/vps2-control-plane-overlay.tar.gz"
test -f "$B/vps2-control-plane-files-sha256.txt"
test -f "$B/habbo-2009-dual-linux-FINAL-v2-20260923.zip"
echo 'f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec  '"$B"'/habbo-2009-dual-linux-FINAL-v2-20260923.zip' | sha256sum -c - >/dev/null
echo '9e3ee88b2670e7156c7c05bca13646b9d5378e1b8d83f3a7f2eb53fefa344a4f  '"$B"'/havana-source-b550f00.bundle' | sha256sum -c - >/dev/null
echo '31f607e2c83bbc3859687492236b21b1c5da2439939b1e715abc3eebdb6260d8  '"$B"'/habbo-library-chunks-sha256.txt' | sha256sum -c - >/dev/null
echo '33574318d69e29e4ddfa2430af4d87467836626432085cac2326f7efdf47fec6  '"$B"'/habbo-runtime-prefix-parts-sha256.txt' | sha256sum -c - >/dev/null
git bundle list-heads "$B/havana-source-b550f00.bundle" | grep '^b550f00f27788145d26723fd19e943aa63504a63 ' >/dev/null || { echo 'FAIL: backed-up Havana bundle commit mismatch' >&2; exit 1; }
unzip -tqq "$B/habbo-2009-dual-linux-FINAL-v2-20260923.zip" || { echo 'FAIL: backed-up FINAL-v2 ZIP is unreadable' >&2; exit 1; }
[[ "$(wc -l < "$B/habbo-library-chunks-sha256.txt")" -eq 15 ]] || { echo 'FAIL: Library backend/WWW manifest line count mismatch' >&2; exit 1; }
[[ "$(wc -l < "$B/habbo-runtime-prefix-parts-sha256.txt")" -eq 7 ]] || { echo 'FAIL: Library runtime/prefix manifest line count mismatch' >&2; exit 1; }
[[ "$(wc -l < "$B/vps2-control-plane-files-sha256.txt")" -eq 29 ]] || { echo 'FAIL: VPS2 control-plane recovery manifest line count mismatch' >&2; exit 1; }
"$ROOT/ops/vps2-control-plane-recovery-smoke.sh" "$B" >/dev/null || { echo 'FAIL: backed-up VPS2 control-plane recovery kit verification failed' >&2; exit 1; }
tar -tzf "$B/ops-overlay.tar.gz" | grep -Fx 'ops/vps2-control-plane-recovery-smoke.sh' >/dev/null || { echo 'FAIL: ops overlay missing VPS2 recovery smoke' >&2; exit 1; }
if tar -tzf "$B/ops-overlay.tar.gz" | grep -Eq '(^|/)[^/]*(\.pre-[^/]*|\.bak[^/]*|~)$'; then
  echo 'FAIL: ops overlay contains stale backup/editor artifacts' >&2
  exit 1
fi
mkdir -p "$WORK/havana-bundle-verify"
git init -q "$WORK/havana-bundle-verify"
git -C "$WORK/havana-bundle-verify" bundle verify "$B/havana-source-b550f00.bundle" >/dev/null 2>&1 || { echo 'FAIL: backed-up Havana bundle verification failed' >&2; exit 1; }
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=advice.detachedHead GIT_CONFIG_VALUE_0=false git clone -q "$B/havana-source-b550f00.bundle" "$WORK/Havana-offline" || { echo 'FAIL: backed-up Havana bundle cannot be cloned offline' >&2; exit 1; }
[[ "$(git -C "$WORK/Havana-offline" rev-parse HEAD)" == 'b550f00f27788145d26723fd19e943aa63504a63' ]] || { echo 'FAIL: offline Havana clone HEAD mismatch' >&2; exit 1; }
git -C "$WORK/Havana-offline" fsck --full --no-dangling >/dev/null || { echo FAIL: offline Havana clone object graph is incomplete >&2; exit 1; }
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
test -x "$WORK/ops/backup-retention-prune.sh"
test -x "$WORK/ops/disk-health-smoke.sh"
test -x "$WORK/ops/backup-publication-smoke.sh"
test -x "$WORK/ops/cloudflare-ingress-smoke.sh"
test -x "$WORK/ops/postboot-validate.sh"
test -f "$B/habbo-postboot-validate.service"
test -f "$B/habbo-web-v085.service"
grep -Fq -- "--metrics 127.0.0.1:20241" "$B/cloudflared-stremio-legacy.service"
test -f "$B/habbo-web-v0.8.5-production.tar.gz"
grep -Fq 'ExecStart=/usr/bin/python3 /srv/habbo/releases/v0.8.5-prod-20260926/overlay/frontend_proxy.py' "$B/habbo-web-v085.service"
grep -Fq 'Environment=HABBO_UPSTREAM_PORT=18081' "$B/habbo-web-v085.service"
grep -Fq 'Environment=HABBO_BIND_PORT=18100' "$B/habbo-web-v085.service"
grep -Fq 'Environment=HABBO_V31_PROXY_ORIGIN=http://127.0.0.1:18100' "$B/habbo-web-v085.service"
grep -Fq 'path: ^/v31-websockify(/.*)?$' "$B/cloudflared-stremio-legacy-config.yml"
grep -Fq 'service: http://127.0.0.1:18131' "$B/cloudflared-stremio-legacy-config.yml"
grep -Fq 'path: ^/r39-websockify(/.*)?$' "$B/cloudflared-stremio-legacy-config.yml"
grep -Fq 'service: http://127.0.0.1:18139' "$B/cloudflared-stremio-legacy-config.yml"
grep -Fq 'service: http://127.0.0.1:18100' "$B/cloudflared-stremio-legacy-config.yml"
mkdir -p "$WORK/v085-release"
tar -C "$WORK/v085-release" -xzf "$B/habbo-web-v0.8.5-production.tar.gz"
test -f "$WORK/v085-release/v0.8.5-prod-20260926/overlay/frontend_proxy.py"
test -f "$WORK/v085-release/v0.8.5-prod-20260926/original/frontend_proxy.py.canonical"
test -x "$WORK/v085-release/v0.8.5-prod-20260926/bin/v31-control"
test -x "$WORK/v085-release/v0.8.5-prod-20260926/bin/v31-inject"
test -x "$WORK/v085-release/v0.8.5-prod-20260926/bin/r39-control"
test -x "$WORK/v085-release/v0.8.5-prod-20260926/scripts/v31_stream_runtime.sh"
test -x "$WORK/v085-release/v0.8.5-prod-20260926/scripts/r39_stream_runtime.sh"
test -x "$WORK/v085-release/v0.8.5-prod-20260926/scripts/v31_ticket_injector.py"
test -x "$WORK/v085-release/v0.8.5-prod-20260926/scripts/runtime/qemu-wine-wrapper"
test -x "$WORK/ops/runtime-healthcheck.sh"
test -x "$WORK/ops/runtime-healthcheck-failed.sh"
test -x "$WORK/ops/habbo-status.sh"
test -x "$WORK/ops/db-backup-consistency-smoke.sh"
test -x "$WORK/ops/secret-permissions-smoke.sh"
test -x "$WORK/ops/disaster-recovery-source-smoke.sh"
test -x "$WORK/ops/disaster-restore-drill.sh"
test -x "$WORK/ops/offsite-backup-smoke.sh"
test -x "$WORK/ops/offsite-restore-drill-smoke.sh"
test -x "$WORK/ops/public-webkit-remote-smoke.sh"
test -x "$WORK/ops/vps2-control-plane-smoke.sh"
test -x "$WORK/ops/refresh-vps2-control-plane-kit.sh"
test -x "$WORK/ops/habbo-backup-daily.sh"
test -x "$WORK/ops/backup-failed.sh"
test -x "$WORK/ops/disaster-drill-failed.sh"
test -f "$B/habbo-backup-daily.service"
test -f "$B/habbo-backup-daily-failed.service"
test -f "$B/habbo-backup-daily.timer"
test -f "$B/habbo-disaster-drill.service"
test -f "$B/habbo-disaster-drill-failed.service"
test -f "$B/habbo-disaster-drill.timer"
test -f "$B/habbo-runtime-healthcheck-failed.service"
test -f "$B/habbo-runtime-healthcheck.service"
test -f "$B/habbo-runtime-healthcheck.timer"
test -f "$WORK/web-frontend-assets/templates/index_v32.tpl"
grep -q 'static/js/libs2.js' "$WORK/web-frontend-assets/templates/index_v32.tpl"

digests=$(docker image inspect "$VERIFY_IMAGE" --format '{{range .RepoDigests}}{{println .}}{{end}}')
grep -Fxq "$EXPECTED_MARIADB_DIGEST" <<<"$digests" || { echo 'FAIL: live MariaDB image does not match pinned digest' >&2; exit 1; }

docker run -d --name "$VERIFY_CONTAINER" \
  --network none \
  --tmpfs /var/lib/mysql:rw,nosuid,nodev,size=320m \
  -e MARIADB_ROOT_PASSWORD=verify-root \
  -e MARIADB_DATABASE=restore_verify \
  "$VERIFY_IMAGE" >/dev/null

[[ "$(docker inspect "$VERIFY_CONTAINER" --format '{{.HostConfig.NetworkMode}}')" == none ]] || { echo 'FAIL: isolated restore container has unexpected network mode' >&2; exit 1; }
[[ -z "$(docker port "$VERIFY_CONTAINER")" ]] || { echo 'FAIL: isolated restore container unexpectedly publishes ports' >&2; exit 1; }
tmpfs_spec=$(docker inspect "$VERIFY_CONTAINER" --format '{{index .HostConfig.Tmpfs "/var/lib/mysql"}}')
[[ "$tmpfs_spec" == *'size=320m'* ]] || { echo 'FAIL: isolated restore datadir is not tmpfs' >&2; exit 1; }

ready=false
for i in $(seq 1 60); do
  if docker exec "$VERIFY_CONTAINER" mariadb-admin --protocol=tcp -h127.0.0.1 -uroot -pverify-root ping --silent >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
$ready || { docker logs "$VERIFY_CONTAINER" >&2 || true; echo 'FAIL: isolated MariaDB did not become ready' >&2; exit 1; }

gzip -cd "$B/havana.sql.gz" | docker exec -i "$VERIFY_CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -uroot -pverify-root restore_verify
read -r tables nav user room < <(docker exec "$VERIFY_CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pverify-root restore_verify -e "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='restore_verify'),(SELECT COUNT(*) FROM navigator_styles),(SELECT COUNT(*) FROM users WHERE username='RogerVideo'),(SELECT COUNT(*) FROM rooms WHERE id=1000);")
[[ "$tables" == 88 ]] || { echo "FAIL: restored table count mismatch: $tables" >&2; exit 1; }
[[ "$nav" == 40 ]] || { echo "FAIL: restored navigator_styles mismatch: $nav" >&2; exit 1; }
[[ "$user" == 1 ]] || { echo "FAIL: restored RogerVideo mismatch: $user" >&2; exit 1; }
[[ "$room" == 1 ]] || { echo "FAIL: restored room1000 mismatch: $room" >&2; exit 1; }
restored_engines=$(docker exec "$VERIFY_CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pverify-root restore_verify -e "SELECT CONCAT(COALESCE(ENGINE,'NULL'),':',COUNT(*)) FROM information_schema.tables WHERE table_schema=DATABASE() GROUP BY ENGINE ORDER BY ENGINE;" | tr '\n' ',' | sed 's/,$//')
restored_objects=$(docker exec "$VERIFY_CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pverify-root restore_verify -e "SELECT CONCAT('triggers:',(SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema=DATABASE()),',routines:',(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE()),',events:',(SELECT COUNT(*) FROM information_schema.events WHERE event_schema=DATABASE()));")
restored_binary=$(docker exec "$VERIFY_CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pverify-root restore_verify -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND DATA_TYPE IN ('binary','varbinary','tinyblob','blob','mediumblob','longblob','bit');")
[[ "$restored_engines" == "$expected_engines" ]] || { echo "FAIL: restored engine inventory mismatch: $restored_engines != $expected_engines" >&2; exit 1; }
[[ "$restored_objects" == "$expected_objects" ]] || { echo "FAIL: restored SQL object inventory mismatch: $restored_objects != $expected_objects" >&2; exit 1; }
[[ "$restored_binary" == "$expected_binary" ]] || { echo "FAIL: restored binary-column inventory mismatch: $restored_binary != $expected_binary" >&2; exit 1; }

printf 'PASS: backup restore verifier\nbackup=%s\ntables=%s navigator_styles=%s RogerVideo=%s room1000=%s\nrestore_isolation=network-none tmpfs-datadir no-published-ports live-db-untouched\ndb_contract=global-read-lock engines+objects+binary-columns-exact\n' "$B" "$tables" "$nav" "$user" "$room"

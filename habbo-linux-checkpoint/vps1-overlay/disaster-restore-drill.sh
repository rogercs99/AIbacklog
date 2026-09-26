#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/srv/habbo
B=${1:-$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")}
EXPECTED_COMMIT=b550f00f27788145d26723fd19e943aa63504a63
EXPECTED_FINAL=f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -d "$B" ]] || fail "backup missing: $B"
SHM_MIN_KB=524288
shm_free_kb=$(df -Pk /dev/shm | awk 'NR==2 {print $4}')
[[ "$shm_free_kb" -ge "$SHM_MIN_KB" ]] || fail "insufficient /dev/shm for disaster drill: ${shm_free_kb} KiB"

TMP=$(mktemp -d /dev/shm/habbo-drill.XXXXXX)
trap 'rm -rf "$TMP"' EXIT
R="$TMP/root"
mkdir -p "$R/srv/habbo" "$R/etc/cloudflared-stremio-legacy" "$R/etc/systemd/system" "$R/final"

# Core mutable deployment files.
install -m 600 "$B/.env" "$R/srv/habbo/.env"
install -m 600 "$B/docker-compose.yml" "$R/srv/habbo/docker-compose.yml"
install -m 600 "$B/PROJECT_CONTEXT.md" "$R/srv/habbo/PROJECT_CONTEXT.md"
install -m 600 "$B/DISASTER_RECOVERY_MANIFEST.md" "$R/srv/habbo/DISASTER_RECOVERY_MANIFEST.md"
install -m 600 "$B/HOST_PREREQUISITES.md" "$R/srv/habbo/HOST_PREREQUISITES.md"
install -m 600 "$B/cloudflared-stremio-legacy-config.yml" "$R/etc/cloudflared-stremio-legacy/config.yml"
install -m 600 "$B/cloudflared-tunnel-credentials.json" "$R/etc/cloudflared-stremio-legacy/credentials.json"

# Restore overlays exactly into a fresh root.
tar -xzf "$B/ops-overlay.tar.gz" -C "$R/srv/habbo"
tar -xzf "$B/web-frontend-overlay.tar.gz" -C "$R/srv/habbo"
[[ -x "$R/srv/habbo/ops/backup.sh" ]] || fail 'ops overlay did not restore backup.sh'
[[ -f "$R/srv/habbo/web-frontend-assets/web-gallery/static/js/landing.js" ]] || fail 'frontend overlay missing landing.js'

# Offline source restore.
GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=advice.detachedHead GIT_CONFIG_VALUE_0=false git clone -q "$B/havana-source-b550f00.bundle" "$R/srv/habbo/Havana"
[[ "$(git -C "$R/srv/habbo/Havana" rev-parse HEAD)" == "$EXPECTED_COMMIT" ]] || fail 'restored Havana commit mismatch'
git -C "$R/srv/habbo/Havana" fsck --full --no-dangling >/dev/null || fail restored Havana object graph incomplete
[[ -z "$(git -C "$R/srv/habbo/Havana" status --porcelain)" ]] || fail 'restored Havana checkout dirty'

# FINAL-v2 must be independently readable and exact.
echo "$EXPECTED_FINAL  $B/habbo-2009-dual-linux-FINAL-v2-20260923.zip" | sha256sum -c - >/dev/null
unzip -tqq "$B/habbo-2009-dual-linux-FINAL-v2-20260923.zip"
unzip -q "$B/habbo-2009-dual-linux-FINAL-v2-20260923.zip" -d "$R/final"
[[ -f "$R/final/habbo-final-v2-20260923/restore-habbo-final.sh" ]] || fail 'FINAL-v2 restore script missing after extraction'

# Compose must resolve using only backed-up env + compose. It is parsed, not started.
docker compose --env-file "$R/srv/habbo/.env" -f "$R/srv/habbo/docker-compose.yml" config --format json >"$TMP/compose.json" 2>"$TMP/compose.err"
if grep -qi 'is not set\|Defaulting to a blank string' "$TMP/compose.err"; then
  fail 'restored Compose has unresolved environment variables'
fi
python3 - "$TMP/compose.json" <<'PYCOMPOSE'
import json,sys
o=json.load(open(sys.argv[1],encoding='utf-8'))
s=o.get('services',{})
if s.get('mariadb',{}).get('image') != 'mariadb:11.5.2': raise SystemExit('MariaDB image mismatch')
for name in ('havana-server','havana-web'):
    build=s.get(name,{}).get('build',{})
    if build.get('context') != '/srv/habbo/Havana': raise SystemExit(name+' build context mismatch')
ports=[]
for name,cfg in s.items():
    for p in cfg.get('ports',[]) or []:
        ports.append((name,str(p.get('host_ip','')),int(p.get('target',0)),str(p.get('published',''))))
        if str(p.get('host_ip','')) != '127.0.0.1': raise SystemExit('non-loopback published port: '+repr(ports[-1]))
if ('mariadb','127.0.0.1',3306,'13307') not in ports: raise SystemExit('MariaDB loopback 13307 mapping missing')
for required in [('havana-server','127.0.0.1',12321,'12321'),('havana-server','127.0.0.1',12323,'12323'),('havana-web','127.0.0.1',80,'18081')]:
    if required not in ports: raise SystemExit('required loopback mapping missing: '+repr(required))
PYCOMPOSE

# Cloudflare config/credential pair must be internally coherent.
python3 - "$R/etc/cloudflared-stremio-legacy/config.yml" "$R/etc/cloudflared-stremio-legacy/credentials.json" <<'PY'
import json,re,sys
cfg=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'(?m)^\s*tunnel:\s*([^#\s]+)',cfg)
if not m: raise SystemExit('tunnel id missing')
obj=json.load(open(sys.argv[2],encoding='utf-8'))
if str(obj.get('TunnelID','')) != m.group(1).strip(): raise SystemExit('TunnelID mismatch')
if not obj.get('AccountTag') or not obj.get('TunnelSecret'): raise SystemExit('credential fields missing')
PY

# Copy backed-up systemd units and syntax-check them without installing/enabling.
for f in "$B"/*.service "$B"/*.timer; do
  [[ -f "$f" ]] || continue
  install -m 600 "$f" "$R/etc/systemd/system/${f##*/}"
done
units=("$R/etc/systemd/system"/*.service "$R/etc/systemd/system"/*.timer)
required_units=(
  habbo-stack.service habbo-static.service habbo-websockify.service habbo-postboot-validate.service
  habbo-runtime-healthcheck.service habbo-runtime-healthcheck-failed.service habbo-runtime-healthcheck.timer
  habbo-backup-daily.service habbo-backup-daily-failed.service habbo-backup-daily.timer
  habbo-disaster-drill.service habbo-disaster-drill-failed.service habbo-disaster-drill.timer
  cloudflared-stremio-legacy.service bridge-reverse-ssh.service
)
for u in "${required_units[@]}"; do
  [[ -f "$R/etc/systemd/system/$u" ]] || fail "required systemd unit missing: $u"
done
grep -F -- '-R 127.0.0.1:22022:127.0.0.1:22 bridge-new' "$R/etc/systemd/system/bridge-reverse-ssh.service" >/dev/null || fail 'reverse SSH route contract missing'
systemd-analyze verify "${units[@]}" >"$TMP/systemd-verify.log" 2>&1 || { cat "$TMP/systemd-verify.log" >&2; fail 'restored systemd unit verification failed'; }

# Verify backup DB through the existing isolated temporary-DB verifier.
"$ROOT/ops/verify-latest-backup.sh" "$B" >/dev/null

STAMP=/run/habbo-disaster-drill
{
  printf 'validated_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'backup=%s\n' "$B"
  printf 'havana_commit=%s\n' "$EXPECTED_COMMIT"
} >"$STAMP"
chmod 0644 "$STAMP"
rm -f "$ROOT/DISASTER_DRILL_FAILED"
echo 'PASS: Habbo disaster restore drill'
echo "backup=$B havana_commit=$EXPECTED_COMMIT compose=resolved cloudflare=coherent systemd=verified final_v2=verified db_restore=verified workspace=tmpfs"

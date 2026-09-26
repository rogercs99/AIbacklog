#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/var/backups/habbo-vps1
EXPECTED_FINAL=f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec
EXPECTED_HAVANA=b550f00f27788145d26723fd19e943aa63504a63
EXPECTED_BUNDLE=9e3ee88b2670e7156c7c05bca13646b9d5378e1b8d83f3a7f2eb53fefa344a4f
MARIADB_REF='mariadb@sha256:2d50fe0f77dac919396091e527e5e148a9de690e58f32875f113bef6506a17f5'
CONTAINER=habbo-offsite-restore-drill
LOCK=/run/lock/habbo-vps1-offsite.lock
exec 8>"$LOCK"
flock -w 120 8 || { echo 'FAIL: offsite lock unavailable after 120s' >&2; exit 1; }

archive=${1:-$(cat "$ROOT/LATEST")}
[[ -f "$archive" ]] || { echo "FAIL: offsite archive missing: $archive" >&2; exit 1; }
[[ -f "$archive.sha256" ]] || { echo "FAIL: offsite archive checksum missing" >&2; exit 1; }
sha256sum -c "$archive.sha256" --status || { echo 'FAIL: offsite archive SHA-256 mismatch' >&2; exit 1; }

/usr/local/sbin/habbo-vps2-space-preflight.sh

work=$(mktemp -d /dev/shm/habbo-offsite-drill.XXXXXX)
pulled_image=false
cleanup(){
  rc=$?
  if [[ $rc -ne 0 ]] && docker ps -a --format '{{.Names}}' | grep -Fxq "$CONTAINER"; then
    echo '=== temporary MariaDB logs ===' >&2
    docker logs "$CONTAINER" 2>&1 | tail -80 >&2 || true
  fi
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  if $pulled_image; then docker image rm "$MARIADB_REF" >/dev/null 2>&1 || true; fi
  rm -rf "$work"
  exit $rc
}
trap cleanup EXIT

/usr/local/sbin/habbo-offsite-tar-safety.py "$archive" >/dev/null || { echo 'FAIL: offsite archive structural safety check failed' >&2; exit 1; }
tar -xzf "$archive" -C "$work"
( cd "$work" && sha256sum -c SHA256SUMS --status ) || { echo 'FAIL: internal SHA256SUMS verification failed' >&2; exit 1; }
actual_digest=$(find "$work" -maxdepth 1 -mindepth 1 -type f ! -name SHA256SUMS -printf '%f\n' | sort | sha256sum | awk '{print $1}')
manifest_digest=$(awk '{print $2}' "$work/SHA256SUMS" | sed 's#^\./##' | sort | sha256sum | awk '{print $1}')
[[ "$actual_digest" == "$manifest_digest" ]] || { echo 'FAIL: internal manifest coverage mismatch' >&2; exit 1; }
grep -Eq '^[0-9a-f]{64}  (\./)?\.env$' "$work/SHA256SUMS" || { echo 'FAIL: .env missing from internal manifest' >&2; exit 1; }
[[ -f "$work/db-backup-contract.txt" ]] || { echo 'FAIL: DB backup contract missing from offsite archive' >&2; exit 1; }
[[ "$(stat -c '%a %U:%G' "$work/db-backup-contract.txt")" == '600 root:root' ]] || { echo 'FAIL: DB backup contract permissions invalid' >&2; exit 1; }
grep -Fxq 'contract_version=1' "$work/db-backup-contract.txt" || { echo 'FAIL: DB backup contract version mismatch' >&2; exit 1; }
grep -Fxq 'consistency=global-read-lock' "$work/db-backup-contract.txt" || { echo 'FAIL: DB consistency contract mismatch' >&2; exit 1; }
db_flags=$(awk -F= '$1=="dump_flags" {sub(/^[^=]*=/,""); print; exit}' "$work/db-backup-contract.txt")
for required_flag in --lock-all-tables --routines --triggers --events --hex-blob; do
  grep -qw -- "$required_flag" <<<"$db_flags" || { echo "FAIL: DB contract missing flag $required_flag" >&2; exit 1; }
done
expected_engines=$(awk -F= '$1=="engine_counts" {sub(/^[^=]*=/,""); print; exit}' "$work/db-backup-contract.txt")
expected_objects=$(awk -F= '$1=="object_counts" {sub(/^[^=]*=/,""); print; exit}' "$work/db-backup-contract.txt")
expected_binary=$(awk -F= '$1=="binary_columns" {print $2; exit}' "$work/db-backup-contract.txt")
[[ "$expected_engines" =~ (^|,)MyISAM:[1-9][0-9]*($|,) ]] || { echo 'FAIL: DB contract lost MyISAM inventory' >&2; exit 1; }
[[ "$expected_binary" =~ ^[0-9]+$ ]] || { echo 'FAIL: DB contract binary column count invalid' >&2; exit 1; }

echo "$EXPECTED_FINAL  $work/habbo-2009-dual-linux-FINAL-v2-20260923.zip" | sha256sum -c - >/dev/null
echo "$EXPECTED_BUNDLE  $work/havana-source-b550f00.bundle" | sha256sum -c - >/dev/null
unzip -tqq "$work/habbo-2009-dual-linux-FINAL-v2-20260923.zip"
[[ $(wc -l < "$work/habbo-library-chunks-sha256.txt") -eq 15 ]]
[[ $(wc -l < "$work/habbo-runtime-prefix-parts-sha256.txt") -eq 7 ]]

GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=advice.detachedHead GIT_CONFIG_VALUE_0=false git clone -q "$work/havana-source-b550f00.bundle" "$work/Havana"
[[ "$(git -C "$work/Havana" rev-parse HEAD)" == "$EXPECTED_HAVANA" ]]
[[ -z "$(git -C "$work/Havana" status --porcelain)" ]]

# Resolve Compose only from the archived env + compose file.
docker compose --env-file "$work/.env" -f "$work/docker-compose.yml" config --format json >"$work/compose.json"
python3 - "$work/compose.json" <<'PY'
import json,sys
o=json.load(open(sys.argv[1],encoding='utf-8'))
s=o.get('services',{})
if s.get('mariadb',{}).get('image')!='mariadb:11.5.2': raise SystemExit('MariaDB image mismatch')
for name in ('havana-server','havana-web'):
    if s.get(name,{}).get('build',{}).get('context')!='/srv/habbo/Havana': raise SystemExit(name+' build context mismatch')
ports=[]
for name,cfg in s.items():
    for p in cfg.get('ports',[]) or []:
        t=(name,str(p.get('host_ip','')),int(p.get('target',0)),str(p.get('published','')))
        ports.append(t)
        if t[1] != '127.0.0.1': raise SystemExit('non-loopback published port: '+repr(t))
for req in [('mariadb','127.0.0.1',3306,'13307'),('havana-server','127.0.0.1',12321,'12321'),('havana-server','127.0.0.1',12323,'12323'),('havana-web','127.0.0.1',80,'18081')]:
    if req not in ports: raise SystemExit('required mapping missing: '+repr(req))
PY

python3 - "$work/cloudflared-stremio-legacy-config.yml" "$work/cloudflared-tunnel-credentials.json" <<'PY'
import json,re,sys
cfg=open(sys.argv[1],encoding='utf-8').read(); obj=json.load(open(sys.argv[2],encoding='utf-8'))
m=re.search(r'(?m)^\s*tunnel:\s*([^#\s]+)',cfg)
if not m or str(obj.get('TunnelID',''))!=m.group(1).strip(): raise SystemExit('Cloudflare tunnel mismatch')
if not obj.get('AccountTag') or not obj.get('TunnelSecret'): raise SystemExit('Cloudflare credential incomplete')
PY

# Unit inventory. Syntax is already tested on VPS1; here we prove all required unit files are present in the offsite archive.
required=(habbo-stack.service habbo-static.service habbo-websockify.service habbo-postboot-validate.service habbo-runtime-healthcheck.service habbo-runtime-healthcheck-failed.service habbo-runtime-healthcheck.timer habbo-backup-daily.service habbo-backup-daily-failed.service habbo-backup-daily.timer habbo-disaster-drill.service habbo-disaster-drill-failed.service habbo-disaster-drill.timer cloudflared-stremio-legacy.service)
for u in "${required[@]}"; do [[ -f "$work/$u" ]] || { echo "FAIL: missing archived unit $u" >&2; exit 1; }; done

# Pull exact MariaDB image only if needed, then restore entirely into tmpfs with no published ports.
if ! docker image inspect "$MARIADB_REF" >/dev/null 2>&1; then
  docker pull "$MARIADB_REF" >/dev/null
  pulled_image=true
fi
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
docker run -d --name "$CONTAINER" --network none --tmpfs /var/lib/mysql:rw,nosuid,nodev,size=384m -e MARIADB_ROOT_PASSWORD=drill-root -e MARIADB_DATABASE=restore_verify "$MARIADB_REF" >/dev/null
[[ "$(docker inspect "$CONTAINER" --format '{{.HostConfig.NetworkMode}}')" == none ]] || { echo 'FAIL: restore container network mode is not none' >&2; exit 1; }
[[ -z "$(docker port "$CONTAINER")" ]] || { echo 'FAIL: restore container unexpectedly publishes ports' >&2; exit 1; }
tmpfs_spec=$(docker inspect "$CONTAINER" --format '{{index .HostConfig.Tmpfs "/var/lib/mysql"}}')
[[ "$tmpfs_spec" == *'size=384m'* ]] || { echo 'FAIL: restore DB datadir is not expected tmpfs' >&2; exit 1; }
for i in $(seq 1 60); do
  if docker exec "$CONTAINER" mariadb-admin --protocol=tcp -h127.0.0.1 -uroot -pdrill-root ping --silent >/dev/null 2>&1; then break; fi
  sleep 1
  [[ "$i" -lt 60 ]] || { echo 'FAIL: temporary MariaDB did not become ready' >&2; exit 1; }
done
gzip -cd "$work/havana.sql.gz" | docker exec -i "$CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -uroot -pdrill-root restore_verify
read -r tables nav user room < <(docker exec "$CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pdrill-root restore_verify -e "SELECT (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='restore_verify'),(SELECT COUNT(*) FROM navigator_styles),(SELECT COUNT(*) FROM users WHERE username='RogerVideo'),(SELECT COUNT(*) FROM rooms WHERE id=1000);")
[[ "$tables" -eq 88 && "$nav" -eq 40 && "$user" -eq 1 && "$room" -eq 1 ]] || { echo "FAIL: restored DB invariants tables=$tables nav=$nav user=$user room=$room" >&2; exit 1; }
restored_engines=$(docker exec "$CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pdrill-root restore_verify -e "SELECT CONCAT(COALESCE(ENGINE,'NULL'),':',COUNT(*)) FROM information_schema.tables WHERE table_schema=DATABASE() GROUP BY ENGINE ORDER BY ENGINE;" | tr '\n' ',' | sed 's/,$//')
restored_objects=$(docker exec "$CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pdrill-root restore_verify -e "SELECT CONCAT('triggers:',(SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_schema=DATABASE()),',routines:',(SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema=DATABASE()),',events:',(SELECT COUNT(*) FROM information_schema.events WHERE event_schema=DATABASE()));")
restored_binary=$(docker exec "$CONTAINER" mariadb --protocol=tcp -h127.0.0.1 -N -B -uroot -pdrill-root restore_verify -e "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND DATA_TYPE IN ('binary','varbinary','tinyblob','blob','mediumblob','longblob','bit');")
[[ "$restored_engines" == "$expected_engines" ]] || { echo "FAIL: restored engine inventory mismatch: $restored_engines != $expected_engines" >&2; exit 1; }
[[ "$restored_objects" == "$expected_objects" ]] || { echo "FAIL: restored SQL object inventory mismatch: $restored_objects != $expected_objects" >&2; exit 1; }
[[ "$restored_binary" == "$expected_binary" ]] || { echo "FAIL: restored binary-column inventory mismatch: $restored_binary != $expected_binary" >&2; exit 1; }

docker rm -f "$CONTAINER" >/dev/null

now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
sha=$(sha256sum "$archive" | awk '{print $1}')
printf 'validated_at_utc=%s\narchive=%s\narchive_sha256=%s\nmanifest=complete\nworkspace=tmpfs\nnetwork=none\ndb_datadir=tmpfs\ndb_contract=global-read-lock\ndb_engines=%s\ndb_objects=%s\ndb_binary_columns=%s\ntables=%s\nnavigator_styles=%s\nRogerVideo=%s\nroom1000=%s\n' "$now" "$archive" "$sha" "$restored_engines" "$restored_objects" "$restored_binary" "$tables" "$nav" "$user" "$room" >/var/backups/habbo-vps1/OFFSITE_RESTORE_DRILL_STATUS
chmod 600 /var/backups/habbo-vps1/OFFSITE_RESTORE_DRILL_STATUS
name=${archive##*/}
name=${name%.tar.gz}
source_backup=/srv/habbo/backups/$name
ssh -o BatchMode=yes bridge-old bash -s -- "$now" "$source_backup" "$sha" "$tables" "$nav" "$user" "$room" "$restored_engines" "$restored_objects" "$restored_binary" <<'REMOTE_DRILL_MARKER'
set -euo pipefail
now=$1; backup=$2; sha=$3; tables=$4; nav=$5; user=$6; room=$7; engines=$8; objects=$9; binary=${10}
tmp=/srv/habbo/.OFFSITE_RESTORE_DRILL_STATUS.tmp
printf 'validated_at_utc=%s\nbackup=%s\narchive_sha256=%s\noffsite_host=VPS2\nmanifest=complete\nworkspace=tmpfs\nnetwork=none\ndb_datadir=tmpfs\ndb_contract=global-read-lock\ndb_engines=%s\ndb_objects=%s\ndb_binary_columns=%s\ntables=%s\nnavigator_styles=%s\nRogerVideo=%s\nroom1000=%s\n' "$now" "$backup" "$sha" "$engines" "$objects" "$binary" "$tables" "$nav" "$user" "$room" >"$tmp"
chmod 600 "$tmp"
mv "$tmp" /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS
cp /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS /run/habbo-offsite-restore-drill
chmod 0644 /run/habbo-offsite-restore-drill
rm -f /srv/habbo/OFFSITE_RESTORE_DRILL_FAILED /run/habbo-offsite-restore-drill-failed
REMOTE_DRILL_MARKER

echo 'PASS: Habbo VPS1 offsite restore drill on VPS2'
echo "archive=$archive havana=$EXPECTED_HAVANA compose=resolved cloudflare=coherent units=${#required[@]} manifest=complete workspace=tmpfs network=none db_datadir=tmpfs db_contract=global-read-lock db_engines=$restored_engines db_objects=$restored_objects db_binary_columns=$restored_binary db_tables=$tables navigator_styles=$nav RogerVideo=$user room1000=$room"

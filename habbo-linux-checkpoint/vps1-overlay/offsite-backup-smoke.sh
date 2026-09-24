#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
STATUS=$ROOT/OFFSITE_BACKUP_STATUS
MAX_AGE=129600
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$STATUS" ]] || fail 'offsite backup status missing'
[[ "$(stat -c '%a %U:%G' "$STATUS")" == '600 root:root' ]] || fail 'offsite status permissions invalid'
get(){ awk -F= -v k="$1" '$1==k {sub(/^[^=]*=/,""); print; exit}' "$STATUS"; }
ts=$(get validated_at_utc)
backup=$(get backup)
sha=$(get archive_sha256)
size=$(get archive_size_bytes)
host=$(get offsite_host)
path=$(get offsite_path)
[[ -n "$ts" ]] || fail 'offsite timestamp missing'
age=$(( $(date -u +%s) - $(date -u -d "$ts" +%s) ))
[[ "$age" -ge 0 && "$age" -le "$MAX_AGE" ]] || fail "offsite proof stale (${age}s)"
latest=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")
[[ "$backup" == "$latest" ]] || fail "offsite backup does not match latest backup"
[[ "$sha" =~ ^[0-9a-f]{64}$ ]] || fail 'offsite archive SHA-256 malformed'
[[ "$size" =~ ^[0-9]+$ && "$size" -gt 0 ]] || fail 'offsite archive size invalid'
[[ "$host" == VPS2 ]] || fail 'unexpected offsite host'
name=${latest##*/}
[[ "$path" == "/var/backups/habbo-vps1/$name.tar.gz" ]] || fail 'offsite archive path mismatch'
echo 'PASS: Habbo offsite backup smoke'
echo "age_seconds=$age source=$backup host=$host archive_size_bytes=$size sha256=$sha"
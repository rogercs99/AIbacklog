#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
STATUS=$ROOT/OFFSITE_RESTORE_DRILL_STATUS
MAX_AGE=691200
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$STATUS" ]] || fail 'offsite restore drill status missing'
[[ ! -e "$ROOT/OFFSITE_RESTORE_DRILL_FAILED" ]] || fail 'offsite restore drill failure latch present'
[[ "$(stat -c '%a %U:%G' "$STATUS")" == '600 root:root' ]] || fail 'offsite restore drill status permissions invalid'
get(){ awk -F= -v k="$1" '$1==k {sub(/^[^=]*=/,""); print; exit}' "$STATUS"; }
ts=$(get validated_at_utc)
backup=$(get backup)
sha=$(get archive_sha256)
host=$(get offsite_host)
manifest=$(get manifest)
workspace=$(get workspace)
network=$(get network)
db_datadir=$(get db_datadir)
tables=$(get tables)
nav=$(get navigator_styles)
user=$(get RogerVideo)
room=$(get room1000)
[[ -n "$ts" ]] || fail 'offsite restore drill timestamp missing'
age=$(( $(date -u +%s) - $(date -u -d "$ts" +%s) ))
[[ "$age" -ge 0 && "$age" -le "$MAX_AGE" ]] || fail "offsite restore drill stale (${age}s)"
[[ "$backup" =~ ^/srv/habbo/backups/manual-[0-9]{8}T[0-9]{6}Z$ ]] || fail 'offsite restore drill backup path malformed'
[[ -d "$backup" ]] || fail 'offsite restore drill source backup no longer exists on VPS1'
[[ "$sha" =~ ^[0-9a-f]{64}$ ]] || fail 'offsite restore drill archive SHA-256 malformed'
[[ "$host" == VPS2 ]] || fail 'unexpected offsite restore drill host'
[[ "$manifest" == complete ]] || fail "offsite restore manifest proof invalid: $manifest"
[[ "$workspace" == tmpfs ]] || fail "offsite restore workspace proof invalid: $workspace"
[[ "$network" == none ]] || fail "offsite restore network proof invalid: $network"
[[ "$db_datadir" == tmpfs ]] || fail "offsite restore DB datadir proof invalid: $db_datadir"
[[ "$tables" == 88 ]] || fail "restored table count mismatch: $tables"
[[ "$nav" == 40 ]] || fail "restored navigator_styles mismatch: $nav"
[[ "$user" == 1 ]] || fail "restored RogerVideo mismatch: $user"
[[ "$room" == 1 ]] || fail "restored room1000 mismatch: $room"
echo 'PASS: Habbo offsite restore drill smoke'
echo "age_seconds=$age backup=$backup host=$host tables=$tables navigator_styles=$nav RogerVideo=$user room1000=$room sha256=$sha manifest=complete workspace=tmpfs network=none db_datadir=tmpfs"
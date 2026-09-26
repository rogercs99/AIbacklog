#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
STATUS=$ROOT/CHROMIUM_STATUS
MAX_AGE=129600
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$STATUS" ]] || fail 'Chromium success status missing'
[[ "$(stat -c '%a %U:%G' "$STATUS")" == '600 root:root' ]] || fail 'Chromium status permissions invalid'
[[ ! -e "$ROOT/CHROMIUM_FAILED" ]] || fail 'Chromium failure latch present'
get(){ awk -F= -v k="$1" '$1==k {sub(/^[^=]*=/,""); print; exit}' "$STATUS"; }
ts=$(get validated_at_utc)
result=$(get result)
engine=$(get engine)
device=$(get device)
scenario=$(get scenario)
attempts=$(get attempts)
[[ -n "$ts" ]] || fail 'Chromium timestamp missing'
age=$(( $(date -u +%s) - $(date -u -d "$ts" +%s) ))
[[ "$age" -ge 0 && "$age" -le "$MAX_AGE" ]] || fail "Chromium proof stale (${age}s)"
[[ "$result" == success ]] || fail "Chromium result is $result"
[[ "$engine" == chromium ]] || fail "unexpected browser engine: $engine"
[[ "$device" == 'Desktop 1440x900' ]] || fail "unexpected device profile: $device"
[[ "$scenario" == 'home+register+login+me+V31+R39' ]] || fail "unexpected scenario: $scenario"
[[ "$attempts" =~ ^[12]$ ]] || fail "unexpected Chromium attempt count: $attempts"
echo 'PASS: Habbo remote Chromium desktop smoke proof'
echo "age_seconds=$age engine=$engine device=$device scenario=$scenario attempts=$attempts"

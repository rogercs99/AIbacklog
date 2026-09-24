#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
STATUS=$ROOT/WEBKIT_STATUS
MAX_AGE=129600
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$STATUS" ]] || fail 'WebKit success status missing'
[[ "$(stat -c '%a %U:%G' "$STATUS")" == '600 root:root' ]] || fail 'WebKit status permissions invalid'
[[ ! -e "$ROOT/WEBKIT_FAILED" ]] || fail 'WebKit failure latch present'
get(){ awk -F= -v k="$1" '$1==k {sub(/^[^=]*=/,""); print; exit}' "$STATUS"; }
ts=$(get validated_at_utc)
result=$(get result)
engine=$(get engine)
device=$(get device)
scenario=$(get scenario)
attempts=$(get attempts)
[[ -n "$ts" ]] || fail 'WebKit timestamp missing'
age=$(( $(date -u +%s) - $(date -u -d "$ts" +%s) ))
[[ "$age" -ge 0 && "$age" -le "$MAX_AGE" ]] || fail "WebKit proof stale (${age}s)"
[[ "$result" == success ]] || fail "WebKit result is $result"
[[ "$engine" == webkit ]] || fail "unexpected browser engine: $engine"
[[ "$device" == 'iPhone 14 Plus' ]] || fail "unexpected device profile: $device"
[[ "$scenario" == 'home+register' ]] || fail "unexpected scenario: $scenario"
[[ "$attempts" =~ ^[12]$ ]] || fail "unexpected WebKit attempt count: $attempts"
echo 'PASS: Habbo remote WebKit iPhone smoke proof'
echo "age_seconds=$age engine=$engine device=$device scenario=$scenario attempts=$attempts"
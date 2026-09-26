#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
STATUS=$ROOT/LIVE_DRIFT_STATUS
MAX_AGE=${HABBO_LIVE_DRIFT_MAX_AGE:-27000}
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$STATUS" ]] || fail 'live drift success status missing'
[[ "$(stat -c '%a %U:%G' "$STATUS")" == '600 root:root' ]] || fail 'live drift status permissions invalid'
[[ ! -e "$ROOT/LIVE_DRIFT_FAILED" ]] || fail 'live drift failure latch present'
get(){ awk -F= -v k="$1" '$1==k {sub(/^[^=]*=/,""); print; exit}' "$STATUS"; }
ts=$(get validated_at_utc)
result=$(get result)
sha=$(get baseline_sha256)
release_files=$(get release_files)
release_verified=$(get release_verified)
summary=$(get tracked_summary)
[[ -n "$ts" ]] || fail 'live drift timestamp missing'
age=$(( $(date -u +%s) - $(date -u -d "$ts" +%s) ))
[[ "$age" -ge 0 && "$age" -le "$MAX_AGE" ]] || fail "live drift proof stale (${age}s)"
[[ "$result" == success ]] || fail "live drift result is $result"
[[ "$sha" =~ ^[0-9a-f]{64}$ ]] || fail 'live drift baseline SHA invalid'
[[ "$release_files" == 14 && "$release_verified" == 1 ]] || fail 'promoted release proof incomplete'
[[ "$summary" == *"drifts=0"* && "$summary" == *"missing=0"* ]] || fail "tracked drift summary unhealthy: $summary"
echo 'PASS: Habbo autonomous live drift proof'
echo "age_seconds=$age baseline_sha256=$sha release_files=$release_files release_verified=$release_verified $summary"

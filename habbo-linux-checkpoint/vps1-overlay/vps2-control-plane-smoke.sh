#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
STATUS=$ROOT/VPS2_CONTROL_PLANE_STATUS
MAX_AGE=7500
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$STATUS" ]] || fail 'VPS2 control-plane status missing'
[[ "$(stat -c '%a %U:%G' "$STATUS")" == '600 root:root' ]] || fail 'VPS2 control-plane status permissions invalid'
[[ ! -e "$ROOT/VPS2_CONTROL_PLANE_FAILED" ]] || fail 'VPS2 control-plane failure latch present'
get(){ awk -F= -v k="$1" '$1==k {sub(/^[^=]*=/,""); print; exit}' "$STATUS"; }
ts=$(get validated_at_utc)
result=$(get result)
total=$(get timers_total)
healthy=$(get timers_healthy)
failed=$(get failed_units)
root_free=$(get root_free_kb)
shm_free=$(get shm_free_kb)
offsite_store=$(get offsite_store_healthy)
offsite_deep=$(get offsite_deep_verified)
offsite_bootstrap=$(get offsite_bootstrap_verified)
offsite_deterministic=$(get offsite_recovery_deterministic)
offsite_fingerprint=$(get offsite_recovery_fingerprint)
offsite_archives=$(get offsite_archives)
[[ -n "$ts" ]] || fail 'VPS2 control-plane timestamp missing'
age=$(( $(date -u +%s) - $(date -u -d "$ts" +%s) ))
[[ "$age" -ge 0 && "$age" -le "$MAX_AGE" ]] || fail "VPS2 control-plane proof stale (${age}s)"
[[ "$result" == success ]] || fail "VPS2 control-plane result=$result"
[[ "$total" == 5 ]] || fail "VPS2 timer inventory mismatch: $total"
[[ "$healthy" == 5 ]] || fail "VPS2 healthy timer count mismatch: $healthy"
[[ "$failed" == 0 ]] || fail "VPS2 failed unit count: $failed"
[[ "$root_free" =~ ^[0-9]+$ && "$root_free" -ge 819200 ]] || fail "VPS2 root free space insufficient: $root_free KiB"
[[ "$shm_free" =~ ^[0-9]+$ && "$shm_free" -ge 524288 ]] || fail "VPS2 /dev/shm free space insufficient: $shm_free KiB"
[[ "$offsite_store" == 1 ]] || fail "VPS2 offsite store unhealthy: $offsite_store"
[[ "$offsite_deep" == 1 ]] || fail "VPS2 offsite deep scrub missing: $offsite_deep"
[[ "$offsite_bootstrap" == 1 ]] || fail "VPS2 offsite bootstrap rehearsal missing: $offsite_bootstrap"
[[ "$offsite_deterministic" == 1 ]] || fail "VPS2 recovery determinism proof missing: $offsite_deterministic"
[[ "$offsite_fingerprint" =~ ^[0-9a-f]{64}$ ]] || fail "VPS2 recovery fingerprint invalid: $offsite_fingerprint"
[[ "$offsite_archives" == 3 ]] || fail "VPS2 offsite archive count mismatch: $offsite_archives"
echo 'PASS: Habbo VPS2 control-plane smoke'
echo "age_seconds=$age timers=5/5 failed_units=0 root_free_kb=$root_free shm_free_kb=$shm_free offsite_store=$offsite_archives/3-deep-bootstrap-deterministic recovery_fingerprint=$offsite_fingerprint latch=clear"

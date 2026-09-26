#!/usr/bin/env bash
set -euo pipefail
umask 077
BROWSER_LOCK=/run/lock/habbo-public-browser-smoke.lock
exec 8>"$BROWSER_LOCK"
flock -w 60 8 || { echo 'FAIL: timed out waiting for Habbo browser smoke lock' >&2; exit 1; }
SMOKE=/usr/local/sbin/habbo-public-webkit-smoke.py
CRED_FILE=/srv/habbo/WEBKIT_SMOKE_LOGIN.env
cred=$(ssh -o BatchMode=yes bridge-old "cat $CRED_FILE")
HABBO_WEBKIT_USER=$(printf '%s\n' "$cred" | awk -F= '$1=="HABBO_WEBKIT_USER" {sub(/^[^=]*=/,""); print; exit}')
HABBO_WEBKIT_PASSWORD=$(printf '%s\n' "$cred" | awk -F= '$1=="HABBO_WEBKIT_PASSWORD" {sub(/^[^=]*=/,""); print; exit}')
[[ -n "$HABBO_WEBKIT_USER" && -n "$HABBO_WEBKIT_PASSWORD" ]] || { echo 'FAIL: WebKit smoke credentials unavailable' >&2; exit 1; }
export HABBO_WEBKIT_USER HABBO_WEBKIT_PASSWORD
unset cred
V31_CONTROL=/srv/habbo/releases/v0.8.5-prod-20260926/bin/v31-control
R39_CONTROL=/srv/habbo/releases/v0.8.5-prod-20260926/bin/r39-control
runtime_healthy(){
  local control=$1
  ssh -o BatchMode=yes bridge-old "${control} status 2>/dev/null || true" | grep -q 'healthy=yes'
}
V31_WAS_HEALTHY=0
R39_WAS_HEALTHY=0
runtime_healthy "$V31_CONTROL" && V31_WAS_HEALTHY=1 || true
runtime_healthy "$R39_CONTROL" && R39_WAS_HEALTHY=1 || true
ERR=$(mktemp /dev/shm/habbo-webkit-smoke.XXXXXX)
cleanup_runtime(){
  local name=$1 control=$2 port=$3 was_healthy=$4
  [[ "$was_healthy" == 0 ]] || return 0
  if ssh -o BatchMode=yes bridge-old "ss -Htn state established '( sport = :$port or dport = :$port )' 2>/dev/null | grep -q ."; then
    echo "WARN: leaving $name runtime running because an active WebSocket connection exists" >&2
    return 0
  fi
  ssh -o BatchMode=yes bridge-old "$control stop" >/dev/null 2>&1 || \
    echo "WARN: failed to stop smoke-owned $name runtime" >&2
}
cleanup(){
  set +e
  cleanup_runtime V31 "$V31_CONTROL" 18131 "$V31_WAS_HEALTHY"
  cleanup_runtime R39 "$R39_CONTROL" 18139 "$R39_WAS_HEALTHY"
  rm -f -- "$ERR"
}
trap cleanup EXIT
attempt=1
while :; do
  : >"$ERR"
  set +e
  OUT=$(/usr/bin/python3 "$SMOKE" 2>"$ERR")
  rc=$?
  set -e
  if [[ "$rc" -eq 0 ]]; then
    break
  fi
  if [[ "$attempt" -eq 1 ]] && grep -Eq 'TargetClosedError|Target page, context or browser has been closed|Page crashed|V31 page failed: status=503|R39 page failed: status=503' "$ERR"; then
    echo 'WARN: transient WebKit browser/runtime startup failure; resetting smoke-owned runtimes and retrying once' >&2
    cleanup_runtime V31 "$V31_CONTROL" 18131 "$V31_WAS_HEALTHY"
    cleanup_runtime R39 "$R39_CONTROL" 18139 "$R39_WAS_HEALTHY"
    attempt=2
    sleep 2
    continue
  fi
  cat "$ERR" >&2
  exit "$rc"
done
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
SUMMARY=$(printf '%s\n' "$OUT" | tail -n 1)
printf 'validated_at_utc=%s\nresult=success\nengine=webkit\ndevice=iPhone 14 Plus\nattempts=%s\nsummary=%s\n' "$now" "$attempt" "$SUMMARY" >/var/backups/habbo-vps1/WEBKIT_STATUS
chmod 600 /var/backups/habbo-vps1/WEBKIT_STATUS
printf 'validated_at_utc=%s\nresult=success\nengine=webkit\ndevice=iPhone 14 Plus\nscenario=home+register+login+me+V31+R39\nattempts=%s\n' "$now" "$attempt" | ssh -o BatchMode=yes bridge-old 'set -e; tmp=/srv/habbo/.WEBKIT_STATUS.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/WEBKIT_STATUS; rm -f /srv/habbo/WEBKIT_FAILED; cp /srv/habbo/WEBKIT_STATUS /run/habbo-webkit-status; chmod 0644 /run/habbo-webkit-status; rm -f /run/habbo-webkit-failed'
printf '%s\n' "$OUT"

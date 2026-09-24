#!/usr/bin/env bash
set -euo pipefail
umask 077
SMOKE=/usr/local/sbin/habbo-public-webkit-smoke.py
ERR=$(mktemp /dev/shm/habbo-webkit-smoke.XXXXXX)
cleanup(){ rm -f -- "$ERR"; }
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
  if [[ "$attempt" -eq 1 ]] && grep -Eq 'TargetClosedError|Target page, context or browser has been closed' "$ERR"; then
    echo 'WARN: transient WebKit TargetClosedError; retrying once' >&2
    attempt=2
    sleep 2
    continue
  fi
  cat "$ERR" >&2
  exit "$rc"
done
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf 'validated_at_utc=%s\nresult=success\nengine=webkit\ndevice=iPhone 14 Plus\nattempts=%s\nsummary=%s\n' "$now" "$attempt" "$OUT" >/var/backups/habbo-vps1/WEBKIT_STATUS
chmod 600 /var/backups/habbo-vps1/WEBKIT_STATUS
printf 'validated_at_utc=%s\nresult=success\nengine=webkit\ndevice=iPhone 14 Plus\nscenario=home+register\nattempts=%s\n' "$now" "$attempt" | ssh -o BatchMode=yes bridge-old 'set -e; tmp=/srv/habbo/.WEBKIT_STATUS.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/WEBKIT_STATUS; rm -f /srv/habbo/WEBKIT_FAILED; cp /srv/habbo/WEBKIT_STATUS /run/habbo-webkit-status; chmod 0644 /run/habbo-webkit-status; rm -f /run/habbo-webkit-failed'
printf '%s\n' "$OUT"
#!/usr/bin/env bash
set -euo pipefail
umask 077
OUT=$(/usr/bin/python3 /usr/local/sbin/habbo-public-webkit-smoke.py)
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
printf 'validated_at_utc=%s\nresult=success\nengine=webkit\ndevice=iPhone 14 Plus\nsummary=%s\n' "$now" "$OUT" >/var/backups/habbo-vps1/WEBKIT_STATUS
chmod 600 /var/backups/habbo-vps1/WEBKIT_STATUS
printf 'validated_at_utc=%s\nresult=success\nengine=webkit\ndevice=iPhone 14 Plus\nscenario=home+register\n' "$now" | ssh -o BatchMode=yes bridge-old 'set -e; tmp=/srv/habbo/.WEBKIT_STATUS.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/WEBKIT_STATUS; rm -f /srv/habbo/WEBKIT_FAILED; cp /srv/habbo/WEBKIT_STATUS /run/habbo-webkit-status; chmod 0644 /run/habbo-webkit-status; rm -f /run/habbo-webkit-failed'
printf '%s\n' "$OUT"
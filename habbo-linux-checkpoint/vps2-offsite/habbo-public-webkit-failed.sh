#!/usr/bin/env bash
set -euo pipefail
umask 077
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
result=$(systemctl show -p Result --value habbo-public-webkit.service 2>/dev/null || echo unknown)
status=$(systemctl show -p ExecMainStatus --value habbo-public-webkit.service 2>/dev/null || echo unknown)
journal=$(journalctl -u habbo-public-webkit.service -n 35 --no-pager 2>/dev/null | tail -35 | tr '\n' '|' | cut -c1-5000)
{
  printf 'failed_at_utc=%s\nresult=%s\nexec_status=%s\n' "$now" "$result" "$status"
  printf 'journal=%s\n' "$journal"
} | ssh -o BatchMode=yes bridge-old 'set -e; tmp=/srv/habbo/.WEBKIT_FAILED.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/WEBKIT_FAILED; cp /srv/habbo/WEBKIT_FAILED /run/habbo-webkit-failed; chmod 0644 /run/habbo-webkit-failed'
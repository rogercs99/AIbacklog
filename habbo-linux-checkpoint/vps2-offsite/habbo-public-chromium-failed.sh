#!/usr/bin/env bash
set -euo pipefail
umask 077
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
result=$(systemctl show -p Result --value habbo-public-chromium.service 2>/dev/null || echo unknown)
status=$(systemctl show -p ExecMainStatus --value habbo-public-chromium.service 2>/dev/null || echo unknown)
journal=$(journalctl -u habbo-public-chromium.service -n 35 --no-pager 2>/dev/null | tail -35 | tr '\n' '|' | cut -c1-5000)
{
  printf 'failed_at_utc=%s\nresult=%s\nexec_status=%s\n' "$now" "$result" "$status"
  printf 'journal=%s\n' "$journal"
} | ssh -o BatchMode=yes bridge-old 'set -e; tmp=/srv/habbo/.CHROMIUM_FAILED.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/CHROMIUM_FAILED; cp /srv/habbo/CHROMIUM_FAILED /run/habbo-chromium-failed; chmod 0644 /run/habbo-chromium-failed'

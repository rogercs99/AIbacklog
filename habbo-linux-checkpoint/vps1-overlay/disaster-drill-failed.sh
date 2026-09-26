#!/usr/bin/env bash
set -u
OUT=/srv/habbo/DISASTER_DRILL_FAILED
{
  printf 'failed_at_utc=%s
' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'unit_result=%s
' "$(systemctl show -p Result --value habbo-disaster-drill.service 2>/dev/null || echo unknown)"
  printf 'exec_status=%s
' "$(systemctl show -p ExecMainStatus --value habbo-disaster-drill.service 2>/dev/null || echo unknown)"
  printf 'latest_backup=%s
' "$(cat /srv/habbo/LATEST_PUBLIC_WEB_BACKUP 2>/dev/null || echo unknown)"
  printf '%s
' '--- recent journal ---'
  journalctl -u habbo-disaster-drill.service --no-pager -n 30 2>/dev/null || true
} >"$OUT"
chmod 0600 "$OUT"
echo "Recorded Habbo disaster drill failure in $OUT"

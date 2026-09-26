#!/usr/bin/env bash
set -u
OUT=/srv/habbo/POSTBOOT_FAILED
{
  printf 'failed_at_utc=%s
' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'unit_result=%s
' "$(systemctl show -p Result --value habbo-postboot-validate.service 2>/dev/null || echo unknown)"
  printf 'exec_status=%s
' "$(systemctl show -p ExecMainStatus --value habbo-postboot-validate.service 2>/dev/null || echo unknown)"
  printf 'latest_backup=%s
' "$(cat /srv/habbo/LATEST_PUBLIC_WEB_BACKUP 2>/dev/null || echo unknown)"
  printf '%s
' '--- recent journal ---'
  journalctl -u habbo-postboot-validate.service --no-pager -n 30 2>/dev/null || true
} >"$OUT"
chmod 0600 "$OUT"
echo "Recorded Habbo postboot validation failure in $OUT"

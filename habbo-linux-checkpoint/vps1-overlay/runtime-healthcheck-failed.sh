#!/usr/bin/env bash
set -u
OUT=/run/habbo-runtime-health.failed
{
  printf 'failed_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf 'unit_result=%s\n' "$(systemctl show -p Result --value habbo-runtime-healthcheck.service 2>/dev/null || echo unknown)"
  printf 'exec_status=%s\n' "$(systemctl show -p ExecMainStatus --value habbo-runtime-healthcheck.service 2>/dev/null || echo unknown)"
  printf 'latest_backup=%s\n' "$(cat /srv/habbo/LATEST_PUBLIC_WEB_BACKUP 2>/dev/null || echo unknown)"
  printf '%s\n' '--- recent journal ---'
  journalctl -u habbo-runtime-healthcheck.service --no-pager -n 30 2>/dev/null || true
} >"$OUT"
chmod 0644 "$OUT"
echo "Recorded Habbo runtime health failure in $OUT"
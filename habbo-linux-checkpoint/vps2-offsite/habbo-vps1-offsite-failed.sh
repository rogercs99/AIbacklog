#!/usr/bin/env bash
set -euo pipefail
umask 077
kind=${1:?kind required}
unit=${2:?unit required}
case "$kind" in
  pull)
    remote=/srv/habbo/OFFSITE_BACKUP_FAILED
    runtime=/run/habbo-offsite-backup-failed
    ;;
  restore)
    remote=/srv/habbo/OFFSITE_RESTORE_DRILL_FAILED
    runtime=/run/habbo-offsite-restore-drill-failed
    ;;
  *) echo "unsupported kind: $kind" >&2; exit 2 ;;
esac
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
result=$(systemctl show -p Result --value "$unit" 2>/dev/null || echo unknown)
status=$(systemctl show -p ExecMainStatus --value "$unit" 2>/dev/null || echo unknown)
journal=$(journalctl -u "$unit" -n 40 --no-pager 2>/dev/null | tail -40 | tr '\n' '|' | cut -c1-6000)
marker=$(mktemp /dev/shm/habbo-offsite-failed.XXXXXX)
trap 'rm -f "$marker"' EXIT
{
  printf 'failed_at_utc=%s\nkind=%s\nunit=%s\nresult=%s\nexec_status=%s\n' "$now" "$kind" "$unit" "$result" "$status"
  printf 'journal=%s\n' "$journal"
} >"$marker"
case "$kind" in
  pull)
    cat "$marker" | ssh -o BatchMode=yes bridge-old 'set -e; tmp=/srv/habbo/.OFFSITE_BACKUP_FAILED.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/OFFSITE_BACKUP_FAILED; cp /srv/habbo/OFFSITE_BACKUP_FAILED /run/habbo-offsite-backup-failed; chmod 0644 /run/habbo-offsite-backup-failed'
    ;;
  restore)
    cat "$marker" | ssh -o BatchMode=yes bridge-old 'set -e; tmp=/srv/habbo/.OFFSITE_RESTORE_DRILL_FAILED.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/OFFSITE_RESTORE_DRILL_FAILED; cp /srv/habbo/OFFSITE_RESTORE_DRILL_FAILED /run/habbo-offsite-restore-drill-failed; chmod 0644 /run/habbo-offsite-restore-drill-failed'
    ;;
esac
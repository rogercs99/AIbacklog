#!/usr/bin/env bash
set -u
ROOT=/srv/habbo
EXPECTED=f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec
ok=true
check(){ local label=$1; shift; if "$@"; then printf '%-28s %s\n' "$label" 'OK'; else printf '%-28s %s\n' "$label" 'FAIL'; ok=false; fi; }

echo 'Habbo deployment status'
echo '-----------------------'
for u in habbo-stack habbo-static habbo-websockify cloudflared-stremio-legacy habbo-postboot-validate; do
  check "$u active" systemctl is-active --quiet "$u"
  check "$u enabled" systemctl is-enabled --quiet "$u"
done
check 'runtime timer active' systemctl is-active --quiet habbo-runtime-healthcheck.timer
check 'runtime timer enabled' systemctl is-enabled --quiet habbo-runtime-healthcheck.timer
check 'daily backup timer active' systemctl is-active --quiet habbo-backup-daily.timer
check 'daily backup timer enabled' systemctl is-enabled --quiet habbo-backup-daily.timer
check 'disaster drill timer active' systemctl is-active --quiet habbo-disaster-drill.timer
check 'disaster drill timer enabled' systemctl is-enabled --quiet habbo-disaster-drill.timer
drill_result=$(systemctl show -p Result --value habbo-disaster-drill.service 2>/dev/null || echo unknown)
[[ "$drill_result" == success ]] || ok=false
printf '%-28s %s\n' 'disaster drill result' "$drill_result"
backup_result=$(systemctl show -p Result --value habbo-backup-daily.service 2>/dev/null || echo unknown)
[[ "$backup_result" == success ]] || ok=false
printf '%-28s %s\n' 'daily backup last result' "$backup_result"
result=$(systemctl show -p Result --value habbo-runtime-healthcheck.service 2>/dev/null || echo unknown)
[[ "$result" == success ]] || ok=false
printf '%-28s %s\n' 'runtime last result' "$result"

bundle="$ROOT/releases/final-v2/habbo-2009-dual-linux-FINAL-v2-20260923.zip"
actual=$(sha256sum "$bundle" 2>/dev/null | awk '{print $1}')
[[ "$actual" == "$EXPECTED" ]] || ok=false
printf '%-28s %s\n' 'FINAL-v2 hash' "$([[ "$actual" == "$EXPECTED" ]] && echo OK || echo FAIL)"
latest=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP" 2>/dev/null || echo missing)
[[ -d "$latest" ]] || ok=false
printf '%-28s %s\n' 'latest backup' "$latest"
if [[ -d "$latest" ]]; then
  backup_age=$(( $(date +%s) - $(stat -c %Y "$latest") ))
else
  backup_age=999999999
fi
[[ "$backup_age" -le 129600 ]] || ok=false
printf '%-28s %ss\n' 'latest backup age' "$backup_age"

stamp_age(){
  local f=$1 ts now
  [[ -f "$f" ]] || { echo missing; return 1; }
  ts=$(awk -F= '$1=="validated_at_utc" {print $2}' "$f")
  [[ -n "$ts" ]] || { echo invalid; return 1; }
  now=$(date -u +%s)
  echo $((now - $(date -u -d "$ts" +%s)))
}
post_age=$(stamp_age /run/habbo-postboot-validated 2>/dev/null || echo missing)
runtime_age=$(stamp_age /run/habbo-runtime-health 2>/dev/null || echo missing)
runtime_backup=$(awk -F= '$1=="latest_backup" {print $2}' /run/habbo-runtime-health 2>/dev/null || true)
[[ "$post_age" =~ ^[0-9]+$ ]] || ok=false
[[ "$runtime_age" =~ ^[0-9]+$ && "$runtime_age" -le 1800 ]] || ok=false
[[ "$runtime_backup" == "$latest" ]] || ok=false
printf '%-28s %ss\n' 'postboot stamp age' "$post_age"
printf '%-28s %ss\n' 'runtime stamp age' "$runtime_age"
if [[ -f /run/habbo-disaster-drill ]]; then
  drill_ts=$(awk -F= '$1=="validated_at_utc" {print $2}' /run/habbo-disaster-drill)
  drill_age=$(( $(date -u +%s) - $(date -u -d "$drill_ts" +%s) ))
else
  drill_age=999999999
fi
[[ "$drill_age" -le 691200 ]] || ok=false
printf '%-28s %ss\n' 'disaster drill age' "$drill_age"
offsite_ok=true
if [[ -f /srv/habbo/OFFSITE_BACKUP_STATUS ]]; then
  offsite_ts=$(awk -F= '$1=="validated_at_utc" {print $2}' /srv/habbo/OFFSITE_BACKUP_STATUS)
  offsite_backup=$(awk -F= '$1=="backup" {print $2}' /srv/habbo/OFFSITE_BACKUP_STATUS)
  offsite_age=$(( $(date -u +%s) - $(date -u -d "$offsite_ts" +%s) ))
else
  offsite_age=999999999
  offsite_backup=missing
  offsite_ok=false
fi
[[ "$offsite_age" -le 129600 ]] || offsite_ok=false
[[ "$offsite_backup" == "$latest" ]] || offsite_ok=false
$offsite_ok || ok=false
printf '%-28s %ss\n' 'offsite backup age' "$offsite_age"
printf '%-28s %s\n' 'offsite latest match' "$([[ "$offsite_backup" == "$latest" ]] && echo OK || echo FAIL)"
offsite_pull_failed=false
[[ -e /srv/habbo/OFFSITE_BACKUP_FAILED ]] && offsite_pull_failed=true
$offsite_pull_failed && ok=false
printf '%-28s %s\n' 'offsite pull failure latch' "$($offsite_pull_failed && echo FAILED || echo clear)"
if [[ -f /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS ]]; then
  osd_ts=$(awk -F= '$1=="validated_at_utc" {print $2}' /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS)
  osd_tables=$(awk -F= '$1=="tables" {print $2}' /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS)
  osd_nav=$(awk -F= '$1=="navigator_styles" {print $2}' /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS)
  osd_user=$(awk -F= '$1=="RogerVideo" {print $2}' /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS)
  osd_room=$(awk -F= '$1=="room1000" {print $2}' /srv/habbo/OFFSITE_RESTORE_DRILL_STATUS)
  osd_age=$(( $(date -u +%s) - $(date -u -d "$osd_ts" +%s) ))
else
  osd_age=999999999; osd_tables=0; osd_nav=0; osd_user=0; osd_room=0
fi
osd_ok=true
[[ "$osd_age" -le 691200 ]] || osd_ok=false
[[ "$osd_tables" == 88 && "$osd_nav" == 40 && "$osd_user" == 1 && "$osd_room" == 1 ]] || osd_ok=false
$osd_ok || ok=false
printf '%-28s %ss\n' 'offsite restore drill age' "$osd_age"
printf '%-28s %s\n' 'offsite restore proof' "$($osd_ok && echo OK || echo FAIL)"
offsite_restore_failed=false
[[ -e /srv/habbo/OFFSITE_RESTORE_DRILL_FAILED ]] && offsite_restore_failed=true
$offsite_restore_failed && ok=false
printf '%-28s %s\n' 'offsite restore fail latch' "$($offsite_restore_failed && echo FAILED || echo clear)"
webkit_ok=true
if [[ -f /srv/habbo/WEBKIT_STATUS ]]; then
  webkit_ts=$(awk -F= '$1=="validated_at_utc" {print $2}' /srv/habbo/WEBKIT_STATUS)
  webkit_result=$(awk -F= '$1=="result" {print $2}' /srv/habbo/WEBKIT_STATUS)
  webkit_age=$(( $(date -u +%s) - $(date -u -d "$webkit_ts" +%s) ))
else
  webkit_age=999999999; webkit_result=missing; webkit_ok=false
fi
[[ "$webkit_age" -le 129600 ]] || webkit_ok=false
[[ "$webkit_result" == success ]] || webkit_ok=false
[[ ! -e /srv/habbo/WEBKIT_FAILED ]] || webkit_ok=false
$webkit_ok || ok=false
printf '%-28s %ss\n' 'WebKit proof age' "$webkit_age"
printf '%-28s %s\n' 'WebKit failure latch' "$([[ -e /srv/habbo/WEBKIT_FAILED ]] && echo FAILED || echo clear)"
printf '%-28s %s\n' 'WebKit iPhone proof' "$($webkit_ok && echo OK || echo FAIL)"
printf '%-28s %s\n' 'runtime backup match' "$([[ "$runtime_backup" == "$latest" ]] && echo OK || echo FAIL)"

if [[ -e /run/habbo-runtime-health.failed ]]; then
  ok=false; latch=FAILED
else
  latch=clear
fi
printf '%-28s %s\n' 'runtime failure latch' "$latch"

metrics=$(curl -fsS --connect-timeout 2 --max-time 4 http://127.0.0.1:20241/metrics 2>/dev/null || true)
ha=$(awk '$1=="cloudflared_tunnel_ha_connections" {print int($2)}' <<<"$metrics" | tail -1)
[[ "$ha" =~ ^[0-9]+$ && "$ha" -ge 2 ]] || ok=false
printf '%-28s %s\n' 'Cloudflare HA connections' "${ha:-missing}"

free_kb=$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')
backup_kb=$(du -sk "$ROOT/backups" | awk '{print $1}')
free_gib=$(awk -v x="$free_kb" 'BEGIN{printf "%.2f",x/1048576}')
backups_mib=$(awk -v x="$backup_kb" 'BEGIN{printf "%.1f",x/1024}')
[[ "$free_kb" -ge 1048576 ]] || ok=false
printf '%-28s %s GiB\n' 'filesystem free' "$free_gib"
printf '%-28s %s MiB\n' 'backup physical usage' "$backups_mib"

habbo=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 8 https://habbo.gamemodai.pro/ 2>/dev/null || echo ERR)
stremio=$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 3 --max-time 8 https://stremio-server.gamemodai.pro/ 2>/dev/null || echo ERR)
[[ "$habbo" == 200 ]] || ok=false
[[ "$stremio" == 307 ]] || ok=false
printf '%-28s %s\n' 'Habbo public HTTP' "$habbo"
printf '%-28s %s\n' 'Stremio public HTTP' "$stremio"

next=$(systemctl list-timers habbo-runtime-healthcheck.timer --all --no-legend 2>/dev/null | awk '{$1=$1; print}' | head -1)
printf '%-28s %s\n' 'runtime timer' "${next:-missing}"

echo '-----------------------'
if $ok; then
  echo 'OVERALL READY'
  exit 0
else
  echo 'OVERALL DEGRADED'
  exit 1
fi
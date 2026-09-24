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
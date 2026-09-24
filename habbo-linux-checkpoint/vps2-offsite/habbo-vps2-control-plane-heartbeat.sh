#!/usr/bin/env bash
set -euo pipefail
umask 077
REMOTE=bridge-old
TIMERS=(habbo-vps1-offsite-pull.timer habbo-vps1-offsite-restore-drill.timer habbo-public-webkit.timer habbo-vps2-control-plane-heartbeat.timer)
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
issues=()
for t in "${TIMERS[@]}"; do
  enabled=$(systemctl is-enabled "$t" 2>/dev/null || true)
  active=$(systemctl is-active "$t" 2>/dev/null || true)
  [[ "$enabled" == enabled ]] || issues+=("$t enabled=$enabled")
  [[ "$active" == active ]] || issues+=("$t active=$active")
done
mapfile -t failed < <(systemctl --failed --no-legend 2>/dev/null | awk '{print $1}' | grep -E '^habbo-(vps1-offsite|public-webkit)' || true)
((${#failed[@]}==0)) || issues+=("failed_units=${failed[*]}")
if ((${#issues[@]}==0)); then
  result=success
  detail='timers=4/4-enabled+active failed_units=0'
else
  result=failed
  detail=$(printf '%s; ' "${issues[@]}")
  detail=${detail%; }
fi
marker=$(mktemp /dev/shm/habbo-vps2-control.XXXXXX)
trap 'rm -f "$marker"' EXIT
printf 'validated_at_utc=%s\nresult=%s\ntimers_total=4\ntimers_healthy=%s\nfailed_units=%s\ndetail=%s\n' \
  "$now" "$result" "$([[ "$result" == success ]] && echo 4 || echo 0)" "${#failed[@]}" "$detail" >"$marker"
if [[ "$result" == success ]]; then
  cat "$marker" | ssh -o BatchMode=yes "$REMOTE" 'set -e; tmp=/srv/habbo/.VPS2_CONTROL_PLANE_STATUS.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/VPS2_CONTROL_PLANE_STATUS; rm -f /srv/habbo/VPS2_CONTROL_PLANE_FAILED; cp /srv/habbo/VPS2_CONTROL_PLANE_STATUS /run/habbo-vps2-control-plane-status; chmod 0644 /run/habbo-vps2-control-plane-status; rm -f /run/habbo-vps2-control-plane-failed'
  echo 'PASS: VPS2 Habbo control-plane heartbeat'
  exit 0
else
  cat "$marker" | ssh -o BatchMode=yes "$REMOTE" 'set -e; tmp=/srv/habbo/.VPS2_CONTROL_PLANE_STATUS.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/VPS2_CONTROL_PLANE_STATUS; cp /srv/habbo/VPS2_CONTROL_PLANE_STATUS /srv/habbo/VPS2_CONTROL_PLANE_FAILED; chmod 600 /srv/habbo/VPS2_CONTROL_PLANE_FAILED; cp /srv/habbo/VPS2_CONTROL_PLANE_FAILED /run/habbo-vps2-control-plane-failed; chmod 0644 /run/habbo-vps2-control-plane-failed'
  echo "FAIL: VPS2 Habbo control plane unhealthy: $detail" >&2
  exit 1
fi
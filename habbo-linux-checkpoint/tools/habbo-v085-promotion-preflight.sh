#!/usr/bin/env bash
set -euo pipefail
REMOTE=${1:-bridge-old}
EXPECTED_HOST=${EXPECTED_HOST:-secureme}
EXPECTED_ARTIFACT_SHA=${EXPECTED_ARTIFACT_SHA:-4fb36dd2daa0f2e7a191a10649859ad7910020793ad29b0378c24f45409b0a4c}
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE")

fail=0
warn=0
ok(){ printf 'OK   %s\n' "$*"; }
warning(){ printf 'WARN %s\n' "$*"; warn=$((warn+1)); }
block(){ printf 'BLOCK %s\n' "$*"; fail=$((fail+1)); }

host=$(${SSH[@]} hostname)
[[ "$host" == "$EXPECTED_HOST" ]] && ok "target host=$host" || block "unexpected target host=$host expected=$EXPECTED_HOST"

root=$(${SSH[@]} 'test -d /srv/habbo && echo present || echo missing')
[[ "$root" == present ]] && ok '/srv/habbo present' || block '/srv/habbo missing'

for unit in habbo-stack habbo-static habbo-websockify cloudflared-stremio-legacy; do
  state=$(${SSH[@]} "systemctl is-active '$unit' 2>/dev/null || true")
  [[ "$state" == active ]] && ok "$unit active" || block "$unit state=$state"
done

http=$(${SSH[@]} "curl -ksS -o /dev/null -w '%{http_code}' --max-time 15 https://habbo.gamemodai.pro/ || true")
[[ "$http" == 200 ]] && ok 'public Habbo HTTP=200' || block "public Habbo HTTP=$http"

latest=$(${SSH[@]} 'cat /srv/habbo/LATEST_PUBLIC_WEB_BACKUP 2>/dev/null || true')
if [[ -n "$latest" ]] && ${SSH[@]} "test -d '$latest'"; then
  ok "latest backup exists: $latest"
else
  block "latest backup missing: ${latest:-unset}"
fi

backup_verify=$(${SSH[@]} '/srv/habbo/ops/verify-latest-backup.sh >/dev/null 2>&1; echo $?' 2>/dev/null || true)
[[ "$backup_verify" == 0 ]] && ok 'latest backup verifier PASS' || block "latest backup verifier rc=${backup_verify:-unknown}"

webkit_failed=$(${SSH[@]} 'test -f /srv/habbo/WEBKIT_FAILED && echo yes || echo no')
if [[ "$webkit_failed" == yes ]]; then
  cause=$(${SSH[@]} "sed -n 's/^journal=//p' /srv/habbo/WEBKIT_FAILED | grep -o 'Navigation failed because page crashed!' | head -1" || true)
  if [[ -n "$cause" ]]; then
    block 'WebKit remote proof latched failed: Playwright WebKit page crash after load'
  else
    block 'WebKit remote proof latched failed'
  fi
else
  ok 'WebKit failure latch clear'
fi

control_result=$(${SSH[@]} "sed -n 's/^result=//p' /srv/habbo/VPS2_CONTROL_PLANE_STATUS 2>/dev/null | head -1" || true)
if [[ "$control_result" == failed ]]; then
  detail=$(${SSH[@]} "sed -n 's/^detail=//p' /srv/habbo/VPS2_CONTROL_PLANE_STATUS 2>/dev/null | head -1" || true)
  if [[ "$detail" == *offsite_store_failed* ]]; then
    block 'VPS2 control plane failed: offsite recovery store drift'
  else
    block "VPS2 control plane failed: ${detail:-no detail}"
  fi
else
  ok "VPS2 control plane result=${control_result:-unknown}"
fi

printf 'INFO canonical local v0.8.5 artifact sha256=%s\n' "$EXPECTED_ARTIFACT_SHA"
printf 'SUMMARY blockers=%d warnings=%d\n' "$fail" "$warn"
if (( fail > 0 )); then
  echo 'PROMOTION_BLOCKED'
  exit 2
fi
echo 'PROMOTION_PREFLIGHT_PASS'

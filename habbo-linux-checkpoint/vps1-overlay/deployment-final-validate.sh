#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
EXPECTED_BUNDLE=f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec
BUNDLE="$ROOT/releases/final-v2/habbo-2009-dual-linux-FINAL-v2-20260923.zip"

for unit in habbo-stack habbo-static habbo-websockify habbo-postboot-validate cloudflared-stremio-legacy; do
  systemctl is-active --quiet "$unit" || { echo "FAIL: inactive unit $unit" >&2; exit 1; }
  systemctl is-enabled --quiet "$unit" || { echo "FAIL: disabled unit $unit" >&2; exit 1; }
done
actual=$(sha256sum "$BUNDLE" | awk '{print $1}')

STAMP=/run/habbo-postboot-validated
[[ -f "$STAMP" ]] || { echo "FAIL: post-boot validation stamp missing" >&2; exit 1; }
grep -q "^bundle_sha256=$EXPECTED_BUNDLE$" "$STAMP" || { echo "FAIL: post-boot validation stamp has wrong bundle hash" >&2; exit 1; }
systemctl is-enabled --quiet habbo-runtime-healthcheck.timer || { echo "FAIL: runtime health timer disabled" >&2; exit 1; }
systemctl is-active --quiet habbo-runtime-healthcheck.timer || { echo "FAIL: runtime health timer inactive" >&2; exit 1; }
[[ "$(systemctl show -p Result --value habbo-runtime-healthcheck.service)" == "success" ]] || { echo "FAIL: last runtime healthcheck did not succeed" >&2; exit 1; }
RSTAMP=/run/habbo-runtime-health
[[ -f "$RSTAMP" ]] || { echo "FAIL: runtime health stamp missing" >&2; exit 1; }
[[ ! -e /run/habbo-runtime-health.failed ]] || { echo "FAIL: unresolved runtime health failure latch present" >&2; exit 1; }
grep -q "^bundle_sha256=$EXPECTED_BUNDLE$" "$RSTAMP" || { echo "FAIL: runtime health stamp has wrong bundle hash" >&2; exit 1; }
rts=$(awk -F= '$1=="validated_at_utc" {print $2}' "$RSTAMP")
[[ -n "$rts" ]] || { echo "FAIL: runtime health timestamp missing" >&2; exit 1; }
rage=$(( $(date -u +%s) - $(date -u -d "$rts" +%s) ))
[[ "$rage" -ge 0 && "$rage" -le 1800 ]] || { echo "FAIL: runtime health stamp is stale (${rage}s)" >&2; exit 1; }
[[ "$actual" == "$EXPECTED_BUNDLE" ]] || { echo "FAIL: FINAL-v2 hash mismatch" >&2; exit 1; }

"$ROOT/ops/smoke-test.sh"
"$ROOT/ops/network-perimeter-smoke.sh"
"$ROOT/ops/cloudflare-ingress-smoke.sh"
"$ROOT/ops/disk-health-smoke.sh"
"$ROOT/ops/public-web-smoke.sh"
"$ROOT/ops/verify-latest-backup.sh"

echo 'PASS: Habbo deployment final validator'
echo "bundle_sha256=$actual"
echo "latest_backup=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")"
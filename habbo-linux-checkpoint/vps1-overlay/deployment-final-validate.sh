#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
EXPECTED_BUNDLE=f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec
BUNDLE="$ROOT/releases/final-v2/habbo-2009-dual-linux-FINAL-v2-20260923.zip"

for unit in habbo-stack habbo-static habbo-websockify habbo-web-v085 habbo-postboot-validate cloudflared-stremio-legacy; do
  systemctl is-active --quiet "$unit" || { echo "FAIL: inactive unit $unit" >&2; exit 1; }
  systemctl is-enabled --quiet "$unit" || { echo "FAIL: disabled unit $unit" >&2; exit 1; }
done
actual=$(sha256sum "$BUNDLE" | awk '{print $1}')

STAMP=/run/habbo-postboot-validated
[[ -f "$STAMP" ]] || { echo "FAIL: post-boot validation stamp missing" >&2; exit 1; }
grep -q "^bundle_sha256=$EXPECTED_BUNDLE$" "$STAMP" || { echo "FAIL: post-boot validation stamp has wrong bundle hash" >&2; exit 1; }
systemctl is-enabled --quiet habbo-disaster-drill.timer || { echo "FAIL: disaster drill timer disabled" >&2; exit 1; }
systemctl is-active --quiet habbo-disaster-drill.timer || { echo "FAIL: disaster drill timer inactive" >&2; exit 1; }
[[ "$(systemctl show -p Result --value habbo-disaster-drill.service)" == "success" ]] || { echo "FAIL: last disaster drill did not succeed" >&2; exit 1; }
DSTAMP=/run/habbo-disaster-drill
[[ -f "$DSTAMP" ]] || { echo "FAIL: disaster drill stamp missing" >&2; exit 1; }
dts=$(awk -F= '$1=="validated_at_utc" {print $2}' "$DSTAMP")
[[ -n "$dts" ]] || { echo "FAIL: disaster drill timestamp missing" >&2; exit 1; }
dage=$(( $(date -u +%s) - $(date -u -d "$dts" +%s) ))
[[ "$dage" -ge 0 && "$dage" -le 691200 ]] || { echo "FAIL: disaster drill stamp stale (${dage}s)" >&2; exit 1; }
drill_backup=$(awk -F= '$1=="backup" {print $2}' "$DSTAMP")
[[ -d "$drill_backup" ]] || { echo "FAIL: disaster drill backup no longer exists" >&2; exit 1; }
systemctl is-enabled --quiet habbo-backup-daily.timer || { echo "FAIL: daily backup timer disabled" >&2; exit 1; }
systemctl is-active --quiet habbo-backup-daily.timer || { echo "FAIL: daily backup timer inactive" >&2; exit 1; }
[[ "$(systemctl show -p Result --value habbo-backup-daily.service)" == "success" ]] || { echo "FAIL: last daily backup service did not succeed" >&2; exit 1; }
LATEST_DIR=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")
LATEST_AGE=$(( $(date +%s) - $(stat -c %Y "$LATEST_DIR") ))
[[ "$LATEST_AGE" -le 129600 ]] || { echo "FAIL: latest backup is stale (${LATEST_AGE}s)" >&2; exit 1; }
systemctl is-enabled --quiet habbo-runtime-healthcheck.timer || { echo "FAIL: runtime health timer disabled" >&2; exit 1; }
systemctl is-active --quiet habbo-runtime-healthcheck.timer || { echo "FAIL: runtime health timer inactive" >&2; exit 1; }
[[ "$(systemctl show -p Result --value habbo-runtime-healthcheck.service)" == "success" ]] || { echo "FAIL: last runtime healthcheck did not succeed" >&2; exit 1; }
RSTAMP=/run/habbo-runtime-health
[[ -f "$RSTAMP" ]] || { echo "FAIL: runtime health stamp missing" >&2; exit 1; }
[[ ! -e /run/habbo-runtime-health.failed ]] || { echo "FAIL: unresolved runtime health failure latch present" >&2; exit 1; }
LATEST=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")
grep -Fxq "latest_backup=$LATEST" "$RSTAMP" || { echo "FAIL: runtime health stamp does not match latest backup" >&2; exit 1; }
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
"$ROOT/ops/backup-publication-smoke.sh"
"$ROOT/ops/db-backup-consistency-smoke.sh"
"$ROOT/ops/secret-permissions-smoke.sh"
"$ROOT/ops/disaster-recovery-source-smoke.sh"
"$ROOT/ops/vps2-control-plane-recovery-smoke.sh"
"$ROOT/ops/offsite-backup-smoke.sh"
"$ROOT/ops/offsite-restore-drill-smoke.sh"
"$ROOT/ops/public-chromium-remote-smoke.sh"
"$ROOT/ops/public-webkit-remote-smoke.sh"
"$ROOT/ops/live-drift-remote-smoke.sh"
"$ROOT/ops/vps2-control-plane-smoke.sh"
"$ROOT/ops/public-web-smoke.sh"
"$ROOT/ops/verify-latest-backup.sh"

echo 'PASS: Habbo deployment final validator'
echo "bundle_sha256=$actual"
echo "latest_backup=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")"

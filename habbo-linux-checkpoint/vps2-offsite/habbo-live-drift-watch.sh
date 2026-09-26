#!/usr/bin/env bash
set -euo pipefail
umask 077
REMOTE=bridge-old
BASELINE=${HABBO_DRIFT_BASELINE_ARCHIVE:-/usr/local/share/habbo-live-drift-baseline.tar.gz}
BASELINE_SHA=${HABBO_DRIFT_BASELINE_SHA:-${BASELINE}.sha256}
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$BASELINE" ]] || fail "drift baseline missing: $BASELINE"
[[ -f "$BASELINE_SHA" ]] || fail "drift baseline sidecar missing: $BASELINE_SHA"
[[ "$(stat -c '%a %U:%G' "$BASELINE")" == '600 root:root' ]] || fail 'drift baseline permissions invalid'
[[ "$(stat -c '%a %U:%G' "$BASELINE_SHA")" == '600 root:root' ]] || fail 'drift baseline sidecar permissions invalid'
(
  cd "$(dirname "$BASELINE")"
  sha256sum -c "$(basename "$BASELINE_SHA")" --status
) || fail 'drift baseline SHA256 mismatch'
gzip -t "$BASELINE" || fail 'drift baseline gzip invalid'
/usr/local/sbin/habbo-offsite-tar-safety.py --nested "$BASELINE" >/dev/null || fail 'drift baseline structural safety failed'
work=$(mktemp -d /dev/shm/habbo-live-drift-watch.XXXXXX)
cleanup(){ rm -rf -- "$work"; }
trap cleanup EXIT
tar -xzf "$BASELINE" -C "$work"
auditor="$work/habbo-linux-checkpoint/tools/habbo-live-drift-audit.sh"
release_manifest="$work/habbo-linux-checkpoint/drift-baseline/release-v085-critical-sha256.txt"
[[ -x "$auditor" ]] || fail 'drift baseline auditor missing/not executable'
[[ -f "$release_manifest" ]] || fail 'release drift manifest missing from baseline'
[[ "$(wc -l < "$release_manifest")" -eq 14 ]] || fail 'release drift manifest must contain 14 files'
audit_out=''
if ! audit_out=$(HABBO_DRIFT_BASELINE_ROOT="$work" "$auditor" 2>&1); then
  printf '%s\n' "$audit_out" >&2
  fail 'tracked operational drift detected'
fi
printf '%s\n' "$audit_out"
if ! ssh -o BatchMode=yes "$REMOTE" 'sha256sum -c - --status' <"$release_manifest"; then
  fail 'promoted v0.8.5 release drift detected'
fi
baseline_sha=$(sha256sum "$BASELINE" | awk '{print $1}')
tracked_summary=$(awk '/^SUMMARY /{line=$0} END{print line}' <<<"$audit_out")
[[ "$baseline_sha" =~ ^[0-9a-f]{64}$ ]] || fail 'invalid baseline SHA'
[[ -n "$tracked_summary" ]] || fail 'tracked audit summary missing'
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
marker=$(mktemp /dev/shm/habbo-live-drift-status.XXXXXX)
{
  printf 'validated_at_utc=%s
' "$now"
  printf 'result=success
'
  printf 'baseline_sha256=%s
' "$baseline_sha"
  printf 'release_files=14
'
  printf 'release_verified=1
'
  printf 'tracked_summary=%s
' "$tracked_summary"
} >"$marker"
install -m 600 "$marker" /var/backups/habbo-vps1/LIVE_DRIFT_STATUS
cat "$marker" | ssh -o BatchMode=yes "$REMOTE" 'set -e; tmp=/srv/habbo/.LIVE_DRIFT_STATUS.tmp; cat >"$tmp"; chmod 600 "$tmp"; mv "$tmp" /srv/habbo/LIVE_DRIFT_STATUS; rm -f /srv/habbo/LIVE_DRIFT_FAILED; cp /srv/habbo/LIVE_DRIFT_STATUS /run/habbo-live-drift-status; chmod 0644 /run/habbo-live-drift-status; rm -f /run/habbo-live-drift-failed'
rm -f "$marker"
echo 'PASS: Habbo autonomous live drift watch'
echo "baseline_sha256=$baseline_sha release_files=14 release_verified=1 $tracked_summary"

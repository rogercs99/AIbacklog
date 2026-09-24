#!/usr/bin/env bash
set -euo pipefail
ROOT=/var/backups/habbo-vps1
LOCK=/run/lock/habbo-vps1-offsite.lock
EXPECTED=3
LOCK_WAIT=${LOCK_WAIT:-45}
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -d "$ROOT" ]] || fail 'offsite store missing'
[[ "$(stat -c '%a %U:%G' "$ROOT")" == '700 root:root' ]] || fail 'offsite store permissions invalid'
exec 7>"$LOCK"
flock -w "$LOCK_WAIT" 7 || fail "offsite lock unavailable after ${LOCK_WAIT}s"
[[ -f "$ROOT/LATEST" ]] || fail 'offsite LATEST missing'
[[ "$(stat -c '%a %U:%G' "$ROOT/LATEST")" == '600 root:root' ]] || fail 'offsite LATEST permissions invalid'
latest=$(cat "$ROOT/LATEST")
[[ "$latest" =~ ^/var/backups/habbo-vps1/manual-[0-9]{8}T[0-9]{6}Z\.tar\.gz$ ]] || fail "offsite LATEST malformed: $latest"
[[ -f "$latest" && -f "$latest.sha256" ]] || fail 'offsite LATEST archive/sidecar missing'
mapfile -t archives < <(find "$ROOT" -maxdepth 1 -type f -name 'manual-*.tar.gz' -printf '%p\n' | sort)
[[ "${#archives[@]}" -eq "$EXPECTED" ]] || fail "offsite archive count mismatch: ${#archives[@]} (expected $EXPECTED)"
for f in "${archives[@]}"; do
  [[ "$f" =~ ^/var/backups/habbo-vps1/manual-[0-9]{8}T[0-9]{6}Z\.tar\.gz$ ]] || fail "invalid archive path: $f"
  side="$f.sha256"
  [[ -f "$side" ]] || fail "checksum sidecar missing: $side"
  [[ "$(stat -c '%a %U:%G' "$f")" == '600 root:root' ]] || fail "archive permissions invalid: $f"
  [[ "$(stat -c '%a %U:%G' "$side")" == '600 root:root' ]] || fail "sidecar permissions invalid: $side"
  [[ "$(stat -c %s "$f")" -gt 1048576 ]] || fail "archive unexpectedly small: $f"
  read -r expected path <"$side"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || fail "invalid SHA in sidecar: $side"
  [[ "$path" == "$f" ]] || fail "sidecar path mismatch: $side"
  sha256sum -c "$side" --status || fail "archive SHA mismatch: $f"
  gzip -t "$f" || fail "archive gzip integrity failure: $f"
done
if find "$ROOT" -maxdepth 1 -type f \( -name '.*.tmp' -o -name '*.partial' -o -name '*.tmp' \) -print -quit | grep -q .; then
  fail 'temporary offsite file residue found'
fi
latest_name=${latest##*/}
newest=${archives[-1]##*/}
[[ "$latest_name" == "$newest" ]] || fail "LATEST is not newest archive: $latest_name vs $newest"
echo 'PASS: Habbo VPS1 offsite store smoke'
echo "archives=${#archives[@]} latest=$latest_name integrity=sha256+gzip permissions=private temp_residue=0"
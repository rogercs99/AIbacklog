#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
EXPECTED_FINAL=f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec
EXPECTED_COMMIT=b550f00f27788145d26723fd19e943aa63504a63
EXPECTED_BUNDLE=77672bee2a6b8f879aa8cb0acbac41b7bc203b4487e1464ebacbc1848564bcb5
EXPECTED_MARIADB_DIGEST='mariadb@sha256:2d50fe0f77dac919396091e527e5e148a9de690e58f32875f113bef6506a17f5'
fail(){ echo "FAIL: $*" >&2; exit 1; }
sha(){ sha256sum "$1" | awk '{print $1}'; }

final="$ROOT/releases/final-v2/habbo-2009-dual-linux-FINAL-v2-20260923.zip"
bundle="$ROOT/releases/disaster/havana-source-b550f00.bundle"
[[ -f "$ROOT/DISASTER_RECOVERY_MANIFEST.md" ]] || fail 'disaster recovery manifest missing'
[[ "$(sha "$final")" == "$EXPECTED_FINAL" ]] || fail 'FINAL-v2 hash mismatch'
[[ "$(sha "$bundle")" == "$EXPECTED_BUNDLE" ]] || fail 'Havana source bundle hash mismatch'
git bundle list-heads "$bundle" | grep "^$EXPECTED_COMMIT " >/dev/null || fail 'Havana bundle commit mismatch'
[[ "$(git -C "$ROOT/Havana" rev-parse HEAD)" == "$EXPECTED_COMMIT" ]] || fail 'live Havana checkout commit mismatch'
[[ -z "$(git -C "$ROOT/Havana" status --porcelain)" ]] || fail 'live Havana checkout is dirty'

digests=$(docker image inspect mariadb:11.5.2 --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null || true)
grep -Fxq "$EXPECTED_MARIADB_DIGEST" <<<"$digests" || fail 'MariaDB image digest mismatch/missing'

latest=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")
for f in \
  DISASTER_RECOVERY_MANIFEST.md \
  havana-source-b550f00.bundle \
  habbo-library-chunks-sha256.txt \
  habbo-runtime-prefix-parts-sha256.txt \
  habbo-2009-dual-linux-FINAL-v2-20260923.zip
 do
  [[ -f "$latest/$f" ]] || fail "latest backup missing disaster source: $f"
 done
[[ "$(sha "$latest/habbo-2009-dual-linux-FINAL-v2-20260923.zip")" == "$EXPECTED_FINAL" ]] || fail 'backed-up FINAL-v2 hash mismatch'
[[ "$(sha "$latest/havana-source-b550f00.bundle")" == "$EXPECTED_BUNDLE" ]] || fail 'backed-up Havana bundle hash mismatch'

echo 'PASS: Habbo disaster recovery source smoke'
echo 'final_v2=verified havana_bundle=verified havana_checkout=clean mariadb_digest=pinned library_assets=manifested'
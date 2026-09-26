#!/usr/bin/env bash
set -euo pipefail
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
OUT=${1:-/tmp/habbo-live-drift-baseline.tar.gz}
cd "$ROOT"
[[ -f habbo-linux-checkpoint/drift-baseline/release-v085-critical-sha256.txt ]] || { echo 'FAIL: release drift manifest missing' >&2; exit 1; }
list=$(mktemp)
tmp=''
cleanup(){ rm -f "$list"; [[ -z "$tmp" ]] || rm -f "$tmp"; }
trap cleanup EXIT
git ls-files -z \
  habbo-linux-checkpoint/vps1-overlay \
  habbo-linux-checkpoint/vps2-offsite \
  habbo-linux-checkpoint/tools/habbo-live-drift-audit.sh \
  habbo-linux-checkpoint/drift-baseline/release-v085-critical-sha256.txt \
  | grep -zv 'vps2-control-plane-files-sha256.txt$' >"$list"
[[ -s "$list" ]] || { echo 'FAIL: empty drift baseline inventory' >&2; exit 1; }
tmp=${OUT}.tmp.$$
rm -f "$tmp"
tar --null -T "$list" --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -cf - | gzip -n >"$tmp"
gzip -t "$tmp"
if tar -tzf "$tmp" | grep -F 'v31-web-touch-lab.sh' >/dev/null; then echo 'FAIL: historical untracked lab file entered baseline' >&2; exit 1; fi
for required in \
  habbo-linux-checkpoint/tools/habbo-live-drift-audit.sh \
  habbo-linux-checkpoint/vps1-overlay/habbo-web-v085.service \
  habbo-linux-checkpoint/vps1-overlay/cloudflared-v085-habbo-ingress.yml \
  habbo-linux-checkpoint/vps2-offsite/habbo-vps2-control-plane-heartbeat.sh \
  habbo-linux-checkpoint/drift-baseline/release-v085-critical-sha256.txt; do
  tar -tzf "$tmp" | grep -Fx "$required" >/dev/null || { echo "FAIL: baseline missing $required" >&2; exit 1; }
done
mv "$tmp" "$OUT"
tmp=''
chmod 600 "$OUT"
sidecar="${OUT}.sha256"
sha=$(sha256sum "$OUT" | awk '{print $1}')
printf '%s  %s\n' "$sha" "$(basename "$OUT")" >"$sidecar"
chmod 600 "$sidecar"
(
  cd "$(dirname "$OUT")"
  sha256sum -c "$(basename "$sidecar")" --status
)
echo 'PASS: Habbo live drift baseline built'
echo "files=$(tar -tzf "$OUT" | wc -l) sha256=$sha output=$OUT sidecar=$sidecar"

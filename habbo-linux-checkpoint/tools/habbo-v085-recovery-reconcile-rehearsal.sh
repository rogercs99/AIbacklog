#!/usr/bin/env bash
set -euo pipefail
ROOT=${ROOT:-/var/backups/habbo-vps1}
LATEST_FILE=${LATEST_FILE:-$ROOT/LATEST}
STORE_SMOKE=${STORE_SMOKE:-/usr/local/sbin/habbo-vps1-offsite-store-smoke.sh}
SAFETY=${SAFETY:-/usr/local/sbin/habbo-offsite-tar-safety.py}
BASE=$(mktemp -d /dev/shm/habbo-v085-reconcile.XXXXXX)
trap 'rm -rf -- "$BASE"' EXIT
mkdir -p "$BASE/extracted" "$BASE/root" "$BASE/kit"
source_archive=$(cat "$LATEST_FILE")
[[ -f "$source_archive" ]] || { echo "FAIL: source archive missing: $source_archive" >&2; exit 1; }
tar -xzf "$source_archive" -C "$BASE/extracted"
tar -xzf "$BASE/extracted/vps2-control-plane-overlay.tar.gz" -C "$BASE/kit"
for f in habbo-public-webkit-daily.sh habbo-public-webkit-smoke.py; do
  src="/usr/local/sbin/$f"
  dst="$BASE/kit/usr/local/sbin/$f"
  install -m "$(stat -c %a "$src")" "$src" "$dst"
done
python3 - "$BASE/extracted/vps2-control-plane-files-sha256.txt" <<'PY'
from pathlib import Path
import hashlib, sys
p=Path(sys.argv[1])
repl={
 'usr/local/sbin/habbo-public-webkit-daily.sh':'/usr/local/sbin/habbo-public-webkit-daily.sh',
 'usr/local/sbin/habbo-public-webkit-smoke.py':'/usr/local/sbin/habbo-public-webkit-smoke.py',
}
out=[]
for line in p.read_text().splitlines():
    h,path=line.split(None,1); path=path.strip()
    if path in repl:
        h=hashlib.sha256(Path(repl[path]).read_bytes()).hexdigest()
    out.append(f'{h}  {path}')
p.write_text('\n'.join(out)+'\n')
PY
rm -f "$BASE/extracted/vps2-control-plane-overlay.tar.gz"
(
  cd "$BASE/kit"
  find etc usr -type f -print0 | sort -z | tar --null -T - -czf "$BASE/extracted/vps2-control-plane-overlay.tar.gz"
)
"$SAFETY" --nested "$BASE/extracted/vps2-control-plane-overlay.tar.gz" >/dev/null
(
  cd "$BASE/extracted"
  find . -maxdepth 1 -type f ! -name SHA256SUMS -printf '%f\n' | sort | while read -r f; do sha256sum "$f"; done > SHA256SUMS
)
candidate="$BASE/root/${source_archive##*/}"
(
  cd "$BASE/extracted"
  find . -maxdepth 1 -type f -printf '%f\n' | sort | tar -T - -czf "$candidate"
)
sha=$(sha256sum "$candidate" | awk '{print $1}')
printf '%s  %s\n' "$sha" "$candidate" > "$candidate.sha256"
printf '%s\n' "$candidate" > "$BASE/root/LATEST"
chmod 700 "$BASE/root"
chmod 600 "$BASE/root/LATEST" "$candidate" "$candidate.sha256"
cp "$STORE_SMOKE" "$BASE/store-smoke-one.sh"
sed -i 's/^EXPECTED=3$/EXPECTED=1/' "$BASE/store-smoke-one.sh"
chmod +x "$BASE/store-smoke-one.sh"
ROOT="$BASE/root" LOCK="$BASE/lock" LOCK_WAIT=1 "$BASE/store-smoke-one.sh"
echo "PASS: v0.8.5 recovery reconciliation rehearsal source=${source_archive##*/} candidate_sha256=$sha"

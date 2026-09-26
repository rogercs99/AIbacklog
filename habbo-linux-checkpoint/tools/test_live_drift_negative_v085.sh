#!/usr/bin/env bash
set -euo pipefail

BASELINE=${1:-/usr/local/share/habbo-live-drift-baseline.tar.gz}
[[ -f "$BASELINE" ]] || { echo "FAIL: baseline missing: $BASELINE" >&2; exit 1; }
gzip -t "$BASELINE"

work=$(mktemp -d /dev/shm/habbo-live-drift-negative.XXXXXX)
cleanup(){ rm -rf -- "$work"; }
trap cleanup EXIT

tar -xzf "$BASELINE" -C "$work"
auditor="$work/habbo-linux-checkpoint/tools/habbo-live-drift-audit.sh"
target_rel='habbo-linux-checkpoint/vps2-offsite/habbo-public-webkit.timer'
target="$work/$target_rel"
[[ -x "$auditor" ]] || { echo 'FAIL: baseline auditor missing/not executable' >&2; exit 1; }
[[ -f "$target" ]] || { echo "FAIL: mutation target missing: $target_rel" >&2; exit 1; }

clean_out=$(HABBO_DRIFT_BASELINE_ROOT="$work" "$auditor")
grep -Eq '^SUMMARY matches=[0-9]+ drifts=0 missing=0 notes=0$' <<<"$clean_out" || {
  printf '%s\n' "$clean_out" >&2
  echo 'FAIL: clean extracted baseline did not pass' >&2
  exit 1
}

printf '\n# isolated-negative-proof\n' >>"$target"
set +e
mutated_out=$(HABBO_DRIFT_BASELINE_ROOT="$work" "$auditor" 2>&1)
rc=$?
set -e
[[ "$rc" -ne 0 ]] || {
  printf '%s\n' "$mutated_out" >&2
  echo 'FAIL: mutated baseline unexpectedly passed' >&2
  exit 1
}
grep -Fq 'DRIFT VPS2 habbo-public-webkit.timer ' <<<"$mutated_out" || {
  printf '%s\n' "$mutated_out" >&2
  echo 'FAIL: expected WebKit timer drift was not reported' >&2
  exit 1
}
grep -Eq '^SUMMARY matches=[0-9]+ drifts=1 missing=0 notes=0$' <<<"$mutated_out" || {
  printf '%s\n' "$mutated_out" >&2
  echo 'FAIL: mutated baseline summary was unexpected' >&2
  exit 1
}

release_manifest="$work/habbo-linux-checkpoint/drift-baseline/release-v085-critical-sha256.txt"
[[ -f "$release_manifest" ]] || { echo 'FAIL: release drift manifest missing from extracted baseline' >&2; exit 1; }
ssh -o BatchMode=yes bridge-old 'sha256sum -c - --status' <"$release_manifest" || {
  echo 'FAIL: clean release manifest did not verify' >&2
  exit 1
}
mutated_manifest="$work/release-v085-mutated.txt"
cp "$release_manifest" "$mutated_manifest"
python3 - "$mutated_manifest" <<'PY2'
from pathlib import Path
import sys
p=Path(sys.argv[1])
lines=p.read_text().splitlines()
h,path=lines[0].split(None,1)
lines[0]=('0' if h[0] != '0' else '1') + h[1:] + '  ' + path.strip()
p.write_text('\n'.join(lines)+'\n')
PY2
set +e
ssh -o BatchMode=yes bridge-old 'sha256sum -c - --status' <"$mutated_manifest"
release_rc=$?
set -e
[[ "$release_rc" -ne 0 ]] || {
  echo 'FAIL: mutated release manifest unexpectedly passed' >&2
  exit 1
}

echo 'PASS: Habbo live drift negative-path regression'
echo 'operational_clean=drifts:0 operational_mutated=drifts:1 release_clean=pass release_mutated=fail persistent_state=untouched'

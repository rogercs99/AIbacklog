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

echo 'PASS: Habbo live drift negative-path regression'
echo 'clean=drifts:0 mutated=drifts:1 target=habbo-public-webkit.timer persistent_state=untouched'

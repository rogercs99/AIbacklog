#!/usr/bin/env bash
set -euo pipefail
ROOT=${ROOT:-/var/backups/habbo-vps1}
LOCK=${LOCK:-/run/lock/habbo-vps1-offsite.lock}
EXPECTED=3
LOCK_WAIT=${LOCK_WAIT:-45}
fail(){ echo "FAIL: $*" >&2; exit 1; }
current_work=
cleanup_work(){ if [[ -n "${current_work:-}" ]]; then rm -rf -- "$current_work"; fi; return 0; }
trap cleanup_work EXIT
[[ -d "$ROOT" ]] || fail 'offsite store missing'
[[ "$(stat -c '%a %U:%G' "$ROOT")" == '700 root:root' ]] || fail 'offsite store permissions invalid'
exec 7>"$LOCK"
flock -w "$LOCK_WAIT" 7 || fail "offsite lock unavailable after ${LOCK_WAIT}s"
[[ -f "$ROOT/LATEST" ]] || fail 'offsite LATEST missing'
[[ "$(stat -c '%a %U:%G' "$ROOT/LATEST")" == '600 root:root' ]] || fail 'offsite LATEST permissions invalid'
latest=$(cat "$ROOT/LATEST")
latest_name=${latest##*/}
[[ "${latest%/*}" == "$ROOT" && "$latest_name" =~ ^manual-[0-9]{8}T[0-9]{6}Z\.tar\.gz$ ]] || fail "offsite LATEST malformed: $latest"
[[ -f "$latest" && -f "$latest.sha256" ]] || fail 'offsite LATEST archive/sidecar missing'
mapfile -t archives < <(find "$ROOT" -maxdepth 1 -type f -name 'manual-*.tar.gz' -printf '%p\n' | sort)
[[ "${#archives[@]}" -eq "$EXPECTED" ]] || fail "offsite archive count mismatch: ${#archives[@]} (expected $EXPECTED)"
for f in "${archives[@]}"; do
  archive_name=${f##*/}
  [[ "${f%/*}" == "$ROOT" && "$archive_name" =~ ^manual-[0-9]{8}T[0-9]{6}Z\.tar\.gz$ ]] || fail "invalid archive path: $f"
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

  work=$(mktemp -d /dev/shm/habbo-offsite-store-scrub.XXXXXX)
  current_work=$work
  tar -xzf "$f" -C "$work" || { rm -rf "$work"; fail "archive extraction failure: $f"; }
  [[ -f "$work/SHA256SUMS" ]] || { rm -rf "$work"; fail "internal SHA256SUMS missing: $f"; }
  (cd "$work" && sha256sum -c SHA256SUMS --status) || { rm -rf "$work"; fail "internal manifest verification failed: $f"; }
  find "$work" -maxdepth 1 -mindepth 1 -type f ! -name SHA256SUMS ! -name .actual-files ! -name .manifest-files -printf '%f\n' | sort >"$work/.actual-files"
  awk '{print $2}' "$work/SHA256SUMS" | sed 's#^\./##' | sort >"$work/.manifest-files"
  cmp -s "$work/.actual-files" "$work/.manifest-files" || { rm -rf "$work"; fail "internal manifest coverage mismatch: $f"; }
  grep -Fxq '.env' "$work/.manifest-files" || { rm -rf "$work"; fail ".env missing from internal manifest: $f"; }
  for critical in .env DISASTER_RECOVERY_MANIFEST.md PROJECT_CONTEXT.md docker-compose.yml havana.sql.gz ops-overlay.tar.gz habbo-2009-dual-linux-FINAL-v2-20260923.zip; do
    [[ -f "$work/$critical" ]] || { rm -rf "$work"; fail "critical internal file missing ($critical): $f"; }
  done
  [[ "$(stat -c '%a' "$work/.env")" == 600 ]] || { rm -rf "$work"; fail "internal .env permissions invalid: $f"; }
  echo 'f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec  '"$work"'/habbo-2009-dual-linux-FINAL-v2-20260923.zip' | sha256sum -c - --status || { rm -rf "$work"; fail "internal FINAL-v2 hash mismatch: $f"; }
  gzip -t "$work/havana.sql.gz" || { rm -rf "$work"; fail "internal DB dump gzip failure: $f"; }
  tar -tzf "$work/ops-overlay.tar.gz" >/dev/null || { rm -rf "$work"; fail "internal ops overlay unreadable: $f"; }
  [[ -f "$work/vps2-control-plane-overlay.tar.gz" ]] || { rm -rf "$work"; fail "VPS2 recovery overlay missing inside backup: $f"; }
  [[ -f "$work/vps2-control-plane-files-sha256.txt" ]] || { rm -rf "$work"; fail "VPS2 recovery manifest missing inside backup: $f"; }
  [[ "$(wc -l < "$work/vps2-control-plane-files-sha256.txt")" -eq 21 ]] || { rm -rf "$work"; fail "VPS2 recovery manifest file count mismatch: $f"; }
  (cd / && sha256sum -c "$work/vps2-control-plane-files-sha256.txt" --status) || { rm -rf "$work"; fail "VPS2 recovery kit drift from live control plane: $f"; }
  kit="$work/.vps2-kit"
  install -d -m 700 "$kit"
  tar -xzf "$work/vps2-control-plane-overlay.tar.gz" -C "$kit" || { rm -rf "$work"; fail "VPS2 recovery overlay extraction failed: $f"; }
  (cd "$kit" && sha256sum -c "$work/vps2-control-plane-files-sha256.txt" --status) || { rm -rf "$work"; fail "VPS2 recovery kit hash verification failed: $f"; }
  kit_tar_digest=$(tar -tzf "$work/vps2-control-plane-overlay.tar.gz" | sed 's#^\./##' | sort | sha256sum | awk '{print $1}')
  kit_manifest_digest=$(awk '{print $2}' "$work/vps2-control-plane-files-sha256.txt" | sed 's#^\./##' | sort | sha256sum | awk '{print $1}')
  [[ "$kit_tar_digest" == "$kit_manifest_digest" ]] || { rm -rf "$work"; fail "VPS2 recovery kit inventory mismatch: $f"; }
  mapfile -t kit_scripts < <(find "$kit/usr/local/sbin" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
  mapfile -t kit_units < <(find "$kit/etc/systemd/system" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
  [[ "${#kit_scripts[@]}" -eq 9 ]] || { rm -rf "$work"; fail "VPS2 recovery script count mismatch (${#kit_scripts[@]}): $f"; }
  [[ "${#kit_units[@]}" -eq 12 ]] || { rm -rf "$work"; fail "VPS2 recovery unit count mismatch (${#kit_units[@]}): $f"; }
  for sf in "${kit_scripts[@]}"; do
    case "$sf" in
      *.sh) bash -n "$sf" || { rm -rf "$work"; fail "VPS2 recovery Bash syntax invalid (${sf#$kit/}): $f"; } ;;&
      *.py) python3 - "$sf" <<'PYKIT'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
compile(p.read_text(encoding='utf-8'), str(p), 'exec')
PYKIT
        ;;
    esac
  done
  for unit in "$kit"/etc/systemd/system/*.service; do
    while IFS= read -r cmd; do
      [[ -n "$cmd" ]] || continue
      cmd=${cmd#-}; cmd=${cmd#+}; cmd=${cmd#!}; cmd=${cmd#@}
      exe=${cmd%% *}
      case "$exe" in
        /usr/local/sbin/habbo-*) [[ -f "$kit$exe" ]] || { rm -rf "$work"; fail "VPS2 recovery unit ${unit##*/} references missing $exe: $f"; } ;;&
      esac
    done < <(sed -n 's/^ExecStart=//p' "$unit")
  done
  for timer in "$kit"/etc/systemd/system/*.timer; do
    target=$(sed -n 's/^Unit=//p' "$timer" | tail -1)
    if [[ -z "$target" ]]; then target=${timer##*/}; target=${target%.timer}.service; fi
    [[ -f "$kit/etc/systemd/system/$target" ]] || { rm -rf "$work"; fail "VPS2 recovery timer ${timer##*/} references missing $target: $f"; }
  done
  for required in \
    usr/local/sbin/habbo-vps1-offsite-pull.sh \
    usr/local/sbin/habbo-vps1-offsite-restore-drill.sh \
    usr/local/sbin/habbo-vps2-control-plane-heartbeat.sh \
    usr/local/sbin/habbo-public-webkit-smoke.py \
    etc/systemd/system/habbo-vps1-offsite-pull.timer \
    etc/systemd/system/habbo-vps1-offsite-restore-drill.timer \
    etc/systemd/system/habbo-public-webkit.timer \
    etc/systemd/system/habbo-vps2-control-plane-heartbeat.timer; do
    [[ -f "$kit/$required" ]] || { rm -rf "$work"; fail "required VPS2 recovery artifact missing ($required): $f"; }
  done
  rm -rf "$work"
  current_work=
done
if find "$ROOT" -maxdepth 1 -type f \( -name '.*.tmp' -o -name '*.partial' -o -name '*.tmp' \) -print -quit | grep -q .; then
  fail 'temporary offsite file residue found'
fi
newest=${archives[-1]##*/}
[[ "$latest_name" == "$newest" ]] || fail "LATEST is not newest archive: $latest_name vs $newest"
echo 'PASS: Habbo VPS1 offsite store smoke'
echo "archives=${#archives[@]} latest=$latest_name integrity=external-sha256+gzip+internal-manifest-full critical=verified vps2-recovery=semantic+live permissions=private temp_residue=0"
#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
SRC=${1:-$ROOT/releases/disaster}
OVERLAY=$SRC/vps2-control-plane-overlay.tar.gz
MANIFEST=$SRC/vps2-control-plane-files-sha256.txt
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ -f "$OVERLAY" ]] || fail 'VPS2 control-plane recovery overlay missing'
[[ -f "$MANIFEST" ]] || fail 'VPS2 control-plane recovery manifest missing'
[[ "$(wc -l < "$MANIFEST")" -eq 23 ]] || fail 'VPS2 control-plane manifest must contain 23 files'
[[ "$(stat -c '%a %U:%G' "$OVERLAY")" == '600 root:root' ]] || fail 'VPS2 recovery overlay permissions invalid'
[[ "$(stat -c '%a %U:%G' "$MANIFEST")" == '600 root:root' ]] || fail 'VPS2 recovery manifest permissions invalid'
work=$(mktemp -d /dev/shm/habbo-vps2-recovery.XXXXXX)
cleanup(){ rm -rf -- "$work"; }
trap cleanup EXIT
python3 - "$OVERLAY" <<'PYSAFE'
import os,posixpath,sys,tarfile
f=sys.argv[1]
try:
    with tarfile.open(f,'r:gz') as t: members=t.getmembers()
except Exception as e: raise SystemExit(f'unsafe recovery overlay: {e}')
if not (1 <= len(members) <= 128): raise SystemExit('unsafe recovery overlay member count')
seen=set(); total=0
for m in members:
    n=m.name
    if not n or n.startswith('/') or '\\' in n: raise SystemExit('unsafe recovery overlay member name')
    parts=[p for p in n.split('/') if p not in ('','.') ]
    if any(p=='..' for p in parts): raise SystemExit('recovery overlay path traversal')
    norm=posixpath.normpath(n)
    if norm in seen: raise SystemExit('duplicate recovery overlay member')
    seen.add(norm)
    if not m.isfile(): raise SystemExit('non-regular recovery overlay member')
    if m.size < 0 or m.size > 16*1024*1024: raise SystemExit('oversized recovery overlay member')
    total += m.size
    if total > 64*1024*1024: raise SystemExit('oversized recovery overlay total')
PYSAFE
tar -xzf "$OVERLAY" -C "$work" || fail 'VPS2 recovery overlay extraction failed'
(cd "$work" && sha256sum -c "$MANIFEST" --status) || fail 'VPS2 recovery file hash verification failed'
tar_digest=$(tar -tzf "$OVERLAY" | sed 's#^\./##' | sort | sha256sum | awk '{print $1}')
manifest_digest=$(awk '{print $2}' "$MANIFEST" | sed 's#^\./##' | sort | sha256sum | awk '{print $1}')
[[ "$tar_digest" == "$manifest_digest" ]] || fail 'VPS2 recovery overlay inventory differs from manifest'
mapfile -t scripts < <(find "$work/usr/local/sbin" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
mapfile -t units < <(find "$work/etc/systemd/system" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
[[ "${#scripts[@]}" -eq 11 ]] || fail "VPS2 recovery script count mismatch: ${#scripts[@]}"
[[ "${#units[@]}" -eq 12 ]] || fail "VPS2 recovery unit count mismatch: ${#units[@]}"
for f in "${scripts[@]}"; do
  case "$f" in
    *.sh) bash -n "$f" || fail "Bash syntax invalid: ${f#$work/}" ;;
    *.py) python3 - "$f" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
compile(p.read_text(encoding='utf-8'), str(p), 'exec')
PY
      ;;
  esac
done
for unit in "$work"/etc/systemd/system/*.service; do
  while IFS= read -r cmd; do
    [[ -n "$cmd" ]] || continue
    cmd=${cmd#-}; cmd=${cmd#+}; cmd=${cmd#!}; cmd=${cmd#@}
    exe=${cmd%% *}
    case "$exe" in
      /usr/local/sbin/habbo-*) [[ -f "$work$exe" ]] || fail "unit ${unit##*/} references missing script $exe" ;;
    esac
  done < <(sed -n 's/^ExecStart=//p' "$unit")
done
for timer in "$work"/etc/systemd/system/*.timer; do
  target=$(sed -n 's/^Unit=//p' "$timer" | tail -1)
  if [[ -z "$target" ]]; then
    target=${timer##*/}
    target=${target%.timer}.service
  fi
  [[ -f "$work/etc/systemd/system/$target" ]] || fail "timer ${timer##*/} references missing unit $target"
done
for required in \
  usr/local/sbin/habbo-vps1-offsite-pull.sh \
  usr/local/sbin/habbo-vps1-offsite-restore-drill.sh \
  usr/local/sbin/habbo-offsite-tar-safety.py \
  usr/local/sbin/habbo-vps2-control-plane-heartbeat.sh \
  usr/local/sbin/habbo-vps2-control-plane-bootstrap.sh \
  usr/local/sbin/habbo-public-webkit-smoke.py \
  etc/systemd/system/habbo-vps1-offsite-pull.timer \
  etc/systemd/system/habbo-vps1-offsite-restore-drill.timer \
  etc/systemd/system/habbo-public-webkit.timer \
  etc/systemd/system/habbo-vps2-control-plane-heartbeat.timer; do
  [[ -f "$work/$required" ]] || fail "required VPS2 recovery artifact missing: $required"
done
bootstrap="$work/usr/local/sbin/habbo-vps2-control-plane-bootstrap.sh"
rehearsal="$work/.bootstrap-rehearsal"
HABBO_VPS2_SOURCE_ROOT="$work" "$bootstrap" --rehearsal "$rehearsal" >/dev/null || fail 'VPS2 recovery bootstrap rehearsal failed'
(cd "$rehearsal" && sha256sum -c "$MANIFEST" --status) || fail 'VPS2 recovery rehearsal hash verification failed'
[[ "$(find "$rehearsal/usr/local/sbin" -maxdepth 1 -type f -name 'habbo-*' | wc -l)" -eq 11 ]] || fail 'VPS2 recovery rehearsal script count mismatch'
[[ "$(find "$rehearsal/etc/systemd/system" -maxdepth 1 -type f -name 'habbo-*' | wc -l)" -eq 12 ]] || fail 'VPS2 recovery rehearsal unit count mismatch'
[[ "$(find "$rehearsal/etc/systemd/system/timers.target.wants" -maxdepth 1 -type l -name 'habbo-*' | wc -l)" -eq 4 ]] || fail 'VPS2 recovery rehearsal timer-link count mismatch'
echo 'PASS: Habbo VPS2 control-plane recovery smoke'
echo "source=$SRC files=23 scripts=11 units=12 hashes=verified inventory=exact syntax=verified exec_links=resolved bootstrap=rehearsed"

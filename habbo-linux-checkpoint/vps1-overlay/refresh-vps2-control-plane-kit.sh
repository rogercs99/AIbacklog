#!/usr/bin/env bash
set -euo pipefail
umask 077
ROOT=/srv/habbo
REMOTE=bridge-new
DISASTER=$ROOT/releases/disaster
LOCK=/run/lock/habbo-backup.lock
PATHS=(
  usr/local/sbin/habbo-live-drift-watch.sh
  usr/local/share/habbo-live-drift-baseline.tar.gz
  usr/local/share/habbo-live-drift-baseline.tar.gz.sha256
  usr/local/sbin/habbo-public-chromium-daily.sh
  usr/local/sbin/habbo-public-chromium-failed.sh
  usr/local/sbin/habbo-public-chromium-smoke.py
  usr/local/sbin/habbo-public-webkit-daily.sh
  usr/local/sbin/habbo-public-webkit-failed.sh
  usr/local/sbin/habbo-public-webkit-smoke.py
  usr/local/sbin/habbo-vps1-offsite-failed.sh
  usr/local/sbin/habbo-vps1-offsite-pull.sh
  usr/local/sbin/habbo-vps1-offsite-restore-drill.sh
  usr/local/sbin/habbo-vps1-offsite-store-smoke.sh
  usr/local/sbin/habbo-offsite-tar-safety.py
  usr/local/sbin/habbo-vps2-control-plane-bootstrap.sh
  usr/local/sbin/habbo-vps2-control-plane-heartbeat.sh
  usr/local/sbin/habbo-vps2-space-preflight.sh
  etc/systemd/system/habbo-live-drift-watch-failed.service
  etc/systemd/system/habbo-live-drift-watch.service
  etc/systemd/system/habbo-live-drift-watch.timer
  etc/systemd/system/habbo-public-chromium-failed.service
  etc/systemd/system/habbo-public-chromium.service
  etc/systemd/system/habbo-public-chromium.timer
  etc/systemd/system/habbo-public-webkit-failed.service
  etc/systemd/system/habbo-public-webkit.service
  etc/systemd/system/habbo-public-webkit.timer
  etc/systemd/system/habbo-vps1-offsite-pull-failed.service
  etc/systemd/system/habbo-vps1-offsite-pull.service
  etc/systemd/system/habbo-vps1-offsite-pull.timer
  etc/systemd/system/habbo-vps1-offsite-restore-drill-failed.service
  etc/systemd/system/habbo-vps1-offsite-restore-drill.service
  etc/systemd/system/habbo-vps1-offsite-restore-drill.timer
  etc/systemd/system/habbo-vps2-control-plane-heartbeat-failed.service
  etc/systemd/system/habbo-vps2-control-plane-heartbeat.service
  etc/systemd/system/habbo-vps2-control-plane-heartbeat.timer
)
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ $(id -u) -eq 0 ]] || fail "must run as root"
[[ "${#PATHS[@]}" -eq 35 ]] || fail "builder path count mismatch"
ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE" true || fail "bridge-new unavailable"
work=$(mktemp -d /dev/shm/habbo-vps2-kit-refresh.XXXXXX)
cleanup(){ rm -rf -- "$work"; }
trap cleanup EXIT
rootfs=$work/root
stage=$work/stage
install -d -m 700 "$rootfs" "$stage"
printf -v remote_paths " %q" "${PATHS[@]}"
ssh -o BatchMode=yes "$REMOTE" "exec tar -C / -czf -$remote_paths" >"$work/vps2-control-plane-overlay.tar.gz"
chmod 600 "$work/vps2-control-plane-overlay.tar.gz"
gzip -t "$work/vps2-control-plane-overlay.tar.gz" || fail "overlay gzip invalid"
python3 - "$work/vps2-control-plane-overlay.tar.gz" <<'PYSAFE'
import posixpath,sys,tarfile
f=sys.argv[1]
with tarfile.open(f,'r:gz') as t: members=t.getmembers()
if not (1 <= len(members) <= 128): raise SystemExit('unsafe generated overlay member count')
seen=set(); total=0
for m in members:
    n=m.name
    if not n or n.startswith('/') or '\\' in n: raise SystemExit('unsafe generated overlay member name')
    parts=[p for p in n.split('/') if p not in ('','.') ]
    if any(p=='..' for p in parts): raise SystemExit('generated overlay path traversal')
    norm=posixpath.normpath(n)
    if norm in seen: raise SystemExit('duplicate generated overlay member')
    seen.add(norm)
    if not m.isfile(): raise SystemExit('non-regular generated overlay member')
    if m.size < 0 or m.size > 16*1024*1024: raise SystemExit('oversized generated overlay member')
    total += m.size
    if total > 64*1024*1024: raise SystemExit('oversized generated overlay total')
PYSAFE
tar -xzf "$work/vps2-control-plane-overlay.tar.gz" -C "$rootfs"
(
  cd "$rootfs"
  printf "%s\0" "${PATHS[@]}" | sort -z | xargs -0 sha256sum --
) >"$work/vps2-control-plane-files-sha256.txt"
chmod 600 "$work/vps2-control-plane-files-sha256.txt"
[[ "$(wc -l < "$work/vps2-control-plane-files-sha256.txt")" -eq 35 ]] || fail "generated manifest count mismatch"
(cd "$rootfs" && sha256sum -c "$work/vps2-control-plane-files-sha256.txt" --status) || fail "generated manifest hash mismatch"
install -m 600 "$work/vps2-control-plane-overlay.tar.gz" "$stage/vps2-control-plane-overlay.tar.gz"
install -m 600 "$work/vps2-control-plane-files-sha256.txt" "$stage/vps2-control-plane-files-sha256.txt"
"$ROOT/ops/vps2-control-plane-recovery-smoke.sh" "$stage"
exec 9>"$LOCK"
flock -w 120 9 || fail "backup lock unavailable after 120s"
overlay_tmp=$DISASTER/.vps2-control-plane-overlay.tar.gz.new.$$
manifest_tmp=$DISASTER/.vps2-control-plane-files-sha256.txt.new.$$
install -m 600 "$work/vps2-control-plane-overlay.tar.gz" "$overlay_tmp"
install -m 600 "$work/vps2-control-plane-files-sha256.txt" "$manifest_tmp"
mv -f "$overlay_tmp" "$DISASTER/vps2-control-plane-overlay.tar.gz"
mv -f "$manifest_tmp" "$DISASTER/vps2-control-plane-files-sha256.txt"
flock -u 9
"$ROOT/ops/vps2-control-plane-recovery-smoke.sh" "$DISASTER"
"$ROOT/ops/disaster-recovery-source-smoke.sh"
echo "PASS: refreshed Habbo VPS2 control-plane recovery kit"
echo "files=35 scripts=15 units=18 overlay_sha256=$(sha256sum "$DISASTER/vps2-control-plane-overlay.tar.gz" | awk '{print $1}') manifest_sha256=$(sha256sum "$DISASTER/vps2-control-plane-files-sha256.txt" | awk '{print $1}')"

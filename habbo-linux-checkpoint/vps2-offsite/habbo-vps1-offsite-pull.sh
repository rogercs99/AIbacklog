#!/usr/bin/env bash
set -euo pipefail
umask 077
DEST=/var/backups/habbo-vps1
REMOTE=bridge-old
LOCK=/run/lock/habbo-vps1-offsite.lock
exec 8>"$LOCK"
flock -w 120 8 || { echo "FAIL: offsite lock unavailable after 120s" >&2; exit 1; }
mkdir -p "$DEST"
chmod 700 "$DEST"

backup_state=$(ssh -o BatchMode=yes "$REMOTE" 'systemctl show -p ActiveState --value habbo-backup-daily.service')
case "$backup_state" in
  active|activating|reloading|deactivating)
    echo "FAIL: VPS1 daily backup state is $backup_state; refusing to bless the previous generation" >&2
    exit 1
    ;;
esac

remote_backup=$(ssh -o BatchMode=yes "$REMOTE" 'cat /srv/habbo/LATEST_PUBLIC_WEB_BACKUP')
name=${remote_backup##*/}
[[ "$name" =~ ^manual-[0-9]{8}T[0-9]{6}Z$ ]] || { echo "invalid remote backup name: $name" >&2; exit 1; }
final="$DEST/$name.tar.gz"
sha_file="$final.sha256"

record_remote_marker(){
  local sha size now
  sha=$(sha256sum "$final" | awk '{print $1}')
  size=$(stat -c %s "$final")
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  ssh -o BatchMode=yes "$REMOTE" bash -s -- "$now" "$remote_backup" "$sha" "$size" "$name" <<'REMOTE_MARKER'
set -euo pipefail
now=$1
backup=$2
sha=$3
size=$4
name=$5
tmp=/srv/habbo/.OFFSITE_BACKUP_STATUS.tmp
printf 'validated_at_utc=%s\nbackup=%s\narchive_sha256=%s\narchive_size_bytes=%s\noffsite_host=VPS2\noffsite_path=/var/backups/habbo-vps1/%s.tar.gz\n' "$now" "$backup" "$sha" "$size" "$name" >"$tmp"
chmod 600 "$tmp"
mv "$tmp" /srv/habbo/OFFSITE_BACKUP_STATUS
cp /srv/habbo/OFFSITE_BACKUP_STATUS /run/habbo-offsite-backup
chmod 0644 /run/habbo-offsite-backup
rm -f /srv/habbo/OFFSITE_BACKUP_FAILED /run/habbo-offsite-backup-failed
REMOTE_MARKER
}

# Do not recopy an already verified source backup, but refresh the durable proof.
if [[ -f "$final" && -f "$sha_file" ]] && sha256sum -c "$sha_file" --status; then
  record_remote_marker
  echo "PASS: offsite copy already present and verified: $final"
  exit 0
fi

# Refuse to export a backup whose own file checksums are already bad.
ssh -o BatchMode=yes "$REMOTE" 'B=$(cat /srv/habbo/LATEST_PUBLIC_WEB_BACKUP); cd "$B"; sha256sum -c SHA256SUMS >/dev/null'

tmp="$DEST/.$name.tar.gz.tmp"
rm -f "$tmp"
ssh -o BatchMode=yes "$REMOTE" 'B=$(cat /srv/habbo/LATEST_PUBLIC_WEB_BACKUP); exec tar -C "$B" -czf - .' >"$tmp"
chmod 600 "$tmp"
gzip -t "$tmp"
/usr/local/sbin/habbo-offsite-tar-safety.py "$tmp" >/dev/null || { echo 'FAIL: pulled archive structural safety check failed' >&2; exit 1; }

work=$(mktemp -d /dev/shm/habbo-offsite-verify.XXXXXX)
trap 'rm -rf "$work" "$tmp"' EXIT
tar -xzf "$tmp" -C "$work"
(
  cd "$work"
  awk '{hash=$1; path=$2; sub(".*/", "", path); print hash "  " path}' SHA256SUMS | sha256sum -c - >/dev/null
)

mv "$tmp" "$final"
sha=$(sha256sum "$final" | awk '{print $1}')
printf '%s  %s\n' "$sha" "$final" >"$sha_file"
chmod 600 "$final" "$sha_file"
printf '%s\n' "$final" >"$DEST/LATEST"
chmod 600 "$DEST/LATEST"

# Keep only the three newest complete archives in this dedicated directory.
mapfile -t old < <(find "$DEST" -maxdepth 1 -type f -name 'manual-*.tar.gz' -printf '%T@ %p\n' | sort -nr | awk 'NR>3 {print $2}')
for f in "${old[@]}"; do
  rm -f -- "$f" "$f.sha256"
done

# Record successful off-host protection back on VPS1. The marker contains no secret.
record_remote_marker

echo "PASS: Habbo VPS1 offsite backup copied and verified"
echo "source=$remote_backup archive=$final sha256=$sha retention=3"

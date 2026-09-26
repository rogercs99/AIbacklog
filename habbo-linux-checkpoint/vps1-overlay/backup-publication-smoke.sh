#!/usr/bin/env bash
set -euo pipefail
ROOT=${ROOT:-/srv/habbo}
BACKUPS=${BACKUPS:-$ROOT/backups}
LATEST_FILE=${LATEST_FILE:-$ROOT/LATEST_PUBLIC_WEB_BACKUP}
LOCK=${LOCK:-/run/lock/habbo-backup.lock}
fail(){ echo "FAIL: $*" >&2; exit 1; }

[[ -f "$LATEST_FILE" ]] || fail 'LATEST_PUBLIC_WEB_BACKUP missing'
[[ "$(stat -c '%a %U:%G' "$LATEST_FILE")" == '600 root:root' ]] || fail 'LATEST_PUBLIC_WEB_BACKUP permissions invalid'
latest=$(cat "$LATEST_FILE")
latest_name=${latest##*/}
[[ "${latest%/*}" == "$BACKUPS" && "$latest_name" =~ ^manual-[0-9]{8}T[0-9]{6}Z$ ]] || fail "LATEST path malformed: $latest"
[[ -d "$latest" ]] || fail 'LATEST backup directory missing'
[[ "$(stat -c '%a %U:%G' "$latest")" == '700 root:root' ]] || fail 'LATEST backup directory permissions invalid'
[[ -f "$latest/SHA256SUMS" ]] || fail 'LATEST SHA256SUMS missing'

# Current-generation manifests must be relocation-safe.
if awk '{print $2}' "$latest/SHA256SUMS" | grep -Eq '^/|(^|/)\.\.(/|$)'; then
  fail 'LATEST checksum manifest contains absolute/parent path'
fi
if awk '{print $2}' "$latest/SHA256SUMS" | sort | uniq -d | grep -q .; then
  fail 'LATEST checksum manifest contains duplicate paths'
fi
(cd "$latest" && sha256sum -c SHA256SUMS >/dev/null) || fail 'LATEST checksum verification failed'
actual=$(mktemp /dev/shm/habbo-publication-actual.XXXXXX)
manifest=$(mktemp /dev/shm/habbo-publication-manifest.XXXXXX)
trap 'rm -f "$actual" "$manifest"' EXIT
find "$latest" -maxdepth 1 -mindepth 1 -type f ! -name SHA256SUMS -printf '%f\n' | sort >"$actual"
awk '{print $2}' "$latest/SHA256SUMS" | sed 's#^\./##' | sort >"$manifest"
cmp -s "$actual" "$manifest" || fail 'LATEST manifest coverage mismatch'
grep -Fxq '.env' "$manifest" || fail 'LATEST .env missing from checksum manifest'
while IFS= read -r name; do
  [[ "$(stat -c '%a %U:%G' "$latest/$name")" == '600 root:root' ]] || fail "LATEST file permissions invalid: $name"
done <"$actual"

# SIGKILL cannot run traps, so stale publication debris is a health failure.
if find "$BACKUPS" -maxdepth 1 -mindepth 1 -type d -name '.manual-*.incomplete' -mmin +10 -print -quit | grep -q .; then
  fail 'stale incomplete backup staging directory found'
fi
if find "$ROOT" -maxdepth 1 -type f -name '.LATEST_PUBLIC_WEB_BACKUP.tmp.*' -mmin +10 -print -quit | grep -q .; then
  fail 'stale temporary LATEST pointer found'
fi

[[ -e "$LOCK" ]] || fail 'backup lock file missing'
command -v flock >/dev/null || fail 'flock unavailable'

echo 'PASS: Habbo backup publication smoke'
echo "latest=$latest manifest=complete+relative+verified staging_stale=0 latest_tmp_stale=0 lock=present"
#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
BACKUPS=$ROOT/backups
KEEP_RECENT=${KEEP_RECENT:-14}
APPLY=${APPLY:-0}
LOCK=/run/lock/habbo-backup.lock
REPORT=$ROOT/validation/backup-retention-last.txt
fail(){ echo "FAIL: $*" >&2; exit 1; }
[[ "$KEEP_RECENT" =~ ^[0-9]+$ && "$KEEP_RECENT" -ge 7 ]] || fail 'KEEP_RECENT must be an integer >=7'
[[ "$APPLY" == 0 || "$APPLY" == 1 ]] || fail 'APPLY must be 0 or 1'
install -d -m 700 "$ROOT/validation"
exec 9>"$LOCK"
flock -n 9 || fail 'another Habbo backup/retention operation is already running'
"$ROOT/ops/backup-publication-smoke.sh" >/dev/null
latest=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")
mapfile -t dirs < <(find "$BACKUPS" -mindepth 1 -maxdepth 1 -type d -name 'manual-*' -printf '%f\n' | grep -E '^manual-[0-9]{8}T[0-9]{6}Z$' | sort -r)
((${#dirs[@]} > 0)) || fail 'no backups found'

declare -A keep=()
for ((i=0;i<${#dirs[@]} && i<KEEP_RECENT;i++)); do keep["$BACKUPS/${dirs[$i]}"]=recent; done
add_keep(){ local p=${1:-}; [[ -n "$p" && -d "$p" && "$p" == "$BACKUPS"/manual-* ]] && keep["$p"]=${2:-pinned}; }
add_keep "$latest" latest
for status in /run/habbo-disaster-drill "$ROOT/OFFSITE_RESTORE_DRILL_STATUS"; do
  if [[ -f "$status" ]]; then add_keep "$(awk -F= '$1=="backup" {print $2; exit}' "$status")" referenced; fi
done
add_keep "$BACKUPS/manual-20260923T183558Z" milestone
add_keep "$BACKUPS/manual-20260923T205014Z" milestone

candidates=()
for name in "${dirs[@]}"; do
  d="$BACKUPS/$name"
  [[ -L "$d" ]] && fail "refusing symlink backup directory: $d"
  [[ -f "$d/SHA256SUMS" ]] || fail "refusing to prune backup without SHA256SUMS: $d"
  [[ -f "$d/havana.sql.gz" ]] || fail "refusing to prune backup without DB dump: $d"
  [[ -n "${keep[$d]:-}" ]] || candidates+=("$d")
done

{
  echo "generated_at_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "apply=$APPLY keep_recent=$KEEP_RECENT total=${#dirs[@]} keep=${#keep[@]} candidates=${#candidates[@]} latest=$latest"
  for d in "${!keep[@]}"; do printf 'KEEP reason=%s %s\n' "${keep[$d]}" "$d"; done | sort -k3
  for d in "${candidates[@]}"; do printf 'DELETE %s\n' "$d"; done
} >"$REPORT.tmp"
chmod 600 "$REPORT.tmp"

if [[ "$APPLY" == 1 ]]; then
  for d in "${candidates[@]}"; do
    [[ "$d" =~ ^/srv/habbo/backups/manual-[0-9]{8}T[0-9]{6}Z$ ]] || fail "unsafe candidate path: $d"
    [[ "$d" != "$latest" ]] || fail 'LATEST unexpectedly selected for deletion'
    rm -rf --one-file-system -- "$d"
  done
fi
mv -f "$REPORT.tmp" "$REPORT"
chmod 600 "$REPORT"
echo "PASS: Habbo backup retention $([[ "$APPLY" == 1 ]] && echo applied || echo dry-run)"
echo "total=${#dirs[@]} keep=${#keep[@]} candidates=${#candidates[@]} keep_recent=$KEEP_RECENT report=$REPORT"
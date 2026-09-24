#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
KEEP_RECENT=${KEEP_RECENT:-8}
latest=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP" 2>/dev/null || true)
mapfile -t dirs < <(find "$ROOT/backups" -mindepth 1 -maxdepth 1 -type d -name 'manual-*' -printf '%T@ %p\n' | sort -nr | awk '{print $2}')
echo "backup_count=${#dirs[@]} keep_recent=$KEEP_RECENT latest=$latest"
keep=()
for ((i=0;i<${#dirs[@]} && i<KEEP_RECENT;i++)); do keep+=("${dirs[$i]}"); done
keep+=("$ROOT/backups/manual-20260923T183558Z")
[[ -n "$latest" ]] && keep+=("$latest")
for d in "${dirs[@]}"; do
  preserve=false
  for k in "${keep[@]}"; do [[ "$d" == "$k" ]] && preserve=true && break; done
  if $preserve; then
    printf 'KEEP %s\n' "$d"
  else
    size=$(du -sh "$d" | awk '{print $1}')
    printf 'CANDIDATE %s %s\n' "$size" "$d"
  fi
done

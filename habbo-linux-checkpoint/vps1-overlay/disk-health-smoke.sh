#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
fail(){ echo "FAIL: $*" >&2; exit 1; }

free_kb=$(df -Pk "$ROOT" | awk 'NR==2 {print $4}')
[[ "$free_kb" -ge 1048576 ]] || fail "less than 1 GiB free on Habbo filesystem"

backup_kb=$(du -sk "$ROOT/backups" | awk '{print $1}')
[[ "$backup_kb" -lt 1048576 ]] || fail "Habbo backups exceed 1 GiB"
backup_count=$(find "$ROOT/backups" -mindepth 1 -maxdepth 1 -type d -name 'manual-*' | wc -l)
[[ "$backup_count" -le 20 ]] || fail "too many local Habbo backups: $backup_count (max 20)"

for c in habbo-mariadb-1 habbo-havana-server-1 habbo-havana-web-1; do
  type=$(docker inspect "$c" --format '{{.HostConfig.LogConfig.Type}}')
  size=$(docker inspect "$c" --format '{{index .HostConfig.LogConfig.Config "max-size"}}')
  files=$(docker inspect "$c" --format '{{index .HostConfig.LogConfig.Config "max-file"}}')
  [[ "$type" == json-file ]] || fail "$c log driver is $type"
  [[ "$size" == 20m ]] || fail "$c max-size is $size, expected 20m"
  [[ "$files" == 3 ]] || fail "$c max-file is $files, expected 3"
done

if docker exec habbo-mariadb-1 sh -lc 'mariadb -N -B -uroot -p"$MARIADB_ROOT_PASSWORD" -e "SHOW DATABASES"' | grep -q '^habbo_restore_verify_'; then
  fail 'stale temporary restore database found'
fi

if docker ps -a --format '{{.Names}}' | grep -q '^habbo-backup-restore-verify-'; then
  fail 'stale isolated restore verifier container found'
fi

if find /dev/shm -maxdepth 1 -mindepth 1 -type d -name 'habbo-restore-verify.*' -mmin +10 -print -quit | grep -q .; then
  fail 'stale isolated restore verifier workdir found in /dev/shm'
fi

if find /dev/shm -maxdepth 1 -mindepth 1 -type d -name 'habbo-drill.*' -mmin +10 -print -quit | grep -q .; then
  fail 'stale disaster-drill workdir found in /dev/shm'
fi

latest=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")
[[ -d "$latest" ]] || fail 'latest backup path does not exist'

echo 'PASS: Habbo disk health smoke'
printf 'free_gib=%.2f backups_mib=%.1f backup_count=%s docker_logs=json-file:20m:3 stale_restore_dbs=0 stale_restore_containers=0 stale_restore_workdirs=0 stale_disaster_drill_workdirs=0\n' \
  "$(awk -v x="$free_kb" 'BEGIN{print x/1048576}')" \
  "$(awk -v x="$backup_kb" 'BEGIN{print x/1024}')" \
  "$backup_count"
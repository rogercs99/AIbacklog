#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
fail(){ echo "FAIL: $*" >&2; exit 1; }
db_query() {
  local sql=$1
  docker exec habbo-mariadb-1 sh -lc 'exec mariadb -N -B -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -e "$1"' _ "$sql"
}

mapfile -t rows < <(db_query "SELECT COALESCE(engine,'VIEW'),COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() GROUP BY engine ORDER BY engine;")
innodb=0; myisam=0; views=0; unknown=0
for row in "${rows[@]}"; do
  engine=${row%%$'\t'*}; count=${row##*$'\t'}
  case "$engine" in
    InnoDB) innodb=$count ;;
    MyISAM) myisam=$count ;;
    VIEW) views=$count ;;
    *) unknown=$((unknown+count)) ;;
  esac
done
[[ "$unknown" -eq 0 ]] || fail "unexpected table engines detected: $unknown objects"
[[ "$innodb" -ge 1 ]] || fail 'no InnoDB tables detected'

if [[ "$myisam" -gt 0 ]]; then
  grep -q -- '--lock-all-tables' "$ROOT/ops/backup.sh" || fail 'MyISAM exists but backup.sh lacks --lock-all-tables'
  grep -q 'mariadb-dump -uroot' "$ROOT/ops/backup.sh" || fail 'MyISAM exists but backup.sh does not use container-local root for locked dump'
  if grep -q -- '--single-transaction' "$ROOT/ops/backup.sh"; then
    fail 'backup.sh still contains --single-transaction while MyISAM exists'
  fi
fi

binary_columns=$(db_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND DATA_TYPE IN ('binary','varbinary','tinyblob','blob','mediumblob','longblob','bit');")
if [[ "$binary_columns" -gt 0 ]]; then
  grep -q -- '--hex-blob' "$ROOT/ops/backup.sh" || fail 'binary/BLOB columns exist but backup.sh lacks --hex-blob'
fi
for required in --routines --triggers --events; do
  grep -q -- "$required" "$ROOT/ops/backup.sh" || fail "backup.sh lacks $required"
done

echo 'PASS: Habbo DB backup consistency smoke'
echo "innodb=$innodb myisam=$myisam views=$views binary_columns=$binary_columns dump_mode=lock-all-tables+hex-blob objects=routines+triggers+events"
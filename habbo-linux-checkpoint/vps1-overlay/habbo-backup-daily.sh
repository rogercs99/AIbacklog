#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
OUT=$($ROOT/ops/backup.sh | tee /tmp/habbo-daily-backup.log | tail -1)
[[ -d "$OUT" ]]
# Prune before runtime health: disk-health-smoke rejects >20 local backups,
# so validating first can strand the daily job before retention gets a chance to run.
APPLY=1 KEEP_RECENT=14 "$ROOT/ops/backup-retention-prune.sh"
[[ -d "$OUT" ]] || { echo "FAIL: retention removed current backup $OUT" >&2; exit 1; }
systemctl start habbo-runtime-healthcheck.service
stamp=$(awk -F= '$1=="latest_backup" {print $2}' /run/habbo-runtime-health)
[[ "$stamp" == "$OUT" ]] || { echo "FAIL: runtime stamp did not advance to $OUT" >&2; exit 1; }
echo "PASS: daily Habbo backup retained and runtime-validated: $OUT"
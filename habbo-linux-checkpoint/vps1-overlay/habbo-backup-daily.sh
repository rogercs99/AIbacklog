#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
OUT=$($ROOT/ops/backup.sh | tee /tmp/habbo-daily-backup.log | tail -1)
[[ -d "$OUT" ]]
systemctl start habbo-runtime-healthcheck.service
stamp=$(awk -F= '$1=="latest_backup" {print $2}' /run/habbo-runtime-health)
[[ "$stamp" == "$OUT" ]] || { echo "FAIL: runtime stamp did not advance to $OUT" >&2; exit 1; }
echo "PASS: daily Habbo backup promoted and runtime-validated: $OUT"
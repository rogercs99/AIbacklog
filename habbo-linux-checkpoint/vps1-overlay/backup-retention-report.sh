#!/usr/bin/env bash
set -euo pipefail
exec env APPLY=0 KEEP_RECENT="${KEEP_RECENT:-14}" /srv/habbo/ops/backup-retention-prune.sh

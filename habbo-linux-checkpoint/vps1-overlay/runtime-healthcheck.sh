#!/usr/bin/env bash
set -u
ROOT=/srv/habbo
STAMP=/run/habbo-runtime-health
ATTEMPTS=${ATTEMPTS:-3}
SLEEP_SEC=${SLEEP_SEC:-5}
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

for attempt in $(seq 1 "$ATTEMPTS"); do
  : >"$TMP"
  ok=true
  for check in \
    "$ROOT/ops/smoke-test.sh" \
    "$ROOT/ops/network-perimeter-smoke.sh" \
    "$ROOT/ops/disk-health-smoke.sh" \
    "$ROOT/ops/cloudflare-ingress-smoke.sh" \
    "$ROOT/ops/public-web-smoke.sh"
  do
    if ! "$check" >>"$TMP" 2>&1; then
      ok=false
      break
    fi
  done
  if $ok; then
    rm -f /run/habbo-runtime-health.failed
    cat "$TMP"
    {
      printf 'validated_at_utc=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      printf 'latest_backup=%s\n' "$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")"
      printf 'bundle_sha256=%s\n' "$(sha256sum "$ROOT/releases/final-v2/habbo-2009-dual-linux-FINAL-v2-20260923.zip" | awk '{print $1}')"
    } >"$STAMP"
    chmod 0644 "$STAMP"
    echo "PASS: Habbo runtime healthcheck (attempt $attempt/$ATTEMPTS)"
    exit 0
  fi
  echo "WARN: Habbo runtime healthcheck attempt $attempt/$ATTEMPTS failed" >&2
  cat "$TMP" >&2
  sleep "$SLEEP_SEC"
done

echo 'FAIL: Habbo runtime healthcheck exhausted retries' >&2
exit 1
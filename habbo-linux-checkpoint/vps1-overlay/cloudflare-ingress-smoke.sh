#!/usr/bin/env bash
set -euo pipefail
UNIT=cloudflared-stremio-legacy
METRICS=http://127.0.0.1:20241/metrics
fail(){ echo "FAIL: $*" >&2; exit 1; }

systemctl is-active --quiet "$UNIT" || fail "$UNIT is not active"
systemctl is-enabled --quiet "$UNIT" || fail "$UNIT is not enabled"

m=$(curl -fsS --connect-timeout 3 --max-time 8 "$METRICS")
ha=$(awk '$1=="cloudflared_tunnel_ha_connections" {print int($2)}' <<<"$m" | tail -1)
[[ -n "$ha" ]] || fail 'HA connection metric missing'
[[ "$ha" -ge 2 ]] || fail "Cloudflare tunnel degraded below 2 HA connections: $ha"
locations=$(awk '/^cloudflared_tunnel_server_locations\{.*\} 1$/ {n++} END{print n+0}' <<<"$m")
[[ "$locations" -ge 2 ]] || fail "too few active edge locations/connections: $locations"

check_code(){
  local expected=$1 url=$2 name=$3 code
  code=$(curl --retry 4 --retry-all-errors --retry-delay 1 -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 15 "$url")
  [[ "$code" == "$expected" ]] || fail "$name returned HTTP $code, expected $expected"
}
check_code 200 https://habbo.gamemodai.pro/ Habbo
check_code 307 https://stremio-server.gamemodai.pro/ Stremio

echo 'PASS: shared Cloudflare ingress smoke'
echo "ha_connections=$ha active_edge_connections=$locations habbo=200 stremio=307"

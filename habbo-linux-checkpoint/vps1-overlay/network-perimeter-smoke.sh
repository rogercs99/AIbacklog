#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
fail(){ echo "FAIL: $*" >&2; exit 1; }
ports=(13307 12309 12321 12322 12323 18080 18081 18082)
listeners=$(ss -H -lnt)
for p in "${ports[@]}"; do
  grep -Eq "127\.0\.0\.1:${p}([[:space:]]|$)" <<<"$listeners" || fail "expected loopback listener missing on $p"
  if grep -Eq "(^|[[:space:]])(0\.0\.0\.0|\[::\]|\*):${p}([[:space:]]|$)" <<<"$listeners"; then
    fail "Habbo port $p is exposed on a wildcard address"
  fi
done

for c in habbo-mariadb-1 habbo-havana-server-1 habbo-havana-web-1; do
  docker inspect "$c" >/dev/null 2>&1 || fail "container missing: $c"
  if docker port "$c" | grep -Ev ' -> 127\.0\.0\.1:' | grep -q ' -> '; then
    fail "non-loopback Docker publication detected for $c"
  fi
done

if grep -RqiE 'server_name[[:space:]]+[^;]*habbo\.gamemodai\.pro' /etc/nginx/sites-enabled /etc/nginx/conf.d 2>/dev/null; then
  fail 'direct nginx server_name found for habbo.gamemodai.pro'
fi
CF=/etc/cloudflared-stremio-legacy/config.yml
grep -q 'hostname: habbo.gamemodai.pro' "$CF" || fail 'Cloudflare Habbo hostname missing'
grep -q 'service: http://127.0.0.1:18080' "$CF" || fail 'Cloudflare static route missing'
grep -q 'service: http://127.0.0.1:18081' "$CF" || fail 'Cloudflare web route missing'

headers=$(curl -fsSI --connect-timeout 5 --max-time 15 https://habbo.gamemodai.pro/ | tr -d '\r')
grep -qi '^server: cloudflare$' <<<"$headers" || fail 'public Habbo response is not coming through Cloudflare'
grep -qi '^cf-ray:' <<<"$headers" || fail 'Cloudflare ray header missing'

echo 'PASS: Habbo network perimeter smoke'
echo 'sensitive_ports=loopback-only public_ingress=cloudflare nginx_direct_habbo=absent'

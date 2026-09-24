#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
CF=/etc/cloudflared-stremio-legacy/config.yml
fail(){ echo "FAIL: $*" >&2; exit 1; }

require_mode(){
  local path=$1 mode=$2 owner=$3 got
  [[ -e "$path" ]] || fail "missing $path"
  got=$(stat -c '%a %U:%G' "$path")
  [[ "$got" == "$mode $owner" ]] || fail "$path permissions are $got, expected $mode $owner"
}

require_mode "$ROOT/.env" 600 root:root
require_mode "$ROOT/docker-compose.yml" 600 root:root
require_mode "$ROOT/PROJECT_CONTEXT.md" 600 root:root
require_mode "$CF" 600 root:root
require_mode "$ROOT/backups" 700 root:root

cred=$(awk '$1=="credentials-file:" {print $2}' "$CF" | head -1)
[[ -n "$cred" ]] || fail 'Cloudflare credentials-file missing from config'
require_mode "$cred" 600 root:root

latest=$(cat "$ROOT/LATEST_PUBLIC_WEB_BACKUP")
require_mode "$latest" 700 root:root
require_mode "$latest/.env" 600 root:root
require_mode "$latest/cloudflared-tunnel-credentials.json" 600 root:root

if find "$latest" -type f -perm /077 -print -quit | grep -q .; then
  fail 'latest backup contains group/other-accessible files'
fi
if find "$ROOT" -xdev -type f -perm -0002 -print -quit | grep -q .; then
  fail 'world-writable regular file exists under /srv/habbo'
fi
if grep -qiE '(PASSWORD|TOKEN|SECRET|API[_-]?KEY)[[:space:]]*=' /etc/systemd/system/habbo-*.service /etc/systemd/system/habbo-*.timer /etc/systemd/system/cloudflared-stremio-legacy.service 2>/dev/null; then
  fail 'secret-like assignment found in Habbo systemd unit'
fi

echo 'PASS: Habbo secret permissions smoke'
echo 'live_secrets=0600 backups=0700/0600 cloudflare_credential=0600 world_writable=0 systemd_embedded_secrets=0'
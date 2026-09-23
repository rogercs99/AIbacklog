#!/usr/bin/env bash
set -euo pipefail

BASE=https://habbo.gamemodai.pro
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1'

fetch(){
  curl --retry 3 --retry-all-errors --retry-delay 1     --connect-timeout 5 --max-time 15 -fsS     -A "$UA" "$@"
}

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
fetch "$BASE/" >"$TMP"
grep -q 'Habbo 2009 ~ Home' "$TMP"

for path in   /register   /web-gallery/static/js/landing.js   /web-gallery/v2/styles/frontpage.css   /web-gallery/v2/favicon.ico   /styles/local/uk.css   /js/local/uk.js   /c_images/Frontpage_images/frontpg_misc_01.gif   /client/v39/gamedata/external_variables_vps1.txt   /dcr/v31/habbo.dcr
do
  fetch -o /dev/null "$BASE$path"
done

echo 'PASS: Habbo public web smoke'

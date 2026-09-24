#!/usr/bin/env bash
set -euo pipefail
SRC=${1:-/srv/habbo/Havana/tools/www-tpl/default/index_v32.tpl}
DST=${2:-/srv/habbo/web-frontend-assets/templates/index_v32.tpl}
mkdir -p "$(dirname "$DST")"
cp -a "$SRC" "$DST"
if ! grep -q 'static/js/libs2.js' "$DST"; then
  sed -i '/static\/js\/landing.js/i\      <script src="{{ site.staticContentPath }}/web-gallery/static/js/libs2.js" type="text/javascript"></script>' "$DST"
fi
libs=$(grep -n 'static/js/libs2.js' "$DST" | head -1 | cut -d: -f1)
landing=$(grep -n 'static/js/landing.js' "$DST" | head -1 | cut -d: -f1)
test -n "$libs" -a -n "$landing" -a "$libs" -lt "$landing"
echo "PASS: libs2.js precedes landing.js in $DST"

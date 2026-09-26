#!/usr/bin/env bash
set -euo pipefail
SRC=${1:-/srv/habbo/Havana/tools/www-tpl/default/index_v32.tpl}
DST=${2:-/srv/habbo/web-frontend-assets/templates/index_v32.tpl}
python3 - "$SRC" "$DST" <<'PY'
from pathlib import Path
import sys
src = Path(sys.argv[1])
dst = Path(sys.argv[2])
s = src.read_text()
landing = '      <script src="{{ site.staticContentPath }}/web-gallery/static/js/landing.js" type="text/javascript"></script>\n'
libs = '      <script src="{{ site.staticContentPath }}/web-gallery/static/js/libs2.js" type="text/javascript"></script>\n'
if libs not in s:
    if landing not in s:
        raise SystemExit('landing.js anchor not found')
    s = s.replace(landing, libs + landing, 1)
dst.parent.mkdir(parents=True, exist_ok=True)
with dst.open('w') as f:
    f.write(s)
PY
chmod 0644 "$DST"
libs=$(grep -n 'static/js/libs2.js' "$DST" | head -1 | cut -d: -f1)
landing=$(grep -n 'static/js/landing.js' "$DST" | head -1 | cut -d: -f1)
test -n "$libs" -a -n "$landing" -a "$libs" -lt "$landing"
echo "PASS: libs2.js precedes landing.js in $DST (inode-preserving write)"

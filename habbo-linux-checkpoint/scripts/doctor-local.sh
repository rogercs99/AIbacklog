#!/usr/bin/env bash
set -u
LAB=${LAB:-/mnt/data/habbo_local_lab}
fail=0
ok(){ printf 'OK   %s\n' "$*"; }
miss(){ printf 'MISS %s\n' "$*"; fail=1; }

[ -x "$LAB/runtime/mariadb-x64/linux/bin/mariadbd" ] && ok 'MariaDB server binary' || miss 'MariaDB server binary'
[ -x "$LAB/runtime/wine/bin/wine" ] && ok 'portable Wine' || miss 'portable Wine'
[ -f "$LAB/runtime/havana/Havana/Havana-Server.jar" ] && ok 'Havana-Server.jar' || miss 'Havana-Server.jar'
[ -f "$LAB/runtime/havana/Havana/Havana-Web.jar" ] && ok 'Havana-Web.jar' || miss 'Havana-Web.jar'
[ -f "$LAB/deps/v31_bundle/v31/habbo.dcr" ] && ok 'V31 habbo.dcr' || miss 'V31 habbo.dcr'
[ -f "$LAB/deps/r39_bundle/flash/Habbo.swf" ] && ok 'R39 Habbo.swf' || miss 'R39 Habbo.swf'
command -v Xvfb >/dev/null && ok 'Xvfb' || miss 'Xvfb'
command -v ffmpeg >/dev/null && ok 'ffmpeg' || miss 'ffmpeg'

printf '\nListeners:\n'
(ss -ltnp 2>/dev/null || true) | grep -E ':3307|:12321|:12322|:12323|:12309|:80\b' || true

printf '\nKnown fatal schema marker:\n'
grep -n "navigator_styles" "$LAB/logs/havana-server.err" 2>/dev/null | tail -3 || true
exit "$fail"

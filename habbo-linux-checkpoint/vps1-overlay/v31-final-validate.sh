#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
V=$ROOT/validation/v31-human
B=$ROOT/v31
MARKER=$V/start.utc
mkdir -p "$V"
umask 077

stop_pidfile(){
  local f="$1"
  if [ -s "$f" ]; then
    kill "$(cat "$f")" 2>/dev/null || true
    rm -f "$f"
  fi
}

wait_port(){
  local p="$1"
  for _ in $(seq 1 30); do
    ss -lntH | grep -q "127.0.0.1:$p" && return 0
    sleep 1
  done
  return 1
}
force_stop_validation_processes(){
  stop_pidfile "$V/websockify.pid"
  stop_pidfile "$V/x11vnc.pid"
  stop_pidfile "$V/launcher.pid"
  stop_pidfile "$V/xvfb.pid"
  pkill -f '/client/launcher.exe' 2>/dev/null || true
  pkill -f '/bin/wineserver' 2>/dev/null || true
  pkill -f '^/srv/habbo/v31/runtime/proot-5.4.0 ' 2>/dev/null || true
  pkill -f '^Xvfb :104 ' 2>/dev/null || true
  pkill -f 'x11vnc.*-rfbport 59031' 2>/dev/null || true
  pkill -f 'websockify.*127.0.0.1:60831' 2>/dev/null || true
  sleep 1
}

start_session(){
  force_stop_validation_processes
  date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"
  rm -f "$V/current.png" "$V/events.log" "$V/walk.log"

  docker exec habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -e "UPDATE users SET sso_ticket=NULL,is_online=0,selected_room_id=1000 WHERE id=1;"'
  docker exec habbo-havana-server-1 sh -lc "sed -i 's/^log.received.packets=.*/log.received.packets=true/' /havana-server/server.ini"
  docker restart habbo-havana-server-1 >/dev/null
  wait_port 12321
  nohup Xvfb :104 -screen 0 1280x720x24 -nolisten tcp >"$V/xvfb.log" 2>&1 &
  echo $! >"$V/xvfb.pid"
  sleep 1

  nohup env DISPLAY=:104 WINEPREFIX=/wineprefix WINEARCH=win32     "$B/runtime/proot-5.4.0" -r "$B/runtime/wine32-root" -b /dev -b /proc -b /tmp     -b "$B/runtime/qemu-i386-9.2.4":/qemu-i386 -b "$B/wineprefix":/wineprefix     -b "$B/client":/client -w /client /qemu-i386 -L / /bin/wine /client/launcher.exe     >"$V/launcher.log" 2>&1 &
  echo $! >"$V/launcher.pid"

  nohup x11vnc -display :104 -rfbport 59031 -localhost -forever -shared -nopw     -o "$V/x11vnc.log" >/dev/null 2>&1 &
  echo $! >"$V/x11vnc.pid"
  wait_port 59031

  nohup websockify --web=/usr/share/novnc 127.0.0.1:60831 127.0.0.1:59031     >"$V/websockify.log" 2>&1 &
  echo $! >"$V/websockify.pid"
  wait_port 60831
  echo "READY display=:104 vnc=127.0.0.1:59031 novnc=127.0.0.1:60831 marker=$(cat "$MARKER")"
}
issue_ticket(){
  docker exec habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -NBe "UPDATE users SET sso_ticket=UUID(),is_online=0,selected_room_id=1000 WHERE id=1; SELECT sso_ticket FROM users WHERE id=1;"'
}

check_walk(){
  local start
  start=$(cat "$MARKER" 2>/dev/null || true)
  [ -n "$start" ] || { echo "ERROR: no start marker" >&2; exit 1; }

  docker exec habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -NBe "SELECT id,username,is_online,selected_room_id,IFNULL(CHAR_LENGTH(sso_ticket),0) FROM users WHERE id=1;"'
  docker logs --since "$start" habbo-havana-server-1 2>&1     | grep -E "Player RogerVideo.*(GET_INFO|TRYFLAT|GOTOFLAT|WALK)"     | tail -120 >"$V/events.log" || true
  grep "Received (WALK)" "$V/events.log" >"$V/walk.log" || true
  DISPLAY=:104 import -window root "$V/current.png" 2>/dev/null || true
  echo "=== EVENTS ==="
  cat "$V/events.log"
  echo "=== WALK ==="
  cat "$V/walk.log"
  test -s "$V/walk.log" || { echo "NO_FRESH_WALK"; exit 1; }
  echo "PASS_FRESH_V31_WALK"
}
status(){
  echo "marker=$(cat "$MARKER" 2>/dev/null || echo none)"
  echo "listeners:"
  ss -lntH | grep -E "127.0.0.1:(59031|60831)" || true
  echo "processes:"
  ps -eo pid,cmd | grep -E "Xvfb :104|x11vnc.*59031|websockify.*60831|launcher.exe|/bin/wineserver" | grep -v grep || true
  echo "user:"
  docker exec habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -NBe "SELECT id,username,is_online,selected_room_id,IFNULL(CHAR_LENGTH(sso_ticket),0) FROM users WHERE id=1;"'
  echo "packet_logging:"
  docker exec habbo-havana-server-1 sh -lc "grep ^log.received.packets /havana-server/server.ini"
}

cleanup(){
  force_stop_validation_processes
  rm -f /dev/shm/habbo-v31-vars.txt /dev/shm/habbo-v31-no-sso-vars.txt
  docker exec habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -e "UPDATE users SET sso_ticket=NULL,is_online=0 WHERE id=1;"'
  docker exec habbo-havana-server-1 sh -lc "sed -i 's/^log.received.packets=.*/log.received.packets=false/' /havana-server/server.ini"
  docker restart habbo-havana-server-1 >/dev/null
  sleep 3
  "$ROOT/ops/smoke-test.sh"
  echo CLEAN
}
case "${1:-}" in
  start) start_session ;;
  ticket) issue_ticket ;;
  check) check_walk ;;
  status) status ;;
  cleanup) cleanup ;;
  *) echo "usage: $0 {start|ticket|check|status|cleanup}" >&2; exit 2 ;;
esac

#!/usr/bin/env bash
set -euo pipefail
ROOT=/srv/habbo
V=$ROOT/validation/v31-human
B=$ROOT/v31
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

start_session(){
  stop_pidfile "$V/websockify.pid"
  stop_pidfile "$V/x11vnc.pid"
  stop_pidfile "$V/launcher.pid"
  stop_pidfile "$V/xvfb.pid"

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

  echo "READY display=:104 vnc=127.0.0.1:59031 novnc=127.0.0.1:60831"
}

issue_ticket(){
  docker exec habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -NBe "UPDATE users SET sso_ticket=UUID(),is_online=0,selected_room_id=1000 WHERE id=1; SELECT sso_ticket FROM users WHERE id=1;"'
}

check_walk(){
  docker exec habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -NBe "SELECT id,username,is_online,selected_room_id,IFNULL(CHAR_LENGTH(sso_ticket),0) FROM users WHERE id=1;"'
  docker logs --since 15m habbo-havana-server-1 2>&1     | grep -E "Player RogerVideo.*(GET_INFO|TRYFLAT|GOTOFLAT|WALK)"     | tail -80 || true
  DISPLAY=:104 import -window root "$V/current.png" 2>/dev/null || true
}

cleanup(){
  stop_pidfile "$V/websockify.pid"
  stop_pidfile "$V/x11vnc.pid"
  stop_pidfile "$V/launcher.pid"
  stop_pidfile "$V/xvfb.pid"

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
  cleanup) cleanup ;;
  *) echo "usage: $0 {start|ticket|check|cleanup}" >&2; exit 2 ;;
esac

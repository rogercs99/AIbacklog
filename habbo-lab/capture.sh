#!/usr/bin/env bash
set -euxo pipefail

ROOT="$GITHUB_WORKSPACE"
ART="$ROOT/artifacts"
LAB="$ROOT/lab/Havana"
PROJ="$ROOT/projectors"
export DISPLAY=:99
mkdir -p "$ART" "$ROOT/lab" "$PROJ"

sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install -y xvfb openbox xdotool wmctrl ffmpeg p7zip-full unzip jq curl wine64 wine32:i386 python3-argon2

git clone --depth 1 --branch v1.5.4 https://github.com/Quackster/Havana.git "$LAB"
cd "$LAB"
sed -i '/site.directory=.*var\/www\/html/a\    sed -i -E "s/(bind.ip=)(.*)/\\10.0.0.0/g" webserver-config.ini' tools/docker/web-entrypoint.sh
docker compose build

DIRECT="$(python3 - <<'PY'
import html,re,urllib.request
u='https://www.mediafire.com/file/xzjfsvb3k2962xo/havana_www_10_09_2024.7z/file'
req=urllib.request.Request(u,headers={'User-Agent':'Mozilla/5.0'})
s=urllib.request.urlopen(req,timeout=30).read().decode('utf-8','ignore')
for p in [r'id="downloadButton"[^>]*href="([^"]+)"',r'href="([^"]+)"[^>]*id="downloadButton"',r'href="(https://download[^"]+)"']:
    m=re.search(p,s,re.I)
    if m:
        print(html.unescape(m.group(1))); break
else:
    raise SystemExit('MediaFire direct URL not found')
PY
)"
curl -fL --retry 5 --retry-delay 3 "$DIRECT" -o "$RUNNER_TEMP/havana_www.7z"
mkdir -p "$RUNNER_TEMP/www_extract"
7z x -y "$RUNNER_TEMP/havana_www.7z" -o"$RUNNER_TEMP/www_extract" >/tmp/7z.log
DCRFILE="$(find "$RUNNER_TEMP/www_extract" -type f -path '*/dcr/v31/habbo.dcr' | head -n1)"
test -n "$DCRFILE"
WWWROOT="${DCRFILE%/dcr/v31/habbo.dcr}"
rm -rf tools/www
mkdir -p tools/www
cp -a "$WWWROOT"/. tools/www/
test -s tools/www/dcr/v31/habbo.dcr
test -s tools/www/gordon/RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438/Habbo.swf

docker compose up -d
for i in $(seq 1 90); do
  curl -fsS http://127.0.0.1/ >/dev/null 2>&1 && break
  sleep 2
done
curl -fsS http://127.0.0.1/ -o "$ART/home.html"

HASH="$(python3 - <<'PY'
from argon2 import PasswordHasher,Type
print(PasswordHasher(time_cost=2,memory_cost=65536,parallelism=1,hash_len=32,salt_len=16,type=Type.ID).hash('labpass'))
PY
)"
SQL="INSERT INTO users (username,password,figure,sex,pool_figure,sso_ticket,email) VALUES ('RogerVideo','$HASH','hr-165-45.hd-180-1.ch-255-66.lg-280-110.sh-290-62','M','','','roger-video@example.invalid') ON DUPLICATE KEY UPDATE password=VALUES(password),figure=VALUES(figure),sex=VALUES(sex);"
docker compose exec -T mariadb mariadb -uhavana -pgoldfish havana -e "$SQL"
docker compose exec -T mariadb mariadb -uhavana -pgoldfish havana -e "INSERT INTO rooms (owner_id,name,description,model,showname,password,accesstype) SELECT id,'RogerVideo Lab','Dual-client capture room','model_s',1,'',0 FROM users WHERE username='RogerVideo' AND NOT EXISTS (SELECT 1 FROM rooms WHERE name='RogerVideo Lab');"
ROOMID="$(docker compose exec -T mariadb mariadb -N -B -uhavana -pgoldfish havana -e "SELECT id FROM rooms WHERE name='RogerVideo Lab' ORDER BY id DESC LIMIT 1;")"
echo "$ROOMID" > "$ART/room-id.txt"

curl -fsS 'http://127.0.0.1/api/ticket?username=RogerVideo&password=labpass' -o "$ART/ticket.json"
jq 'del(.ssoTicket,.SsoTicket)' "$ART/ticket.json" > "$ART/ticket-redacted.json"
SSO="$(jq -r '.ssoTicket // .SsoTicket' "$ART/ticket.json")"
test -n "$SSO"

curl -fL --retry 5 'https://raw.githubusercontent.com/Palsternakka/HabboLauncher/main/HabboLauncher.Net/Resources/Projectors.zip' -o "$RUNNER_TEMP/projectors.zip"
unzip -q "$RUNNER_TEMP/projectors.zip" -d "$PROJ"
test -f "$PROJ/Shockwave/Habbo Hotel.exe"
test -f "$PROJ/Flash/Habbo Hotel.exe"

Xvfb :99 -screen 0 1280x720x24 -ac -noreset >"$ART/xvfb.log" 2>&1 &
XVFB_PID=$!
sleep 2
openbox >"$ART/openbox.log" 2>&1 &
OPENBOX_PID=$!

export WINEARCH=win32
export WINEPREFIX="$ROOT/wineprefix"
export WINEDEBUG=-all
export WINEDLLOVERRIDES='mscoree,mshtml='
wineboot -u >"$ART/wineboot.log" 2>&1 || true
sleep 3

ffmpeg -y -loglevel warning -f x11grab -draw_mouse 1 -framerate 24 -video_size 1280x720 -i :99.0 -c:v libx264 -preset veryfast -crf 25 -pix_fmt yuv420p "$ART/dual-client-real.mp4" >"$ART/ffmpeg.log" 2>&1 &
REC_PID=$!

# Shockwave V31 using the dedicated SSO projector and HTTP-served DCR/casts.
T="$ART/ticket.json"
HOST="$(jq -r '.host // .Host' "$T")"
SWPORT="$(jq -r '.shockwavePort // .ShockwavePort' "$T")"
MUSPORT="$(jq -r '.musPort // .MusPort' "$T")"
SITE="$(jq -r '.site // .Site' "$T")"
TEXTS='http://127.0.0.1/dcr/v31/gamedata/external_texts.txt?'
VARS='http://127.0.0.1/dcr/v31/gamedata/external_variables.txt?country=uk'
USERID="$(docker compose exec -T mariadb mariadb -N -B -uhavana -pgoldfish havana -e "SELECT id FROM users WHERE username='RogerVideo' LIMIT 1;")"

curl -fL --retry 5 'https://raw.githubusercontent.com/hiperesp/Habbo-v31-Projector/main/dcr/fuse_client.cct' -o "$LAB/tools/www/dcr/v31/fuse_client.cct"
test -s "$LAB/tools/www/dcr/v31/fuse_client.cct"
V31="$ROOT/v31-projector"
mkdir -p "$V31"
curl -fL --retry 5 'https://github.com/hiperesp/Habbo-v31-Projector/releases/download/v2.0.0/launcher.zip' -o "$RUNNER_TEMP/v31-launcher.zip"
unzip -q "$RUNNER_TEMP/v31-launcher.zip" -d "$V31"
find "$V31" -maxdepth 4 -type f -printf '%p %s bytes\n' | sort > "$ART/v31-projector-files.txt"
V31EXE="$(find "$V31" -type f -iname '*.exe' | grep -vi '/Redist/' | head -n1)"
test -n "$V31EXE"
V31DIR="$(dirname "$V31EXE")"
cat > "$V31DIR/vars.txt" <<EOF
client.allow.cross.domain=1;client.notify.cross.domain=0
connection.info.host=$HOST;connection.info.port=$SWPORT
connection.mus.host=$HOST;connection.mus.port=$MUSPORT
site.url=$SITE;url.prefix=$SITE
client.reload.url=$SITE/client;client.fatal.error.url=$SITE/client_error
client.connection.failed.url=$SITE/client_connection_failed;external.variables.txt=$VARS
external.texts.txt=$TEXTS
use.sso.ticket=1;sso.ticket=$SSO
forward.type=2;forward.id=$ROOMID;processlog.url=;account_id=$USERID
http://127.0.0.1/dcr/v31/habbo.dcr?
0
http://127.0.0.1/client
960
540
EOF
(
  cd "$V31DIR"
  wine "$V31EXE" >"$ART/shockwave-wine.log" 2>&1
) &
sleep 45
wmctrl -lG > "$ART/shockwave-windows.txt" || true
ffmpeg -y -loglevel error -f x11grab -video_size 1280x720 -i :99.0 -frames:v 1 "$ART/shockwave-screen.png"
xdotool search --name 'Habbo' windowactivate --sync key --clearmodifiers Alt+F10 || true
sleep 2
xdotool mousemove 650 390 click 1 || true
sleep 3
xdotool mousemove 720 420 click 1 || true
sleep 8
ffmpeg -y -loglevel error -f x11grab -video_size 1280x720 -i :99.0 -frames:v 1 "$ART/shockwave-after.png"

wineserver -k || true
sleep 4

# Flash R39 with a local SWF; external assets and socket still use the real local Havana server.
curl -fsS 'http://127.0.0.1/api/ticket?username=RogerVideo&password=labpass' -o "$ART/ticket-flash.json"
SSO2="$(jq -r '.ssoTicket // .SsoTicket' "$ART/ticket-flash.json")"
BASE='http://localhost/gordon/RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438/'
FVARS='http://localhost/flash/gamedata/external_variables.txt'
FTEXTS='http://localhost/flash/gamedata/external_flash_texts.txt'
SWF_HTTP='http://127.0.0.1/gordon/RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438/Habbo.swf'
ARG="${SWF_HTTP}?client.allow.cross.domain=1&client.notify.cross.domain=0&connection.info.host=127.0.0.1&connection.info.port=12323&site.url=http://localhost/&url.prefix=http://localhost/&client.reload.url=/disconnected&client.fatal.error.url=http://localhost/disconnected&client.connection.failed.url=http://localhost/disconnected&external.variables.txt=${FVARS}?&external.texts.txt=${FTEXTS}?&use.sso.ticket=1&sso.ticket=${SSO2}&processlog.enabled=1&account_id=1&client.starting=Please%20wait!&flash.client.url=${BASE}&user.hash=ticket&has.identity=0&flash.client.origin=popup&country_code=US&forward.type=2&forward.id=${ROOMID}"
(
  cd "$PROJ/Flash"
  wine './Habbo Hotel.exe' "$ARG" >"$ART/flash-wine.log" 2>&1
) &
sleep 45
wmctrl -lG > "$ART/flash-windows.txt" || true
ffmpeg -y -loglevel error -f x11grab -video_size 1280x720 -i :99.0 -frames:v 1 "$ART/flash-screen.png"
xdotool search --name 'Adobe Flash Player' windowactivate --sync key --clearmodifiers Alt+F10 || true
sleep 2
xdotool mousemove 575 370 click 1 || true
sleep 3
xdotool mousemove 700 430 click 1 || true
sleep 8
ffmpeg -y -loglevel error -f x11grab -video_size 1280x720 -i :99.0 -frames:v 1 "$ART/flash-after.png"

kill -INT "$REC_PID" || true
sleep 5
ffprobe -v error -show_entries format=duration,size -of json "$ART/dual-client-real.mp4" > "$ART/video-info.json"
docker compose logs --no-color > "$ART/compose.log" || true
grep -F 'Connection from' "$ART/compose.log" > "$ART/socket-connections.txt" || true
find "$ART" -maxdepth 1 -type f -printf '%f %s bytes\n' | sort > "$ART/files.txt"
kill "$OPENBOX_PID" "$XVFB_PID" || true

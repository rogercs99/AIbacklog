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

# Shockwave V31 via SPRD with local DCR and explicit external params.
T="$ART/ticket.json"
HOST="$(jq -r '.host // .Host' "$T")"
SWPORT="$(jq -r '.shockwavePort // .ShockwavePort' "$T")"
MUSPORT="$(jq -r '.musPort // .MusPort' "$T")"
SITE="$(jq -r '.site // .Site' "$T")"
TEXTS="$(jq -r '.shockwaveTexts // .ShockwaveTexts' "$T")"
VARS="$(jq -r '.shockwaveVariables // .ShockwaveVariables' "$T")"

git clone --depth 1 https://github.com/Webbanditten/kepler-docker.git "$RUNNER_TEMP/kepler"
SPRD="$ROOT/sprd"
cp -a "$RUNNER_TEMP/kepler/windows-client/projector" "$SPRD"
cp "$LAB/tools/www/dcr/v31/habbo.dcr" "$SPRD/habbo.dcr"
DCR_WIN="$(winepath -w "$SPRD/habbo.dcr")"

(
  cd "$SPRD"
  wine './SPRD.exe' "$DCR_WIN" \
    --setExternalParam "src" "habbo.dcr" \
    --setExternalParam "sw1" "client.allow.cross.domain=1;client.notify.cross.domain=0" \
    --setExternalParam "sw2" "connection.info.host=$HOST;connection.info.port=$SWPORT" \
    --setExternalParam "sw3" "connection.mus.host=$HOST;connection.mus.port=$MUSPORT" \
    --setExternalParam "sw4" "site.url=$SITE;url.prefix=$SITE" \
    --setExternalParam "sw5" "client.reload.url=$SITE/client;client.fatal.error.url=$SITE/client_error" \
    --setExternalParam "sw6" "client.connection.failed.url=$SITE/client_connection_failed;external.variables.txt=$VARS" \
    --setExternalParam "sw7" "external.texts.txt=$TEXTS" \
    --setExternalParam "sw8" "use.sso.ticket=1;sso.ticket=$SSO" \
    --setExternalParam "sw9" "forward.type=2;forward.id=$ROOMID;processlog.url=" \
    --setTheRunMode "Plugin" \
    --forceTheExitLock 0 \
    --traceLoad 1 \
    --traceLogFile "$ART/sprd-trace.txt" \
    >"$ART/shockwave-wine.log" 2>&1
) &
sleep 40
wmctrl -lG > "$ART/shockwave-windows.txt" || true
ffmpeg -y -loglevel error -f x11grab -video_size 1280x720 -i :99.0 -frames:v 1 "$ART/shockwave-screen.png"
xdotool search --name 'Habbo' windowactivate --sync key --clearmodifiers Alt+F10 || true
sleep 2
xdotool mousemove 620 385 click 1 || true
sleep 3
xdotool mousemove 760 430 click 1 || true
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
cp "$LAB/tools/www/gordon/RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438/Habbo.swf" "$PROJ/Flash/Habbo.swf"
SWF_WIN="$(winepath -w "$PROJ/Flash/Habbo.swf")"
ARG="${SWF_WIN}?client.allow.cross.domain=1&client.notify.cross.domain=0&connection.info.host=127.0.0.1&connection.info.port=12323&site.url=http://localhost/&url.prefix=http://localhost/&client.reload.url=/disconnected&client.fatal.error.url=http://localhost/disconnected&client.connection.failed.url=http://localhost/disconnected&external.variables.txt=${FVARS}?&external.texts.txt=${FTEXTS}?&use.sso.ticket=1&sso.ticket=${SSO2}&processlog.enabled=1&account_id=1&client.starting=Please%20wait!&flash.client.url=${BASE}&user.hash=ticket&has.identity=0&flash.client.origin=popup&country_code=US&forward.type=2&forward.id=${ROOMID}"
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
find "$ART" -maxdepth 1 -type f -printf '%f %s bytes\n' | sort > "$ART/files.txt"
kill "$OPENBOX_PID" "$XVFB_PID" || true

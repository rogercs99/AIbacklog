#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-$PWD/r39-flash-runtime}"
mkdir -p "$OUT"
URL='https://fpdownload.macromedia.com/pub/flashplayer/updaters/32/flash_player_sa_linux.x86_64.tar.gz'
TAR="$OUT/flash_player_sa_linux.x86_64.tar.gz"
curl -fL --retry 3 --retry-delay 2 "$URL" -o "$TAR"
echo '883f7aa23301fc80de879501157533a4acdbfee0721ed7c57676dc032fdf96c3  '"$TAR" | sha256sum -c -
tar -xzf "$TAR" -C "$OUT"
echo '0bdd5116aa4e8dc88fb9e705c85c1f7ef4a29415ffb9b2132a3eb1aeafaae7b0  '"$OUT/flashplayer" | sha256sum -c -
echo "R39 Flash runtime verified at $OUT/flashplayer"

#!/usr/bin/env bash
set -euo pipefail
TARGET="${1:-$PWD/habbo-restored}"
ASSET_DIR="${ASSET_DIR:-$(pwd)}"
SELF_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$TARGET" "$TARGET/_assembly" "$TARGET/runtime"

need(){ [ -f "$1" ] || { echo "Missing: $1" >&2; exit 2; }; }
check(){ local h="$1" f="$2"; echo "$h  $f" | sha256sum -c -; }

need "$SELF_DIR/runtime/qemu-i386-9.2.4"
check 47851b37911b1c76f1784a807cbb6592efb6166d0a27b39f7447dd0ec7c48384 "$SELF_DIR/runtime/qemu-i386-9.2.4"
cp -a "$SELF_DIR/runtime/qemu-i386-9.2.4" "$TARGET/runtime/"

CORE="$ASSET_DIR/habbo-core-small.zip"
[ -f "$CORE" ] || CORE="$ASSET_DIR/backend-parts/habbo-core-small.zip"
need "$CORE"
check da12b1ddae3e0b04bd12c5737de3af9609cc56913f0bae9f5f26f0cffe049d02 "$CORE"
unzip -q "$CORE" -d "$TARGET/core"

MDB="$TARGET/_assembly/mariadb-11.5.2-linux-systemd-x86_64.tar.gz"
: > "$MDB"
for i in 00 01 02 03 04 05; do
  z="$ASSET_DIR/habbo-mariadb-part-$i.zip"; [ -f "$z" ] || z="$ASSET_DIR/backend-parts/habbo-mariadb-part-$i.zip"
  need "$z"; unzip -p "$z" "mariadb.part$i" >> "$MDB"
done
check 6fffce126dda54ecaaa3659e03caa47bf5ff6828936001176f84b6bed9637f5c "$MDB"
mkdir -p "$TARGET/mariadb"; tar -xzf "$MDB" -C "$TARGET/mariadb"

WWW="$TARGET/_assembly/havana_www_10_09_2024.7z"
: > "$WWW"
for i in 00 01 02 03 04 05 06 07; do
  z="$ASSET_DIR/habbo-www-part-$i.zip"; [ -f "$z" ] || z="$ASSET_DIR/www-parts/habbo-www-part-$i.zip"
  need "$z"; unzip -p "$z" "www.part$i" >> "$WWW"
done
check 877273abddab946849aed3d5d2416185fe175a7207a602890fd08ebe7e376ed0 "$WWW"

RUNTIME="$ASSET_DIR/habbo-2009-dual-linux-RUNTIME-20260921.zip"
PREFIX="$ASSET_DIR/habbo-2009-dual-linux-WINEPREFIX-20260921.tar.gz"
need "$RUNTIME"; need "$PREFIX"
cp -a "$RUNTIME" "$PREFIX" "$TARGET/runtime/"

cp -a "$SELF_DIR/FINAL_VALIDATION.md" "$SELF_DIR/CURRENT_STATE.md" "$SELF_DIR/RECOVERY.md" "$SELF_DIR/R39_VALIDATION.md" "$SELF_DIR/EVIDENCE_SHA256.txt" "$TARGET/"
cp -a "$SELF_DIR/fetch-r39-flashplayer.sh" "$TARGET/"
cp -a "$SELF_DIR/logs" "$TARGET/"
cp -a "$SELF_DIR/evidence" "$TARGET/"

printf '%s\n' "Restore assembly VERIFIED." "QEMU 9.2.4 hash: OK" "MariaDB archive hash: OK" "WWW archive hash: OK"

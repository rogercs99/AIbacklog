#!/usr/bin/env bash
set -euo pipefail
APP_PATH="${1:-}"
DEVICE_ID="${IPHONE_DEVICE_ID:-}"
if [[ -z "$APP_PATH" || -z "$DEVICE_ID" ]]; then
  echo "Usage: IPHONE_DEVICE_ID=<id> $0 /path/to/App.app" >&2
  exit 2
fi
xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP_PATH/Info.plist")"
xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"

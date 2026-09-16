#!/usr/bin/env bash
set -euo pipefail

SUMMARY="${GITHUB_STEP_SUMMARY:-/tmp/iphone-bridge-summary.md}"
WG_STATUS="${WG_STATUS:-UNKNOWN}"
VPS_OVERLAY_IP="${VPS_OVERLAY_IP:-10.79.0.1}"
IPHONE_OVERLAY_IP="${IPHONE_OVERLAY_IP:-}"
OIDC_STATUS="${OIDC_STATUS:-FAIL}"
PEER_STATUS="${PEER_STATUS:-FAIL}"
IPHONE_DEVICE_ID="${IPHONE_DEVICE_ID:-}"
APPLE_DEVELOPMENT_TEAM="${APPLE_DEVELOPMENT_TEAM:-}"
ATTEMPT_PAIR="${ATTEMPT_PAIR:-true}"
TMP="${RUNNER_TEMP:-/tmp}"
DEVICES_JSON="$TMP/devicectl-devices.json"
DETAILS_JSON="$TMP/devicectl-details.json"

ok() { printf 'OK'; }
fail() { printf 'FAIL'; }
unknown() { printf 'UNKNOWN'; }

write_header() {
  {
    echo "# iPhone bridge diagnostics"
    echo
    echo "| Check | Result | Detail |"
    echo "|---|---:|---|"
  } >> "$SUMMARY"
}
row() {
  printf '| %s | %s | %s |\n' "$1" "$2" "${3//|/\\|}" >> "$SUMMARY"
}

write_header
row "OIDC authentication" "$OIDC_STATUS" "GitHub Actions OIDC token exchange with the peer broker."
row "Ephemeral peer registration" "$PEER_STATUS" "Runtime WireGuard public key registration."

# WireGuard is evaluated independently from CoreDevice/Bonjour.
if [[ "$WG_STATUS" == "OK" ]]; then
  row "WireGuard" "OK" "Tunnel setup command succeeded."
elif [[ "$WG_STATUS" == "FAIL" ]]; then
  row "WireGuard" "FAIL" "Tunnel unavailable or configuration missing: ${WG_CONFIG_MISSING:-unspecified}."
else
  row "WireGuard" "UNKNOWN" "Tunnel was not attempted."
fi

VPS_REACHABLE=NO
if ping -c 1 -W 1500 "$VPS_OVERLAY_IP" >/dev/null 2>&1; then
  VPS_REACHABLE=YES
  row "VPS 10.79.0.1 reachable" "YES" "$VPS_OVERLAY_IP responds to ICMP."
else
  row "VPS 10.79.0.1 reachable" "NO" "No ICMP reply from $VPS_OVERLAY_IP."
fi

IPHONE_REACHABLE=NO
if [[ -n "$IPHONE_OVERLAY_IP" ]]; then
  if ping -c 1 -W 1500 "$IPHONE_OVERLAY_IP" >/dev/null 2>&1; then
    IPHONE_REACHABLE=YES
    row "iPhone 10.79.0.2 reachable" "YES" "$IPHONE_OVERLAY_IP responds to ICMP."
  else
    row "iPhone 10.79.0.2 reachable" "NO" "No ICMP reply from $IPHONE_OVERLAY_IP."
  fi

  if nc -z -G 2 "$IPHONE_OVERLAY_IP" 62078 >/dev/null 2>&1; then
    row "Port 62078" "OK" "lockdownd/usbmux-related port is reachable."
  else
    row "Port 62078" "FAIL" "TCP 62078 is not reachable."
  fi
else
  row "iPhone 10.79.0.2 reachable" "UNKNOWN" "IPHONE_OVERLAY_IP is not configured."
  row "Port 62078" "UNKNOWN" "IPHONE_OVERLAY_IP is not configured."
fi

WG_HANDSHAKE=NO
HANDSHAKES="$(sudo wg show all latest-handshakes 2>/dev/null || true)"
if awk '$2 ~ /^[0-9]+$/ && $2 > 0 {found=1} END {exit !found}' <<<"$HANDSHAKES"; then
  WG_HANDSHAKE=YES
  row "WireGuard handshake" "YES" "WireGuard reports a non-zero latest-handshake timestamp."
else
  row "WireGuard handshake" "NO" "No non-zero WireGuard latest-handshake timestamp observed after overlay traffic."
fi

BONJOUR_OUTPUT="$(dns-sd -B _apple-mobdev2._tcp local. 2>&1 & pid=$!; sleep 4; kill "$pid" >/dev/null 2>&1 || true; wait "$pid" >/dev/null 2>&1 || true)"
if grep -q '_apple-mobdev2._tcp' <<<"$BONJOUR_OUTPUT" && grep -qE 'Add|Rmv' <<<"$BONJOUR_OUTPUT"; then
  row "Bonjour" "FOUND" "A service advertisement was observed."
else
  row "Bonjour" "NOT FOUND" "No iPhone wireless-device Bonjour advertisement observed in the sampling window."
fi

COREDEVICE_OK=false
if xcrun devicectl list devices --json-output "$DEVICES_JSON" >/tmp/devicectl-list.log 2>&1; then
  COREDEVICE_OK=true
else
  # Older/newer toolchains may reject json-output for list; retain plain-text evidence.
  xcrun devicectl list devices >/tmp/devicectl-list.log 2>&1 || true
fi

SELECTED=""
if [[ -s "$DEVICES_JSON" ]]; then
  SELECTED="$(python3 - "$DEVICES_JSON" "$IPHONE_DEVICE_ID" <<'PY'
import json,sys
p=sys.argv[1]; requested=sys.argv[2]
try: d=json.load(open(p))
except Exception: print(''); raise SystemExit
r=d.get('result') or {}
devices=r.get('devices') or r.get('deviceList') or []
if isinstance(devices,dict): devices=list(devices.values())

def val(o,*keys):
    for k in keys:
        if isinstance(o,dict) and o.get(k): return str(o[k])
    return ''
physical=[]
for x in devices:
    props=x.get('properties') or {}
    hw=x.get('hardwareProperties') or {}
    name=val(x,'name') or val(props,'name')
    ident=val(x,'identifier') or val(props,'identifier') or val(hw,'identifier')
    udid=val(hw,'udid')
    platform=(val(x,'platform') or val(props,'platform') or val(hw,'platform')).lower()
    kind=(val(x,'deviceType') or val(props,'deviceType') or name).lower()
    is_sim='simulator' in platform or 'simulator' in kind
    is_iphone='iphone' in kind or 'iphone' in name.lower()
    if is_iphone and not is_sim:
        physical.append((ident,udid,name))
if requested:
    for ident,udid,name in physical:
        if requested in (ident,udid): print(ident or udid); raise SystemExit
if len(physical)==1:
    print(physical[0][0] or physical[0][1])
else:
    print('')
PY
)"
fi

if [[ -z "$SELECTED" && -n "$IPHONE_DEVICE_ID" ]]; then
  SELECTED="$IPHONE_DEVICE_ID"
fi

if [[ -n "$SELECTED" ]] && xcrun devicectl device info details --device "$SELECTED" --json-output "$DETAILS_JSON" >/tmp/devicectl-details.log 2>&1; then
  row "CoreDevice" "VISIBLE" "Device resolved as $SELECTED."
  PAIR_STATE="$(python3 - "$DETAILS_JSON" <<'PY'
import json,sys
try:d=json.load(open(sys.argv[1])).get('result') or {}
except Exception:print('unknown');raise SystemExit
vals=[]
def walk(x):
    if isinstance(x,dict):
        for k,v in x.items():
            if 'pair' in k.lower(): vals.append((k,v))
            walk(v)
    elif isinstance(x,list):
        for v in x: walk(v)
walk(d)
s=' '.join(f'{k}={v}' for k,v in vals).lower()
if any(z in s for z in ['paired=true','pairingstate=paired','pairing state=paired','pairingstate=1']): print('paired')
elif vals: print('unpaired')
else: print('unknown')
PY
)"
  if [[ "$PAIR_STATE" == paired ]]; then
    row "Paired" "YES" "CoreDevice reports pairing metadata consistent with paired."
  else
    row "Paired" "NO" "Pairing is not confirmed by details output."
    if [[ "$ATTEMPT_PAIR" == true ]]; then
      if xcrun devicectl manage pair --device "$SELECTED" >/tmp/devicectl-pair.log 2>&1; then
        row "Pairing attempt" "OK" "devicectl manage pair returned success."
      else
        row "Pairing attempt" "FAIL" "devicectl could not complete pairing; see workflow logs."
      fi
    else
      row "Pairing attempt" "UNKNOWN" "Pairing attempt disabled by workflow input."
    fi
  fi
else
  if [[ "$COREDEVICE_OK" == true ]]; then
    row "CoreDevice" "NOT VISIBLE" "No uniquely selectable physical iPhone was visible."
  else
    row "CoreDevice visibility" "FAIL" "devicectl list devices failed; see workflow logs."
  fi
  row "Paired" "UNKNOWN" "Cannot evaluate pairing without CoreDevice visibility."
  row "Pairing attempt" "UNKNOWN" "No device selected."
fi

row "Install possible" "NO" "Apple signing is intentionally not configured in this diagnostic phase."

if [[ "$WG_STATUS" != "OK" ]]; then
  row "Blocking reason" "WireGuard setup" "Local tunnel setup did not complete."
elif [[ "${VPS_REACHABLE:-NO}" != "YES" ]]; then
  row "Blocking reason" "WireGuard data plane" "The local tunnel exists, but the VPS overlay address is not reachable."
elif [[ "${IPHONE_REACHABLE:-NO}" != "YES" ]]; then
  row "Blocking reason" "VPS-to-iPhone forwarding" "Runner-to-VPS overlay traffic works, but runner-to-iPhone traffic does not. Check VPS forwarding/firewall and the iPhone peer return path before Apple discovery."
elif [[ -z "$SELECTED" ]]; then
  row "Blocking reason" "Apple discovery" "IP overlay diagnostics completed, but CoreDevice did not resolve a physical iPhone."
elif [[ "${PAIR_STATE:-unknown}" != "paired" ]]; then
  row "Blocking reason" "Pairing" "CoreDevice resolved a device but pairing is not confirmed."
else
  row "Blocking reason" "Signing" "Connectivity/pairing checks passed; signing remains intentionally disabled."
fi

{
  echo
  echo "## Interpretation"
  echo
  echo "WireGuard reachability, Bonjour discovery and CoreDevice visibility are separate checks. A successful L3 tunnel alone is not evidence that Apple's local wireless-device discovery requirements are satisfied."
} >> "$SUMMARY"

cat "$SUMMARY"

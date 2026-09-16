#!/usr/bin/env bash
set -euo pipefail
: "${WG_PRIVATE_KEY:?WG_PRIVATE_KEY is required}"
: "${WG_PEER_PUBLIC_KEY:?WG_PEER_PUBLIC_KEY is required}"
: "${WG_ENDPOINT:?WG_ENDPOINT is required}"
: "${WG_ADDRESS:?WG_ADDRESS is required}"
: "${WG_ALLOWED_IPS:?WG_ALLOWED_IPS is required}"

CONF="${RUNNER_TEMP:-/tmp}/wg0.conf"
umask 077
cat > "$CONF" <<EOF
[Interface]
PrivateKey = $WG_PRIVATE_KEY
Address = $WG_ADDRESS

[Peer]
PublicKey = $WG_PEER_PUBLIC_KEY
Endpoint = $WG_ENDPOINT
AllowedIPs = $WG_ALLOWED_IPS
PersistentKeepalive = 25
EOF
sudo wg-quick up "$CONF"

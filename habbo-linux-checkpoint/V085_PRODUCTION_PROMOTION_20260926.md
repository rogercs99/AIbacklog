# Habbo v0.8.5 — production promotion — 2026-09-26

## Result
v0.8.5 was promoted to the public Habbo path after the preflight gate passed. Production frontend is `habbo-web-v085.service` on `127.0.0.1:18100`; historical static paths stay on `18080`.

## Canary evidence
- WebKit iPhone 14 Plus: home + register + login + `/me` PASS.
- V31: native Director/Wine runtime streamed through noVNC PASS.
- R39: native Adobe Flash Player streamed through noVNC PASS.
- Browser HTML remained plugin-free and did not expose SSO tickets.

## First cutover and rollback
The first transient Cloudflare cutover routed the default Habbo origin to `18100` but omitted WebSocket ingress paths. Login passed, while V31 noVNC timed out. The cutover was immediately rolled back to `cloudflared-stremio-legacy.service`; the legacy service returned active and public HTTP recovered.

## Root cause and correction
The v0.8.5 environment already used `wss://habbo.gamemodai.pro/v31-websockify` and `wss://habbo.gamemodai.pro/r39-websockify`. Cloudflare therefore requires explicit path rules to `18131` and `18139`. The versioned non-secret fragment is `vps1-overlay/cloudflared-v085-habbo-ingress.yml`.

## Successful cutover
- Corrected staged Cloudflare configuration passed `tunnel ingress validate: OK`.
- Second transient cutover became active.
- Full public smoke then passed home/register/login/me + V31 noVNC + R39 native-Flash noVNC.
- The validated staged config was installed persistently as `/etc/cloudflared-stremio-legacy/config.yml` with mode `0600 root:root`.
- Persistent `cloudflared-stremio-legacy.service` became active before the transient unit was stopped.
- Final observed state at persistence switch: persistent active, transient inactive.

## Rollback
A pre-v0.8.5 Cloudflare config backup was retained on VPS1. Rollback is to restore that config, restart `cloudflared-stremio-legacy.service`, and leave the v0.8.5 release/service isolated from public ingress.

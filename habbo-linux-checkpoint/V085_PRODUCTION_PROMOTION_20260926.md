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

## Final production/recovery closure
- Public WebKit/iPhone 14 Plus E2E PASS after persistent cutover: authenticated flow + V31 noVNC + R39 native-Flash noVNC.
- Public Chromium desktop E2E PASS after persistent cutover: V31 noVNC + R39 native-Flash noVNC, exit code 0.
- Browser contract remained plugin-free; no SSO ticket was exposed in V31/R39 HTML.
- Cloudflare ingress was cleaned to exactly one V31 WebSocket route (`18131`), one R39 WebSocket route (`18139`), historical static origin (`18080`) and v0.8.5 frontend catchall (`18100`).
- `habbo-web-v085.service` now carries `HABBO_V31_PROXY_ORIGIN=http://127.0.0.1:18100` in the base unit, so backup/restore does not depend on an unrecorded drop-in.
- Backup/recovery contract now archives the canonical production tree `v0.8.5-prod-20260926`, validates the restored service/environment/routes, and accepts the pinned Cloudflare metrics argument independently of argument ordering.
- Canonical post-deploy backup: `/srv/habbo/backups/manual-20260926T090032Z`; isolated restore verifier PASS with 88 tables, 40 navigator styles, RogerVideo=1 and room1000=1.
- VPS2 offsite copy of the same backup PASS; retained-store smoke PASS.
- Local retention policy reapplied: 16 protected generations after pruning stale candidates.
- Runtime healthcheck PASS against `manual-20260926T090032Z`.
- Non-destructive disaster drill PASS against `manual-20260926T090032Z`, including DB restore in tmpfs and Havana commit `b550f00f27788145d26723fd19e943aa63504a63`.
- Final `/srv/habbo/ops/deployment-final-validate.sh`: PASS across product, perimeter, Cloudflare, disk, backup publication/restore, secrets, disaster sources, VPS2 recovery, offsite backup, WebKit proof and public web.

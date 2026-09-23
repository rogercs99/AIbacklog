# VPS1 deployment — FINAL-v2 — 2026-09-23

## Scope and canonical source
This branch records deployment of the already-validated immutable FINAL-v2 to VPS1/OLD. It does not reopen R39/V31 runtime research and it does not modify the canonical ZIP.

- VPS1/OLD: SSH alias `bridge-old`, host `85.208.23.189`, hostname `secureme`.
- Canonical asset: `habbo-2009-dual-linux-FINAL-v2-20260923.zip`.
- Size: `3476825` bytes.
- SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`.
- VPS1 path: `/srv/habbo/releases/final-v2/habbo-2009-dual-linux-FINAL-v2-20260923.zip`.
- On VPS1 the ZIP passed exact size/hash, `unzip -t`, internal `EVIDENCE_SHA256.txt`, and embedded QEMU 9.2.4 verification.

## VPS1 architecture
All VPS-specific configuration is outside the immutable FINAL-v2 bundle.

- Docker Compose: MariaDB 11.5.2 + Havana server + Havana web.
- MariaDB: `127.0.0.1:13307 -> 3306`.
- Havana: `127.0.0.1:12321` Shockwave, `12322` MUS, `12323` Flash, `12309` RCON.
- Havana web: `127.0.0.1:18081`.
- `habbo-static.service`: `127.0.0.1:18080`, serving `/srv/habbo/web` through `/srv/habbo/ops/static-server.py`; request logs strip URL query strings.
- `habbo-websockify.service`: `127.0.0.1:18082 -> 127.0.0.1:12323`.
- `habbo-stack.service`: enabled oneshot supervisor for Compose with backend readiness check.
- Compose services use `restart: unless-stopped`; static/websockify use systemd restart policies.
- No Habbo firewall opening was added. DB, game and admin listeners remain loopback-only.
- Existing Stremio, nginx and Cloudflare services were regression-checked after the final Habbo restart and remained active.
- Root filesystem was about 96% used during deployment; avoid unnecessary large copies.

## Operations
- Control: `/srv/habbo/ops/control.sh {start|stop|restart|status|logs|smoke|backup}`
- Smoke: `/srv/habbo/ops/smoke-test.sh`
- Backup: `/srv/habbo/ops/backup.sh`
- VPS-local runbook: `/srv/habbo/PROJECT_CONTEXT.md`

Secrets remain only in root-owned local runtime configuration. Do not copy passwords, active SSO tickets, tokens, PATs or private keys into Git, knowledge, backups or logs.

## Final server validation
A controlled restart of `habbo-stack`, `habbo-static` and `habbo-websockify` was followed by the final extended smoke test.

PASS results:
- canonical ZIP identity, unzip integrity and internal evidence manifest;
- MariaDB healthy, 88 schema tables, 40 `navigator_styles`;
- RogerVideo id 1 offline, selected room 1000, active SSO length 0;
- room 1000 = `RogerVideo Lab`;
- expected listeners `12309/12321/12322/12323/13307/18080/18081/18082`, all loopback;
- static HTTP and Havana web readiness;
- critical R39 and V31 assets;
- V31 deployment `vars.txt` CRLF and loopback targets;
- Docker and all three Habbo systemd units active + enabled;
- final backup restore round-trip into temporary MariaDB: PASS (`88 / 40 / RogerVideo / room 1000`).

Restore-tested backup `/srv/habbo/backups/manual-20260923T183558Z` passed `gzip -t` and `sha256sum -c SHA256SUMS` and completed a temporary-MariaDB restore round-trip verifying 88 tables, 40 `navigator_styles`, `RogerVideo`, and room 1000. The final post-acceptance operational backup is `/srv/habbo/backups/manual-20260923T205014Z`; it passes gzip/SHA256 verification and its ops overlay contains the final hardened `ops/v31-final-validate.sh` with SHA-256 `0617f96a50d06f2c8bab612d5a5ea73acdcccf571c8e2382107591f3da097d88`, matching the live VPS copy. The earlier 183558Z backup remains the one with an explicit restore round-trip. Neither backup contains `.env`.

No full-machine reboot was required; actual service/process restart persistence was exercised directly.

## Deployment-specific R39 overlay
R39 runtime remains Adobe Flash Player Linux x86_64 32.0.0.465. Ruffle remains diagnostic only.

- Runtime: `/srv/habbo/r39/runtime/flashplayer`.
- Official archive/player hashes were verified by the canonical helper.
- The first native VPS1 probe launched Adobe Flash but initially stayed at `client.starting`; that probe exposed the asset regression documented below.
- That probe revealed a reproducible VPS1 asset issue: the Gordon RELEASE39 directory was missing `config_habbo.xml`, while the active variable set referenced stale external CDN assets.
- Overlay fix: the Gordon directory links `config_habbo.xml` to the local validated v39 config.
- Local variables overlay: `/srv/habbo/web/client/v39/gamedata/external_variables_vps1.txt`, pointing static assets to loopback and Havana web routes to `127.0.0.1:18081`; SHA-256 `902bb2a88ca0a02d23a4ee6342a96405aeb19932203479ec44494d89af7327b3`.
- This local overlay contains no `habbo.gamemodai.pro` or `cdn.classichabbo.com` references. The smoke test verifies the Gordon config, local figure/furnidata endpoints, correct web-route target, explicit room-1000 identity, and absence of those stale hosts.
- After the overlay fix, a fresh native VPS1 R39 session authenticated `RogerVideo`, held TCP 12323 ESTABLISHED, entered room 1000, rendered the avatar and produced a real Havana `WALK` at `2026-09-23T18:56:12.915Z`. Before/after framebuffer diff: 3732 pixels.
- Sanitized fresh R39 evidence is under `/srv/habbo/validation/final-evidence-20260923/` and is documented in `habbo-linux-checkpoint/VPS1_CLIENT_VALIDATION_20260923.md`.
- The one-use SSO was consumed/cleared; current RogerVideo SSO length is 0.
- Static request logging was hardened after the probe: query strings are now removed from journald request lines; a synthetic query-marker test passed.

This is a deployment regression fix, not a change to the FINAL-v2 bundle or to the selected R39 runtime.

## V31 overlay
The validated runtime decision remains: PRoot 5.4 for filesystem/binds only, explicit QEMU i386 9.2.4, Wine32 5.11 and the hiperesp launcher. Never use `proot -q`.

`/srv/habbo/v31/client/vars.txt` now exists as a VPS deployment overlay:
- CRLF line endings;
- loopback Shockwave/MUS targets `12321/12322`;
- loopback static/Havana web URLs;
- no password or SSO ticket.

## Backup and restore
Create a backup:
`/srv/habbo/ops/backup.sh`

Verify one:
`cd <backup-dir> && gzip -t havana.sql.gz && sha256sum -c SHA256SUMS`

Database restore sequence:
1. `cd /srv/habbo && docker compose stop havana-server havana-web`
2. Keep MariaDB running and healthy.
3. `gzip -cd <backup-dir>/havana.sql.gz | docker exec -i habbo-mariadb-1 sh -lc 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE"'`
4. Restore verified unit/overlay files if required.
5. `systemctl daemon-reload && systemctl restart habbo-stack habbo-static habbo-websockify`
6. `/srv/habbo/ops/smoke-test.sh`

## Fresh VPS1 client acceptance

Historical FINAL-v2 R39 and V31 evidence remains PASS and was not reinvestigated.

Fresh VPS1 R39 is PASS: native Adobe Flash Player 32.0.0.465 authenticated RogerVideo, held TCP 12323, loaded room 1000, rendered the avatar and produced a real Havana WALK with before/after framebuffer evidence.

Fresh VPS1 V31 is also PASS end-to-end through the validated hiperesp + PRoot 5.4 filesystem-only + explicit QEMU i386 9.2.4 + Wine32 5.11 path. The final clean session produced INIT_CRYPTO, GENERATEKEY, VERSIONCHECK, UNIQUEID, GET_SESSION_PARAMETERS and SSO, authenticated RogerVideo, then GET_INFO/navigation, TRYFLAT, GOTOFLAT and GETROOMAD. Room 1000 `RogerVideo Lab` rendered the avatar, and a floor click produced Havana `Received (WALK): 75 / AKPBQA` at `2026-09-23T20:45:23.814Z`. The before/after framebuffer changed 33474 pixels.

The one-use SSO was cleared after authentication and before final evidence capture. Final V31 evidence is under `/srv/habbo/validation/final-evidence-20260923/` and is documented in `habbo-linux-checkpoint/VPS1_CLIENT_VALIDATION_20260923.md`.

Post-validation cleanup closed VNC/noVNC, Wine/QEMU/Xvfb/x11vnc/websockify and the temporary control-host SSH tunnel. Stale PRoot wrappers discovered during teardown were removed and the regression helper was hardened to clean them automatically. RogerVideo is offline with no active SSO, packet logging is false and the normal smoke test passes.

Canonical regression helper: `/srv/habbo/ops/v31-final-validate.sh`; versioned copy: `habbo-linux-checkpoint/vps1-overlay/v31-final-validate.sh`.

**No fresh graphical acceptance item remains pending.**


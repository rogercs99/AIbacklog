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
- Public website: `https://habbo.gamemodai.pro` through the existing Cloudflare Tunnel. Dynamic routes remain on loopback `18081`; static web/game assets remain on loopback `18080`.
- No Habbo firewall opening was added. DB, game and admin listeners remain loopback-only; only the HTTP website is published through Cloudflare.
- Existing Stremio, nginx and Cloudflare services were regression-checked after the final Habbo restart and remained active.
- Root filesystem was about 96% used during deployment; avoid unnecessary large copies.

## Operations
- Control: `/srv/habbo/ops/control.sh {start|stop|restart|status|logs|smoke|backup}`
- Smoke: `/srv/habbo/ops/smoke-test.sh`
- Public web smoke: `/srv/habbo/ops/public-web-smoke.sh`
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

Restore-tested backup `/srv/habbo/backups/manual-20260923T183558Z` passed `gzip -t` and `sha256sum -c SHA256SUMS` and completed a temporary-MariaDB restore round-trip verifying 88 tables, 40 `navigator_styles`, `RogerVideo`, and room 1000. The latest complete operational backup is always tracked by `/srv/habbo/LATEST_PUBLIC_WEB_BACKUP`. The current backup format includes the Cloudflare ingress configuration and `web-static-overlay.tar.gz`, in addition to the DB, ops and existing deployment overlays. The earlier 183558Z backup remains the one with an explicit database restore round-trip. No tunnel credentials are copied into documentation.

No full-machine reboot was required; actual service/process restart persistence was exercised directly.

## Public web publication

The iPhone/Safari failure was reproduced from VPS2 as a DNS failure: `habbo.gamemodai.pro` had no public record and requests failed before reaching TLS. A Cloudflare Tunnel CNAME was created for the hostname using the existing VPS1 tunnel.

Ingress now routes:
- static prefixes `/c_images`, `/client`, `/gordon`, `/dcr`, `/flash`, `/web-gallery`, `/styles`, `/js` to `127.0.0.1:18080`;
- all other `habbo.gamemodai.pro` web routes to Havana Web on `127.0.0.1:18081`.

Havana's templates depend on a separately distributed legacy web package. The official `havana_www_10_09_2024.7z` archive used for the overlay was 508016467 bytes with SHA-256 `877273abddab946849aed3d5d2416185fe175a7207a602890fd08ebe7e376ed0`. Only the required `web-gallery` tree (about 25 MB / 1030 files) was retained, plus the empty local compatibility overrides expected by the templates. The large archive and extraction scratch tree were deleted after installation.

External validation from VPS2 with an iPhone Safari user agent returned HTTP 200 for the homepage, registration page, favicon, `landing.js`, `frontpage.css`, front-page GIF, R39 variables and V31 DCR. TLS verifies normally. Public DNS was separately confirmed through Cloudflare and Google DoH.

VPS2 itself exhibited one intermittent local DNS resolver timeout during repeated tests, but the retrying public smoke passes from VPS1 and VPS2 and public resolvers continue to return the Cloudflare record.

Detailed proof and recovery notes: `habbo-linux-checkpoint/VPS1_PUBLIC_WEB_20260923.md`.

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
5. Restore public web assets with `tar -C /srv/habbo/web -xzf <backup-dir>/web-static-overlay.tar.gz` and restore `<backup-dir>/cloudflared-stremio-legacy-config.yml` to `/etc/cloudflared-stremio-legacy/config.yml` if that ingress was lost.
6. `systemctl daemon-reload && systemctl restart habbo-stack habbo-static habbo-websockify cloudflared-stremio-legacy`
7. `/srv/habbo/ops/smoke-test.sh && /srv/habbo/ops/public-web-smoke.sh`

## Fresh VPS1 client acceptance

Historical FINAL-v2 R39 and V31 evidence remains PASS and was not reinvestigated.

Fresh VPS1 R39 is PASS: native Adobe Flash Player 32.0.0.465 authenticated RogerVideo, held TCP 12323, loaded room 1000, rendered the avatar and produced a real Havana WALK with before/after framebuffer evidence.

Fresh VPS1 V31 is also PASS end-to-end through the validated hiperesp + PRoot 5.4 filesystem-only + explicit QEMU i386 9.2.4 + Wine32 5.11 path. The final clean session produced INIT_CRYPTO, GENERATEKEY, VERSIONCHECK, UNIQUEID, GET_SESSION_PARAMETERS and SSO, authenticated RogerVideo, then GET_INFO/navigation, TRYFLAT, GOTOFLAT and GETROOMAD. Room 1000 `RogerVideo Lab` rendered the avatar, and a floor click produced Havana `Received (WALK): 75 / AKPBQA` at `2026-09-23T20:45:23.814Z`. The before/after framebuffer changed 33474 pixels.

The one-use SSO was cleared after authentication and before final evidence capture. Final V31 evidence is under `/srv/habbo/validation/final-evidence-20260923/` and is documented in `habbo-linux-checkpoint/VPS1_CLIENT_VALIDATION_20260923.md`.

Post-validation cleanup closed VNC/noVNC, Wine/QEMU/Xvfb/x11vnc/websockify and the temporary control-host SSH tunnel. Stale PRoot wrappers discovered during teardown were removed and the regression helper was hardened to clean them automatically. RogerVideo is offline with no active SSO, packet logging is false and the normal smoke test passes.

Canonical regression helper: `/srv/habbo/ops/v31-final-validate.sh`; versioned copy: `habbo-linux-checkpoint/vps1-overlay/v31-final-validate.sh`.

**No fresh graphical acceptance item remains pending.**

## Local web gate v0.8.5 — Chrome + Safari/WebKit PASS (2026-09-26)

This section records a **local ChatGPT lab checkpoint only**. It was **not deployed to VPS1 production** and does not replace the deployment architecture above.

Canonical Library checkpoint:
- `/Habbo 2009 Dual Linux/habbo-web-local-v0.8.5-chrome-safari-pass-20260926.zip`
- SHA-256 `4fb36dd2daa0f2e7a191a10649859ad7910020793ad29b0378c24f45409b0a4c`

Validated local topology:
- MariaDB `127.0.0.1:3307`;
- Havana V31 `12321`, MUS `12322`, R39 `12323`, RCON `12309`;
- legacy binary/assets origin `127.0.0.1:18080`;
- Havana-Web `18091`;
- frontend/proxy `18100`;
- both V31 and R39 are exposed to the browser through noVNC, so the user installs no plugin.

Chrome/PC integrated gate is PASS, including desktop/mobile responsive UI, Spanish controls, no SSO ticket in HTML, V31 and R39 gameplay after runtime restart, and no browser plugin requirement.

Safari/WebKit gate is PASS using Playwright 1.57.0 / WebKit build 2227 with Safari 26.0 / AppleWebKit 605.1.15 UA. Final gameplay proof:
- V31 room 1000 + touch WALK `AKRBQB`;
- R39 room 1000 + touch WALK `AKPBSA`;
- lifecycle R39 connected -> switch to V31 -> V31 connected -> explicit Reconectar -> V31 connected again;
- final reconnect measured at about 5.1 s;
- no SSO ticket in HTML;
- no `<object>` / `<embed>` plugin tags.

Safari/WebKit fixes persisted in the v0.8.5 checkpoint:
1. rewrite absolute legacy `http://localhost/...` web URLs to the local proxy;
2. mobile login layout exposes the real submit button instead of the legacy off-screen margin;
3. V31 startup tolerates clean transient RFB disconnects;
4. RFB connection watchdog retries a hung first connection attempt;
5. stale RFB callbacks cannot mutate a newer connection generation;
6. V31 restart cleans orphan listeners on dedicated VNC/noVNC ports `59131/18131`.

Git milestone:
- commit `3b6345092d93369c94242dbe5bf0cf421f2c78d4`;
- tag `habbo-web-local-v0.8.5-20260926`.

Operational rule: production remains untouched. Any future promotion must start from the v0.8.5 checkpoint and requires an explicit deployment gate.


### Post-close reproducibility audit v0.8.5 (2026-09-26)
- Re-materialized the canonical Library ZIP and independently recomputed SHA256: `4fb36dd2daa0f2e7a191a10649859ad7910020793ad29b0378c24f45409b0a4c` (exact match).
- Full internal `SHA256SUMS` manifest: PASS.
- Python compile audit: PASS.
- Critical regression scripts: PASS for Safari localhost rewrite/mobile layout, V31 Safari startup retry, stalled-RFB watchdog, stale VNC/websockify cleanup, V31 injector/socket contract, R39 native noVNC contract, and dual-runtime exclusion.
- Runtime closure audit: only local static listener `127.0.0.1:18080` remained; V31/R39/noVNC runtime listeners were not left running.
- Production remained untouched. Any promotion remains a separate explicit human deployment gate.

### v0.8.5 promotion preflight hardening (2026-09-26)
- Read-only target resolution confirmed production is `bridge-old` / hostname `secureme`; current MCVPS host `ES217221` is the VPS2/control-plane host and does not itself host `/srv/habbo` production.
- Read-only promotion preflight added at `habbo-linux-checkpoint/tools/habbo-v085-promotion-preflight.sh`.
- VPS1 product plane currently passes core checks: Habbo services active, public HTTP 200, latest backup exists and verifier PASS.
- Promotion is intentionally blocked by two validation-infrastructure issues: stale failed WebKit proof and VPS2 offsite recovery-store drift.
- Exact recovery drift is limited to the authenticated WebKit smoke pair: `/usr/local/sbin/habbo-public-webkit-daily.sh` and `/usr/local/sbin/habbo-public-webkit-smoke.py`.
- Root cause of the WebKit failure was reproduced: after `/me` had loaded, a final `networkidle` wait caused Playwright WebKit to report `Navigation failed because page crashed!`.
- A temporary non-installed smoke copy replacing only that final `networkidle` with a bounded visible-body wait passed the full iPhone 14 Plus `home+register+login+me` flow against the public site.
- Versioned WebKit smoke and daily wrapper were synchronized with the authenticated live logic and the safe settle fix; regression `test_webkit_authenticated_settle_v085.py` passes.
- Git checkpoint: `3ca250b888c6bba6e066ca8fc3a3ca8be908d384`, tag `habbo-web-local-v0.8.5-preflight-20260926`.
- No production file, unit, tunnel, database or service was modified. Promotion remains gated.

### Canonical VPS2 recovery-kit refresh dry-run (2026-09-26)
- Executed a temporary copy of `/srv/habbo/ops/refresh-vps2-control-plane-kit.sh` on VPS1 with a hard stop injected immediately after staged recovery validation and before the lock/live promotion block.
- Canonical staged recovery smoke PASS: 23 files, 11 scripts, 12 units, exact hashes/inventory, syntax, ExecStart references and bootstrap rehearsal all valid.
- This independently confirms the recovery-store drift is reconcilable by the existing supported refresh path after the WebKit runner correction.
- The dry-run exited before `flock` and before any write to `/srv/habbo/releases/disaster`; production/recovery state remained unchanged.
- Further progress now requires the explicit live-change gate: install the versioned WebKit smoke on VPS2, refresh/promote the VPS2 recovery kit on VPS1, create/verify a fresh backup, pull/verify it offsite, then rerun the read-only v0.8.5 promotion preflight.

### v0.8.5 promotion preflight READY (2026-09-26)
- Validation/recovery infrastructure was reconciled without deploying v0.8.5 application/frontend/runtime code.
- Real WebKit iPhone 14 Plus authenticated smoke now PASS for `home+register+login+me`; failure latch clear.
- Recovery-store contract now preserves old generations as self-consistent immutable recovery artifacts while requiring only `LATEST` to match the live VPS2 control plane.
- VPS2 heartbeat updated to consume that explicit contract and now PASS with 4/4 timers, 0 failed units, 3 valid offsite generations and deterministic recovery fingerprint.
- VPS1 disaster-source smoke cleanup trap fixed; offline Havana bundle clone/fsck PASS.
- Final recovery kit regenerated and validated: 23 files, 11 scripts, 12 units, exact inventory/hashes, bootstrap rehearsal PASS.
- Final latest backup: `/srv/habbo/backups/manual-20260926T070100Z`; isolated DB restore PASS (88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1).
- Matching VPS2 offsite archive: `/var/backups/habbo-vps1/manual-20260926T070100Z.tar.gz`; retained-generation store smoke PASS.
- Runtime health marker and disaster drill refreshed against the same latest backup.
- `/etc/cloudflared-stremio-legacy/config.yml` corrected to `0600 root:root`; secret-permissions smoke PASS.
- Final `habbo-status.sh`: `OVERALL READY`.
- Final v0.8.5 read-only promotion preflight: `PROMOTION_PREFLIGHT_PASS`, blockers=0, warnings=0.
- Final aggregate `/srv/habbo/ops/deployment-final-validate.sh`: PASS.
- Product promotion is still gated and has not occurred.

### v0.8.5 production promotion (2026-09-26)
- Preflight was green before promotion: `PROMOTION_PREFLIGHT_PASS`, recovery/backup/control-plane checks healthy.
- v0.8.5 frontend service is `habbo-web-v085.service` on `127.0.0.1:18100`; historical static assets remain on `18080`.
- Canary WebKit iPhone 14 Plus PASS: home/register/login/me, V31 native Director/Wine noVNC, R39 native Flash noVNC.
- First transient Cloudflare cutover failed only at public V31 noVNC because WebSocket ingress paths were omitted; login still passed.
- Immediate rollback restored `cloudflared-stremio-legacy.service` active and the old public path.
- Root cause: v0.8.5 already emitted `wss://habbo.gamemodai.pro/v31-websockify` and `/r39-websockify`; Cloudflare needed explicit path routing.
- Corrected ingress routes `/v31-websockify` to `18131` and `/r39-websockify` to `18139`, default Habbo web to `18100`, static historical paths to `18080`.
- Corrected staged config passed `cloudflared tunnel ingress validate: OK`.
- Second transient cutover PASS end-to-end over the public domain: home/register/login/me + V31 noVNC + R39 native Flash noVNC.
- Validated config was installed persistently at `/etc/cloudflared-stremio-legacy/config.yml`, mode `0600 root:root`.
- Persistent `cloudflared-stremio-legacy.service` was active before the transient cutover unit was stopped; final switch state persistent=active, transient=inactive.
- Non-secret ingress fragment is versioned at `habbo-linux-checkpoint/vps1-overlay/cloudflared-v085-habbo-ingress.yml`.
- Deployment record commit: `77a1216` on `project/habbo-2009-dual-linux-vps1-deploy-20260923`.
- Pre-v0.8.5 Cloudflare configuration backup retained on VPS1 for rollback.

### v0.8.5 production recovery closure (2026-09-26)
- Persistent public cutover is complete: `habbo-web-v085.service` serves `127.0.0.1:18100`; Cloudflare routes V31 WS -> `18131`, R39 WS -> `18139`, historical assets -> `18080`, Habbo catchall -> `18100`.
- Public WebKit/iPhone 14 Plus and Chromium desktop both passed authenticated V31 -> R39 noVNC E2E after the persistent cutover. R39 uses native Adobe Flash Player server-side; browsers receive only noVNC. No SSO ticket or plugin object/embed is exposed in browser HTML.
- Recovery contract was reconciled with the actual canonical release `/srv/habbo/releases/v0.8.5-prod-20260926`: backup includes the release tarball plus `habbo-web-v085.service`, and verifier checks upstream/bind ports, V31 proxy origin, WebSocket routes and Cloudflare metrics pin.
- Canonical post-deploy backup `/srv/habbo/backups/manual-20260926T090032Z` passed complete manifest verification and isolated DB restore (88 tables / 40 navigator styles / RogerVideo=1 / room1000=1).
- Matching VPS2 offsite archive and store smoke PASS; local backup retention reduced to 16 protected generations.
- Runtime health marker and disaster drill both reference `manual-20260926T090032Z`; disaster restore drill PASS in tmpfs.
- Final aggregate deployment validator PASS. Production v0.8.5 is therefore deployed, recoverable and covered by the normal health/backup/disaster pipeline.

### Post-deploy soak — WebKit asset cancellation hardening (2026-09-26)
- Soak after v0.8.5 promotion found no service restarts and no Habbo/Cloudflare errors after the expected controlled restart window; public core routes/assets remained HTTP 200.
- Official WebKit smoke was hardened for a WebKit-only `Load request cancelled` on `/local-web/habbo-es.js`: it is ignored only when the same path has a recorded HTTP 200 response. Other request failures remain fatal.
- Two temporary real runs plus the official systemd run PASS; `WEBKIT_FAILED` cleared.
- VPS2 recovery kit regenerated, backup `/srv/habbo/backups/manual-20260926T091819Z` verified/restored, matching offsite generation PASS, runtime health PASS, disaster drill PASS and final deployment validator PASS.
- Recovery fingerprint after this control-plane update: `23bf18e3ff0366c6f517a971e1c1503c56e43c45fae7987ed88b209eea75c981`.

### Periodic gameplay + offsite restore closure (2026-09-26)
- Daily WebKit monitoring now proves the authenticated V31 -> R39 gameplay transport, not only home/register/login/me. V31 and R39 must each establish their public noVNC connection and must not leak SSO/plugin markup to the browser.
- VPS1 `public-webkit-remote-smoke.sh` requires scenario `home+register+login+me+V31+R39`; the repo regression enforces the same contract.
- Third-party request cancellations during the gameplay pages do not fail the smoke; first-party HTTP/request failures and JS errors still do.
- VPS2 offsite restore drill pin was reconciled with the canonical Havana bundle SHA `9e3ee88b2670e7156c7c05bca13646b9d5378e1b8d83f3a7f2eb53fefa344a4f`.
- Canonical generation `/srv/habbo/backups/manual-20260926T093550Z` passed local restore, VPS2 store smoke, VPS2 isolated restore, runtime health, VPS1 disaster drill and aggregate final validation.
- Backup SHA256: `4eb59c3b6ee937b2cee95ae844f5c90d3d9c4c703d4b4bd10da7cd9e23a40095`; recovery fingerprint: `d35f3a8faf8d46133ae96874e5996147a8d9c6515a4236771740cf7f1e9adf13`.

### Smoke-owned runtime cleanup (2026-09-26)
- Daily WebKit gameplay monitoring now records pre-smoke V31/R39 health and cleans up only runtimes it started itself.
- Cleanup preserves any runtime that was already healthy before monitoring and also refuses to stop a smoke-owned runtime while an established WebSocket connection exists on `18131`/`18139`.
- Cleanup runs through an EXIT trap, so failed browser checks do not leave orphaned V31/R39 runtime processes.
- Verified official systemd smoke PASS (`home+register+login+me+V31+R39`, attempts=1) followed by both runtime controls reporting `healthy=no` and no VNC/WebSocket listeners.
- Daily backup retention was confirmed already automatic inside `habbo-backup-daily.sh`; no redundant retention unit was introduced.
- Canonical generation `/srv/habbo/backups/manual-20260926T095026Z` passed local restore, retention (16 protected generations), VPS2 store smoke, isolated offsite restore, runtime health, disaster drill and final aggregate validator.
- Backup SHA256: `edcabb2b3f34b430d85a666fd12d8ecd5aeba82194dfc15c2d2f3131ff4c2c1e`; recovery fingerprint: `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.

### Recovery ops-overlay hygiene closure (2026-09-26)
- Drift audit found one inactive historical verifier copy inside `/srv/habbo/ops`; because backups archive the complete ops tree, it was also present in recovery overlays.
- Historical verifier moved to `/srv/habbo/backups/ops-history/` and removed from the active ops tree.
- Backup contract excludes `ops/*.pre-*`, `ops/*.bak*` and `ops/*~`; restore verifier explicitly fails if any of those patterns appear inside `ops-overlay.tar.gz`.
- Canonical clean backup `/srv/habbo/backups/manual-20260926T095727Z` passed local restore, overlay hygiene check, VPS2 store smoke, VPS2 isolated restore, runtime health, VPS1 disaster drill and final aggregate validation.
- Backup SHA256 `d821a8e02b03517d89d844a81d7bcbf5bebc79581338df793ed8152bae53d787`; recovery fingerprint `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.

### Daily backup retention boundary closure (2026-09-26)
- Fixed ordering in `/srv/habbo/ops/habbo-backup-daily.sh`: retention now runs after backup publication and before runtime health, preventing the temporary 21st generation from tripping the max-20 disk-health contract before pruning can run.
- Real edge test PASS: 18 -> 19 -> 20 local backups; official daily service then completed successfully and retention reduced the set to 16 before health validation.
- Runtime marker, offsite archive/restore and disaster drill all converge on `/srv/habbo/backups/manual-20260926T100752Z`.
- Offsite archive SHA256: `8ab94f7b366366e0102f69e743cae5e6960d37b9906c45450bcd41b1bbac3380`; recovery fingerprint `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.
- Final deployment validator PASS with 16 local backup generations.

### Operational mirror drift closure (2026-09-26)
- Versioned VPS1/VPS2 critical operations and systemd definitions were compared byte-for-byte with the proven live files.
- Repo-only lag was reconciled for the production validator, disaster restore drill and status script; all other observed drifts were EOF normalization only.
- Final exact mirror audit: `VPS1_EXACT_DIFFS=0`, `VPS2_EXACT_DIFFS=0` for the audited critical set.
- No live production behavior changed during this mirror reconciliation; the already-green runtime, backup, WebKit gameplay, offsite restore and disaster-recovery state remained untouched.
- Historical Havana bundle SHA `77672bee...` is explicitly documented as superseded by current recovery pin `9e3ee88b2670e7156c7c05bca13646b9d5378e1b8d83f3a7f2eb53fefa344a4f`.

### First autonomous post-hardening cycle (2026-09-26)
- The normal timers generated `/srv/habbo/backups/manual-20260926T100752Z` without manual intervention after the gameplay/recovery hardening.
- Latest backup verification + isolated local restore PASS; scheduled VPS2 pull matched latest; offsite restore drill restored that exact generation with SHA256 `8ab94f7b366366e0102f69e743cae5e6960d37b9906c45450bcd41b1bbac3380`.
- VPS2 control-plane heartbeat: 4/4 timers healthy, no failed units, latch clear, recovery fingerprint `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.
- Local retention self-pruned to 16 protected backups.
- Final aggregate deployment validator PASS against `100752Z`; Habbo remained HTTP 200 and `OVERALL READY`.

### Official-cycle idempotency proof (2026-09-26)
- Re-ran the production backup path through `habbo-backup-daily.service`; it created `/srv/habbo/backups/manual-20260926T103715Z`, pruned back to 16 managed generations and advanced runtime health to that exact backup.
- Ran the official VPS2 pull + store smoke + isolated offsite restore on the same generation; archive SHA256 `05b2263830d32433937a4d6094774f8a1156e971c97d87bf9e490965841140d4`.
- VPS2 heartbeat and VPS1 disaster drill both PASS; disaster drill references `manual-20260926T103715Z`.
- Final aggregate validator PASS with the complete WebKit gameplay scenario and `OVERALL READY` preserved.
- This is a repeatability/idempotency proof of the existing production automation, not a new deployment change.

### Scheduled daily backup path rehearsal (2026-09-26)
- Forced the exact timer target `habbo-backup-daily.service` through a full production run.
- Generated canonical generation `/srv/habbo/backups/manual-20260926T104813Z`; retention pruned one stale generation and left 16 protected backups, preserving `LATEST`, referenced drill/restore generations and milestones.
- Runtime health advanced to the new backup in the same service run.
- Matching VPS2 pull, offsite store smoke, isolated offsite restore, VPS2 heartbeat and VPS1 disaster drill all PASS for `104813Z`.
- Aggregate deployment validator PASS afterwards; scheduled backup path is therefore verified end-to-end, not only its individual scripts.

### Scheduled operations and postboot rehearsal (2026-09-26)
- Real daily timer target `habbo-backup-daily.service` PASS end-to-end, producing `manual-20260926T104813Z`, pruning to 16 protected local generations and advancing runtime health to the new backup.
- Matching VPS2 pull + isolated offsite restore PASS; VPS1 disaster drill + aggregate deployment validator PASS on the same generation.
- `habbo-postboot-validate.service` was restarted deliberately as a boot-path rehearsal and PASSed immediately, refreshing the postboot stamp to `104813Z`; Habbo public HTTP remained 200.
- `systemd-analyze verify` on all relevant Habbo units/timers across VPS1/VPS2 found no Habbo-specific syntax, ordering or dependency errors.

### Wide mirror + natural runtime timer proof (2026-09-26)
- Extended the live/repo drift audit beyond the earlier critical subset. VPS2 remained zero-drift; VPS1 showed 9 EOF-only differences and 3 functional repo-only lags for already-proven live v0.8.5 smoke validators.
- Mirrored the exact live validators into Git: Cloudflare ingress checks now include `18100/18131/18139`, perimeter checks cover the v0.8.5 frontend/WebSocket paths, and public-web smoke includes `/play`, localized assets and noVNC `rfb.js`.
- No production runtime file changed during reconciliation.
- Observed the 15-minute runtime health timer fire naturally at 13:00:06 CEST; service exit=0 at 13:00:15 and `/run/habbo-runtime-health` continued to reference `manual-20260926T104813Z`.
- All Habbo recovery/health timers on both VPSs are enabled and use `Persistent=true`.

# VPS1 public web publication and iPhone connectivity — 2026-09-23

## Symptom sequence and root cause

The first Safari failure was caused by a missing public DNS record for `habbo.gamemodai.pro`; that was corrected through the existing Cloudflare Tunnel.

After DNS publication, the user still reported that the site would not load correctly from iPhone. Reproduction from VPS2/control host `ES217221` then showed a second, independent problem: the dynamic HTML returned HTTP 200, but core Havana frontend files such as `landing.js` and `frontpage.css` returned HTTP 404.

Two deployment details caused the remaining problem:
1. the Havana checkout had an incomplete `tools/www` tree; Havana distributes the legacy web assets separately;
2. Cloudflare still routed `/web-gallery`, `/styles` and `/js` to the static server on port 18080, bypassing the completed Havana web tree on port 18081.

## Final public architecture

Cloudflare ingress on VPS1:
- `/c_images`, `/client`, `/gordon`, `/dcr`, `/flash` -> `http://127.0.0.1:18080` (`habbo-static`);
- all other `habbo.gamemodai.pro` traffic, including `/web-gallery`, `/styles`, `/js` and dynamic pages -> `http://127.0.0.1:18081` (Havana web).

MariaDB, Shockwave, MUS, Flash and RCON remain loopback-only. No Habbo firewall opening was added. The existing Stremio ingress continues to use the same Cloudflare connector.

## Frontend overlay

Upstream Havana documentation requires the separate `havana_www` bundle to populate `tools/www`.

Verified source bundle:
- file: `havana_www_10_09_2024.7z`;
- size: 508016467 bytes;
- SHA-256: `877273abddab946849aed3d5d2416185fe175a7207a602890fd08ebe7e376ed0`;
- archive integrity: PASS.

Only the required `web-gallery` tree was retained: 1030 files, approximately 24 MB.

Persistent VPS1 overlay:
`/srv/habbo/web-frontend-assets`

`docker-compose.yml` bind-mounts:
- `web-gallery` -> `/havana-web/tools/www/web-gallery`;
- `styles` -> `/havana-web/tools/www/styles`;
- `js` -> `/havana-web/tools/www/js`;
- `images` -> `/havana-web/tools/www/images`.

Core file hashes:
- `landing.js`: `3eb27fe0dd38e96b743c02f8e36a161cae84c593c8022f508facb154a5be2a99`;
- `frontpage.css`: `fe15fb858023252f0acdb4b049bef4046c4c67bd833c05633004d635abbe587a`;
- `favicon.ico`: `ec6b2907037b7bd4e7ac7fbc0c9be8b1106999f5a15534b66d8af0a68c4098a4`.

Compatibility:
- `/web-gallery/v2/images/dialogs` links to the official legacy dialogs tree;
- `/images/progress_bubbles.gif` is exposed from the official bundle;
- `/styles/local/uk.css` and `/js/local/uk.js` are harmless empty compatibility paths; the upstream local UK JS is itself empty.

A few old CSS selectors still reference decorative image names absent from both the verified `havana_www` archive and the current Quackster Havana-www/Kepler-www trees. They are not critical page payload.

## Validation and CDN cache

The live origin is validated by `/srv/habbo/ops/public-web-smoke.sh`. It uses an iPhone Safari user agent, retries transient VPS2 resolver/network errors and sends `Cache-Control: no-cache` plus `Pragma: no-cache` so stale CDN objects cannot hide the current origin state.

Final result:
- public web smoke from VPS1: PASS;
- public web smoke from VPS2: PASS;
- `/` and `/register`: HTTP 200;
- core JS/CSS/favicon: HTTP 200;
- compatibility dialog/progress assets: HTTP 200 when revalidated against origin;
- R39 variables and V31 DCR: HTTP 200;
- backend Habbo smoke: PASS.

Cloudflare had retained some pre-fix decorative 404 responses with `max-age=14400`. A normal cached request could temporarily return the old 404 while the same URL with no-cache or a cache-busting query reached the repaired origin and returned HTTP 200. This is CDN cache state, not an origin connectivity failure.

VPS2 also showed isolated resolver/network timeouts during repeated tests; retrying succeeded and independent requests continued resolving the hostname.

## Operations and recovery

Public smoke:
`/srv/habbo/ops/public-web-smoke.sh`

Backup workflow:
`/srv/habbo/ops/backup.sh`

The backup now stores the persistent frontend overlay as:
`web-frontend-overlay.tar.gz`

Latest verified post-fix backup:
`/srv/habbo/backups/manual-20260923T215347Z`

That backup passes `gzip -t` and every entry in `SHA256SUMS`, and contains the frontend overlay, Cloudflare configuration, compose file, ops helpers, project context and DB dump.

The earlier database restore-roundtrip-tested backup remains:
`/srv/habbo/backups/manual-20260923T183558Z`

## Regression status

After the final Cloudflare routing correction:
- `habbo-stack`: active;
- `habbo-static`: active;
- `habbo-websockify`: active;
- `cloudflared-stremio-legacy`: active;
- Docker: active;
- nginx: active;
- Stremio public endpoint: expected HTTP 307;
- Habbo backend smoke: PASS;
- public smoke from VPS1 and VPS2: PASS.

The canonical FINAL-v2 ZIP remains unchanged with SHA-256 `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`. This repair is a VPS1 deployment/publication overlay, so no new canonical release is created.

## Guard hardening 2026-09-24

- Added `vps1-overlay/public-web-direct-assets-audit.py` and wired it into `public-web-smoke.sh`.
- The audit requests `/` and `/register` through the real public hostname with an iPhone Safari user-agent, discovers direct CSS/JS/image/client assets, requires HTTP 2xx/3xx, and rejects asset URLs that unexpectedly return `text/html`.
- Current validation: 23 direct assets PASS from VPS1 and independently from VPS2.
- A broader CSS URL scan surfaced 15 legacy references tied to unused IE compatibility, minimail/tagging, or obsolete landing selectors; they are not requested by the current iPhone pages and were deliberately not replaced with fake assets.
- Live guard hashes: `public-web-smoke.sh` = `de930782a7bddca879e1186a259197ddd9e66b88547c1e2d69bbd569afab82ce`; `public-web-direct-assets-audit.py` = `4bf05514f6896a1ae29ad4a1f678560a64c5eccda39431b00a6825785897b432`.
- Internal Habbo smoke and public smoke remain PASS; FINAL-v2 is unchanged.

## Homepage JavaScript dependency fix 2026-09-24

A headless mobile-browser probe from VPS2 reproduced the public homepage with an iPhone Safari user-agent and touch/mobile viewport. HTTP and asset checks were already clean, but JavaScript raised `ReferenceError: deconcept is not defined`.

Root cause:
- production uses `index_v32.tpl`;
- that template loaded `landing.js` directly;
- `landing.js` uses `deconcept.SWFObjectUtil`;
- `deconcept` is defined by `web-gallery/static/js/libs2.js`;
- the legacy `index_old.tpl` already had the correct `libs2.js -> landing.js` ordering, while `index_v32.tpl` did not.

Persistent fix:
- overlay template: `/srv/habbo/web-frontend-assets/templates/index_v32.tpl`;
- Compose bind mount: `/srv/habbo/web-frontend-assets/templates/index_v32.tpl:/havana-web/tools/www-tpl/default/index_v32.tpl:ro`;
- reproducible helper: `/srv/habbo/ops/ensure-home-libs2-overlay.sh`;\n- The overlay helper writes the destination in place instead of replacing the file, preserving the inode used by Docker's single-file bind mount. This was regression-tested by running the helper while `havana-web` was live: the mounted inode remained stable and `libs2.js -> landing.js` stayed active without another container recreate.
- `public-web-direct-assets-audit.py` now fails if `libs2.js` is missing or appears after `landing.js`.

Post-fix browser validation from VPS2:
- `/`: HTTP 200, title `Habbo 2009 ~ Home`, 0 HTTP 4xx/5xx, 0 console errors, 0 page errors;
- `/register`: HTTP 200, title `Habbo 2009: Register`, 0 HTTP 4xx/5xx, 0 console errors, 0 page errors;
- the only failed request was the unrelated legacy Quantserve tracking pixel (`net::ERR_ABORTED`), which does not participate in rendering or application logic.

Network notes:
- Cloudflare serves IPv4 and AAAA records and HTTP/2/TLS validation succeeds;
- VPS1 and VPS2 themselves have no global IPv6 route, so direct `curl -6` failure on those hosts is not evidence of a public IPv6/Cloudflare defect;
- gzip, Brotli and zstd responses were all successfully negotiated over IPv4.

Live hashes:
- `web-frontend-assets/templates/index_v32.tpl`: `142ed3022792a11b6b9d16c29e5f6648d1d8fd5805276af0e88075c890a60e50`;
- `ops/ensure-home-libs2-overlay.sh`: `aefb96afd6df4b9499b6f6afc4536b9998b911524fa81902df4bed7b769cc745`;
- `ops/public-web-direct-assets-audit.py`: `cef006508dcc5368d0af8a974944a2199c9eec0b22f37b7766c3d3e5bf55c21f`;
- `docker-compose.yml`: `e54aecdff9052ae6d60db2e679cfefcde34950e1463ab8c3ea7e1dfa920b525c`.

FINAL-v2 remains unchanged.

## WebKit iPhone validation 2026-09-24

A real Playwright WebKit run was added from VPS2/control host using the built-in `iPhone 14 Plus` device profile. This goes beyond Chrome with an iPhone user-agent and exercises the WebKit engine.

Results:
- `/`: HTTP 200, `Habbo 2009 ~ Home`, 0 HTTP failures, 0 request failures, 0 console errors, 0 page errors.
- `/register`: HTTP 200, `Habbo 2009: Register`, 0 HTTP failures, 0 request failures, 0 console errors, 0 page errors.
- Physical touchscreen coordinates derived from `visualViewport.scale` successfully focus `#login-username`.
- A physical touchscreen tap on the visible `REGISTER FOR FREE` link navigates to `/register`.
- A physical touchscreen tap toggles the registration marketing checkbox without submitting any form.
- The legacy page intentionally uses the classic 980px layout viewport with no `meta viewport`; WebKit scales it to approximately `0.436735` on the iPhone 14 Plus profile. This matches legacy Safari behavior and was left unchanged to avoid breaking the 2009 layout.

Reusable test:
- `vps1-overlay/public-web-webkit-smoke.py`
- live VPS1 copy: `/srv/habbo/ops/public-web-webkit-smoke.py`
- run it from a control host that has Python Playwright and the WebKit browser installed.
- SHA-256: `30318a3ab36ec0cb4b5adbbdbf0c11d67d4a70a9a31c5ff661dbcf166f85be2e`.

No forms are submitted by the test and no account is created.

## Backup restore round-trip 2026-09-24

The current backup recovery path was revalidated non-destructively.

- Added `vps1-overlay/verify-latest-backup.sh`, live as `/srv/habbo/ops/verify-latest-backup.sh`.
- It verifies `SHA256SUMS`, checks `havana.sql.gz`, extracts `ops-overlay.tar.gz` and `web-frontend-overlay.tar.gz` into `/dev/shm`, checks critical recovery files and the homepage `libs2.js` overlay, then restores the SQL dump into a temporary MariaDB database.
- The production `havana` database is never overwritten; a trap removes the temporary restore database on success or failure.
- The normal `havana` DB user cannot create arbitrary databases, so the verifier uses the container-local MariaDB root credential only for the temporary restore. The secret is never printed or exported.
- Round-trip result against `/srv/habbo/backups/manual-20260924T015114Z`: PASS with 88 tables, 40 `navigator_styles`, `RogerVideo=1`, and `room1000=1`.
- Restore documentation now uses `web-frontend-overlay.tar.gz` and extracts it under `/srv/habbo`, matching the actual current backup format.
- Live verifier SHA-256: `bf4a5d86da26b05b56a45af00b8f58ecc3e8097ba854d5ff2424ef6af4505751`.

## Operational restart and backup promotion 2026-09-24

Boot/restart resilience was validated after the public/WebKit fixes.

- `habbo-stack`, `habbo-static`, `habbo-websockify`, `cloudflared-stremio-legacy`, Docker and nginx are all both `enabled` and `active`.
- Compose restart policies for MariaDB, Havana server and Havana web are `unless-stopped`.
- A controlled restart of `habbo-stack`, `habbo-static` and `habbo-websockify` completed successfully.
- After restart: MariaDB returned healthy, internal smoke PASS, public iPhone asset smoke PASS, and WebKit iPhone smoke PASS.
- The single-file `index_v32.tpl` bind mount retained the same inode on host and inside the container after restart, with `libs2.js` still preceding `landing.js`.
- `systemd-analyze verify` reports no Habbo-unit errors; the only messages observed were unrelated host warnings from `snapd.service` and `rc-local.service`.

Backup promotion is now guarded:
- `backup.sh` creates the backup and checksum manifest, then calls `verify-latest-backup.sh <new-backup>`.
- Only after the restore verifier passes does it update `/srv/habbo/LATEST_PUBLIC_WEB_BACKUP`.
- Therefore the latest pointer no longer advances to an untested backup.
- First backup promoted through this guarded workflow: `/srv/habbo/backups/manual-20260924T020014Z`, restore PASS with 88 tables, 40 `navigator_styles`, `RogerVideo=1`, `room1000=1`.
- Live `backup.sh` SHA-256: `fd19f562dc3ef1c77ac1c278c74cc4a47c55159f32efca0f103e649ffcefb586`.

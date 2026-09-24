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
- reproducible helper: `/srv/habbo/ops/ensure-home-libs2-overlay.sh`;
- The overlay helper writes the destination in place instead of replacing the file, preserving the inode used by Docker's single-file bind mount. This was regression-tested by running the helper while `havana-web` was live: the mounted inode remained stable and `libs2.js -> landing.js` stayed active without another container recreate.
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

## Network perimeter and aggregate validator 2026-09-24

The Habbo publication boundary was explicitly audited from both VPS1 and VPS2.

- Sensitive Habbo ports `13307`, `12309`, `12321-12323`, `18080-18082` listen only on `127.0.0.1`.
- An external probe from VPS2 to VPS1 public IP `85.208.23.189` confirmed all eight sensitive ports are closed/filtered externally, while expected host-level ports 80/443/22 remain reachable.
- nginx has no `server_name habbo.gamemodai.pro`; Habbo public ingress exists only in the Cloudflare Tunnel config.
- Forcing `habbo.gamemodai.pro` directly to the VPS1 public IP fails normal TLS hostname verification. Ignoring TLS reaches the default nginx/Stremio redirect rather than Habbo, so the Habbo origin is not directly addressable as that hostname.
- Added `vps1-overlay/network-perimeter-smoke.sh`, live at `/srv/habbo/ops/network-perimeter-smoke.sh`, SHA-256 `4494004578fcfea90b63c7bfb3ae90b57dc26cc5af875d5f83baa31e45601159`.
- Added `vps1-overlay/deployment-final-validate.sh`, live at `/srv/habbo/ops/deployment-final-validate.sh`, SHA-256 `9de8e7995720303f5cb9de1ba376374f9444e841069f8275aceb8b7eecfd5a78`.
- The aggregate validator checks enabled/active units, immutable FINAL-v2 SHA-256, backend smoke, network perimeter, public/iPhone asset smoke and a full temporary-database restore of the latest backup.
- Full aggregate validation against `/srv/habbo/backups/manual-20260924T020550Z`: PASS.
- `verify-latest-backup.sh` now also requires the network perimeter and aggregate validator scripts to exist in each promoted backup; live SHA-256 `54648f6d379396af136b1917aa52d48ed2df36378c48d80a68ffa293763139b1`.

## Backup disk safety 2026-09-24

The backup workflow now includes a disk-space safety guard.

- `backup.sh` refuses to begin when the filesystem containing `/srv/habbo` has less than 1 GiB free.
- This check occurs before creating the new backup directory, so a low-space condition cannot advance the latest pointer or leave a half-created promoted backup.
- Added `vps1-overlay/backup-retention-report.sh`, live at `/srv/habbo/ops/backup-retention-report.sh`.
- The retention tool is deliberately non-destructive: it reports `KEEP` and `CANDIDATE` entries only. It defaults to preserving the eight newest backups, the known restore milestone `manual-20260923T183558Z`, and the current latest backup. It never deletes anything.
- Current backup footprint at the time of this validation was about 178 MB across 24 backups, while the root filesystem had about 2.0 GiB free. Backups are therefore not the primary source of disk usage.
- First backup validated with these tools included: `/srv/habbo/backups/manual-20260924T020824Z`.
- Live hashes at this point: `backup.sh` = `ac20853b52179953c9e6f4c08b7cef89da18adf176c5962fbc42c4aac3461459`; `backup-retention-report.sh` = `85ba3a33b8ec7f3d076ce413799008230ae9006b63162c38aa22ad3379c1575d`; `verify-latest-backup.sh` = `caac39b9f4acdc39370bab9b704e3f60b4f96986e658ac1e4b51b722cba26585`.

## Disk health validation 2026-09-24

Disk-related operational failure modes are now part of deployment validation.

- Added `vps1-overlay/disk-health-smoke.sh`, live as `/srv/habbo/ops/disk-health-smoke.sh`.
- It requires at least 1 GiB free on the filesystem containing `/srv/habbo`.
- It fails if Habbo backups exceed 1 GiB.
- It verifies the three Habbo Docker containers use `json-file` logging with `max-size=20m` and `max-file=3`.
- It fails if a stale `habbo_restore_verify_*` database remains after restore validation.
- It requires the latest-backup pointer to reference an existing directory.
- Validation result at introduction: PASS with about 1.94 GiB free, about 199 MiB of backups, Docker log rotation `20m × 3`, and zero stale restore databases.
- Current Habbo Docker logs were tiny: MariaDB about 60 KiB, Havana server about 128 KiB, Havana web about 16 KiB.
- `/srv/habbo` footprint was about 2.5 GiB; the largest intended trees were `v31` (~1.3 GiB) and `web` (~756 MiB), so they were not treated as disposable cache.
- `deployment-final-validate.sh` now runs the disk-health smoke before public/restore checks.
- `verify-latest-backup.sh` now requires the disk-health helper in every promoted backup.
- Live hashes: `disk-health-smoke.sh` = `9664b2833d1283d6e95c67068b189c28a743cecf322802a0ac95c97c1a9947ea`; `deployment-final-validate.sh` = `8bcb729d1bcb67b9b2f910b50696c86af502f4638becf631b374b9e5ba04366c`; `verify-latest-backup.sh` = `844ed21e196e8912700171e5b96ee16a61fd51361f76d8e37d207aa0567a18c8`.
- First backup containing and validating this guard: `/srv/habbo/backups/manual-20260924T021104Z`.

## Cloudflare ingress recovery 2026-09-24

The shared `cloudflared-stremio-legacy` connector was restarted deliberately while VPS2 continuously probed both public services.

Pre-restart:
- Habbo returned HTTP 200 over HTTP/2.
- Stremio returned the expected HTTP 307.
- The tunnel was enabled and active.

Observed restart window from VPS2:
- both services were healthy before the restart;
- a brief 502/530 window occurred while the connector had zero active connections;
- Habbo returned to HTTP 200 and Stremio to HTTP 307 by approximately 4.1 seconds from probe start;
- later isolated VPS2 request errors were not sustained and matched the previously observed control-host resolver/network flakiness.

Post-restart tunnel state:
- `cloudflared_tunnel_ha_connections = 4`;
- four active edge connections: two in `mad05` and two in `bcn01`;
- tunnel precheck completed with `hard_fail=false`, using HTTP/2;
- public Habbo and Stremio remained healthy after recovery.

Added `vps1-overlay/cloudflare-ingress-smoke.sh`, live at `/srv/habbo/ops/cloudflare-ingress-smoke.sh`.
The smoke requires:
- the shared tunnel unit enabled and active;
- at least two HA connections and at least two active edge connections;
- Habbo HTTP 200;
- Stremio HTTP 307.

It intentionally does not restart the shared tunnel during routine validation.
Live SHA-256: `966eea7ab7a4073664fd67381881b934c3f2463aaf1e072f0c32b3c15b69421f`.
`deployment-final-validate.sh` and `verify-latest-backup.sh` now include/require this guard.

## Post-boot readiness validation 2026-09-24

A boot-time readiness layer was added so the host can distinguish process startup from actual Habbo readiness.

- `/srv/habbo/ops/postboot-validate.sh` retries up to 18 times with five seconds between attempts.
- It checks backend smoke, network perimeter, disk health, shared Cloudflare ingress and public web readiness.
- It intentionally does not perform a temporary MariaDB restore on every boot.
- `habbo-postboot-validate.service` is enabled under `multi-user.target`, ordered after Docker, Habbo stack/static/websockify and the shared Cloudflare tunnel.
- On success the service remains `active (exited)` and writes `/run/habbo-postboot-validated` with UTC validation time, current latest-backup path and immutable FINAL-v2 SHA-256.
- Manual execution passed on attempt 1/18.
- After backup `/srv/habbo/backups/manual-20260924T022006Z`, the service was rerun and the stamp updated to that backup; aggregate deployment validation then passed.
- Backups now include `habbo-postboot-validate.service`; the restore verifier requires both unit and script.
- `deployment-final-validate.sh` requires the post-boot unit to be enabled/active and checks the stamp contains the canonical FINAL-v2 hash.

Live hashes:
- `postboot-validate.sh`: `77c7c5b7bb6d01c29c3e29b67472c2bd5aa03665e7215371f7e1adef93be3a36`
- `habbo-postboot-validate.service`: `b1aab325cbf01a6180830bd410ccd5c53b8d58c54df07203541bc13f791491b2`
- `backup.sh`: `533ddc9117ed1523c4b89c8939bf289d74194d9186c9ccf1e76faf1ac9518608`
- `verify-latest-backup.sh`: `c6e71c99b0cf1c165c760c2fd59c8bb90bdcccf95b2bb7ee54a12a0b084275aa`
- `deployment-final-validate.sh`: `d68d5dbf6a699e7cf76435c0f1501d6ca35c9f7e64f21b26e4648a8ce7823e60`

Git reconciliation commits:
- live backup script sync: `33a2d351e3e4a390ddbc919751fd6d23ba7d66df`
- live restore verifier sync: `fbf7560eb674730312296cf6be3c7730d18ebe40`
- live final validator sync: `07a322117abefe2df4a8d17c05360c1e87bc73e4`
- live post-boot script sync: `376445ab3cad8ffc253c964415bda106e80cf5ae`
- live post-boot unit sync: `4dd421566f8fe37b806b73519989de755aded0fc`

## Periodic runtime healthcheck 2026-09-24

A lightweight recurring watchdog was added for the live deployment.

- `/srv/habbo/ops/runtime-healthcheck.sh` runs backend, network perimeter, disk health, shared Cloudflare ingress and public web checks.
- It retries up to three times with five seconds between attempts.
- It does not restore the database and does not modify application state.
- `habbo-runtime-healthcheck.service` is a oneshot service.
- `habbo-runtime-healthcheck.timer` is enabled and active with `OnCalendar=*:0/15`, `Persistent=true`, and a 30-second randomized delay.
- On success it writes `/run/habbo-runtime-health` with UTC validation time, latest backup path and FINAL-v2 hash.
- The aggregate validator requires the timer enabled/active, last service result `success`, a valid bundle hash in the runtime stamp and stamp age <= 1800 seconds.
- Backups include the runtime service and timer, and the restore verifier requires both units plus the runtime script.

Automatic timer proof:
- first autonomous firing: 2026-09-24 04:30:22 CEST;
- completed: 04:30:27 CEST;
- result: success, exit status 0;
- runtime checks all PASS on attempt 1/3;
- next scheduled firing observed: 04:45:24 CEST;
- resulting stamp: `validated_at_utc=2026-09-24T02:30:27Z`, latest backup `manual-20260924T022749Z`, canonical FINAL-v2 hash.

Live hashes:
- `runtime-healthcheck.sh`: `294729c66ffbfde1cca34d6fecc74fefc3afafe393b308f3727caabaa8b9feb3`
- `habbo-runtime-healthcheck.service`: `10b46c1ffb1803b25cc6d8694550547008ec6e53263d91793519fb497a56b27a`
- `habbo-runtime-healthcheck.timer`: `70384a5d820feef629cf89970ca22971cef09f5042fe16a5ac1f16c44df36939`
- `backup.sh`: `3212c8d719f00bead7d5db5b83dcce58f4be83ffb8b33f309d1befe89a1bec88`
- `verify-latest-backup.sh`: `e823ebe57ba56a33197984573e9f963b505c4d67722e793d82428bd212aec32d`
- `deployment-final-validate.sh`: `1120dcf6c31c6e7a9b476c42ebc060564c9aa39f660ef966880526103d06fe89`

Git commits:
- runtime script: `5546ce632323b65f47e276529a4a91efcbeb4009`
- runtime service: `0874b5300038e02722295fca4e2ce3da93e03d50`
- runtime timer: `c0d50b2f46c2e3258e7998cc78392176fe0e04d2`
- backup sync: `43ebfbf61f8e02be93be945bf90344bf5f45c8c9`
- restore verifier sync: `c9ca8bacbd224fd1aa3ae0f3bcdbb0e6858786b6`
- final validator sync: `4cf3eec13f17ad4e18bb8de275a55a2300b51c78`

## Runtime failure detection and recovery 2026-09-24

The periodic watchdog was tested against a real controlled Habbo failure rather than only against healthy-state checks.

Failure injection:
- `habbo-static` was stopped briefly while MariaDB, Havana server, Cloudflare and Stremio were left untouched;
- direct runtime-healthcheck execution failed immediately because listener `127.0.0.1:18080` was missing;
- after `habbo-static` was restarted, the same runtime healthcheck returned PASS on attempt 1/3.

Systemd failure semantics were then tested:
- with `habbo-static` stopped, `habbo-runtime-healthcheck.service` ended with `Result=exit-code` and `ExecMainStatus=1`;
- the recurring timer remained active and retained its next scheduled run;
- after restoring `habbo-static`, resetting the failed state and running the service again, it returned `Result=success` and `ExecMainStatus=0` without re-enabling or recreating the timer.

A failure latch was added:
- `habbo-runtime-healthcheck.service` now has `OnFailure=habbo-runtime-healthcheck-failed.service`;
- `/srv/habbo/ops/runtime-healthcheck-failed.sh` writes `/run/habbo-runtime-health.failed` with failure time, unit result, exit status, current latest backup and recent healthcheck journal;
- a later successful `runtime-healthcheck.sh` removes the latch automatically;
- the aggregate deployment validator now fails if an unresolved failure latch exists.

Failure-latch round trip proof:
- injected outage produced `Result=exit-code`, `ExecMainStatus=1` and triggered the OnFailure dependency;
- failure latch was written at `2026-09-24T02:39:13Z` with the missing `127.0.0.1:18080` evidence in its journal;
- after recovery, the healthcheck returned `Result=success`, `ExecMainStatus=0` and the latch was removed;
- runtime timer remained active throughout.

Live hashes:
- `runtime-healthcheck.sh`: `c5bc7e00c64751542db4082fdffda69149f050a485492d544c5a30c1bf9f7bf7`
- `runtime-healthcheck-failed.sh`: `8469d15647f8ef913c28875f1bc22819091e79cddb239c8b837a429be074ec31`
- `habbo-runtime-healthcheck.service`: `04bbb27240cb0a8c27fd9ad9742300af0234a6897113080617836ed4be21f407`
- `habbo-runtime-healthcheck-failed.service`: `62d462b22d113247ed77792ba801ea4d1f3383cb96871b7009291ccfc117b92e`
- `backup.sh`: `1d1ff9d36b3bac106a05a322027cde7af2864c862f52b70ea65ad240ce17818d`
- `verify-latest-backup.sh`: `79bb3f86850116c59bd981b922b327e13222597136d84ebed4096dab1b0ed081`
- `deployment-final-validate.sh`: `eab4f5954bdefca2a8ac0262b0217f6c4bde43de786e45fc93a0a928a9501d03`

Git commits:
- runtime recovery sync: `3db66fc54c50629a08b96e22a5963244500ca11a`
- failure recorder script: `a2d188c3e3afa98c6d73b16d6f860316bf5cf49e`
- runtime service OnFailure wiring: `210c22f2f0b60526486c7fe5e271b25bcc1bac7b`
- failure recorder unit: `3e27c12d7017d687f2baa45a1ca93bbb2388086f`
- backup sync: `bc2743b87751902d9dc6ae6a832cdef1c50bf3ec`
- restore verifier sync: `d6e7cf86d938eca5ba5bb1694368f4d5502e34e7`
- final validator sync: `a506a521d774a643d96362f84ba4ff3bd375d3b4`

## Backup hardlink deduplication 2026-09-24

Future backups now deduplicate unchanged files against the previously promoted backup using hardlinks.

- The backup remains a complete directory tree with normal file paths and passes the same SHA256/restore validation.
- If a newly generated file is byte-identical to the same file in the previous backup, the new copy is replaced with a hardlink to the previous inode before `SHA256SUMS` is generated.
- No historical backups were rewritten or deleted.
- Deleting one hardlinked backup later does not invalidate another; storage is released only after the final link to a shared inode is removed.

First deduplicated backup proof:
- previous: `/srv/habbo/backups/manual-20260924T024249Z`;
- new: `/srv/habbo/backups/manual-20260924T024717Z`;
- restore verifier: PASS with 88 tables, 40 navigator_styles, RogerVideo=1, room1000=1;
- 14 files were hardlinked to the previous backup;
- deduplicated bytes: 10,712,735 bytes = 10.216 MiB;
- `web-frontend-overlay.tar.gz` in both backups has inode `251960`, link count 2 and size 10,664,307 bytes;
- physically unique large payload in the new backup was essentially `havana.sql.gz` (~851 KiB) plus the small changed `ops-overlay`.

Retention reporting was updated for hardlinks:
- `backup-retention-report.sh` now displays both apparent directory size and `reclaim_if_deleted_alone`;
- this avoids claiming that deleting a hardlinked backup would free blocks still referenced by another backup;
- it remains report-only and performs no deletion.

Live hashes:
- `backup.sh`: `95e8ff45a50187fffa8d30b63691b83d47e1c8573a10c030fba7c56b60fb3df8`
- `backup-retention-report.sh`: `6d5cb492c2193af8a3feeea5b5d88c2a19edda4a2dcf8953e5e4904071f8593c`

Git commits:
- backup hardlink dedupe: `7d9a35fa9cc4cc52c75e2544526efa31035b6bf8`
- hardlink-aware retention report: `d7608ead8775a926366c073d131d7d5fd64f9ecf`

Additional autonomous watchdog proof:
- at 04:45:18 CEST the timer fired without manual intervention;
- completed at 04:45:23 CEST with Result=success and ExecMainStatus=0;
- runtime stamp automatically advanced from backup `manual-20260924T023231Z` to `manual-20260924T024249Z`;
- latch remained clear;
- next timer execution was scheduled for 05:00:02 CEST.

## Operator status command 2026-09-24

A concise read-only deployment status command was added:

`/srv/habbo/ops/habbo-status.sh`

It does not restore the database or mutate application state. It summarizes:
- active/enabled state of Habbo stack, static service, websockify, Cloudflare and post-boot validator;
- runtime timer enabled/active state and last service result;
- immutable FINAL-v2 hash;
- latest backup path;
- post-boot and runtime stamp ages;
- unresolved runtime failure latch state;
- Cloudflare HA connection count;
- free disk and physical backup usage;
- Habbo and Stremio public HTTP codes;
- next/previous runtime timer schedule.

It exits 0 with `OVERALL READY` only when the summarized health criteria pass; otherwise it exits 1 with `OVERALL DEGRADED`.

Validation at introduction:
- all required services/timer OK;
- runtime last result `success`;
- FINAL-v2 hash OK;
- latest backup `manual-20260924T025022Z`;
- failure latch clear;
- Cloudflare HA connections: 4;
- about 1.82 GiB free;
- about 312 MiB physical backup usage;
- Habbo HTTP 200;
- Stremio HTTP 307;
- final result: `OVERALL READY`.

SHA-256:
- `habbo-status.sh`: `1a639e315d091b46f0f0ccd1c0ce523d0c5bdbad78b7f315788fa8fc5ab3e215`
- `verify-latest-backup.sh`: `54945be1e5254873fba00eb0dd4dba436b068ff92701cc4e52971cfd273f7b0f`

Git commits:
- status command: `6521df10dabe956bffac92aa75e7ec632270a2ad`
- verifier requirement: `432adb1e4c1fa36c6d256b622fdd1037881f8ffd`

## Runtime stamp/latest-backup consistency 2026-09-24

The operator status and aggregate validator now require the runtime health stamp to reference the current `LATEST_PUBLIC_WEB_BACKUP`.

Reason:
- a fresh backup can be promoted after the previous healthcheck ran;
- without this check, a recent runtime stamp with the correct FINAL-v2 hash could still refer to the previous backup and misleadingly report READY.

Validation:
- after promoting `manual-20260924T025424Z`, the old runtime stamp still referenced `manual-20260924T025022Z`;
- `habbo-status.sh` correctly reported `runtime backup match FAIL` and `OVERALL DEGRADED`;
- after running `habbo-runtime-healthcheck.service`, the stamp moved to `manual-20260924T025424Z`;
- status then reported `runtime backup match OK` and `OVERALL READY`.

The post-boot stamp is intentionally not required to match every later backup because it certifies boot readiness rather than each subsequent backup promotion.

Live hashes:
- `habbo-status.sh`: `6b0835df516ace213d7b1d73a3cbebe3b9e6eaf3c3c5177403b6a0621f428182`
- `deployment-final-validate.sh`: `3fde5c5bec70b680f41172166212526ec7894d6c3415343e1805e343d2fa7657`

Git commits:
- status consistency: `907b76e72b77d123e34a7d760089c2a057af7a26`
- aggregate validator consistency: `86d46f61e23e59c39f87c681c7838359da2371bf`

Second hardlink-dedupe proof:
- `manual-20260924T025022Z` increased physical backup storage by only 904 KiB;
- `manual-20260924T025424Z` increased it by only 908 KiB;
- the 10,664,307-byte frontend overlay shares inode `251960` and reached link count 4.

## Daily guarded backups 2026-09-24

Backups are now automated with a daily systemd timer while preserving the guarded promotion rules.

- `habbo-backup-daily.timer` is enabled and active with `OnCalendar=*-*-* 05:10:00`, `Persistent=true`, and `RandomizedDelaySec=60`.
- `habbo-backup-daily.service` runs `/srv/habbo/ops/habbo-backup-daily.sh`.
- The runner calls the existing guarded `backup.sh`, then immediately starts `habbo-runtime-healthcheck.service` and requires the runtime stamp to reference the newly promoted backup.
- This avoids a stale-runtime-stamp window after automated backup promotion.
- The backup timer/service and runner are included in backups and required by the restore verifier.
- `habbo-status.sh` now reports daily backup timer enabled/active state, last backup service result and latest backup age.
- `deployment-final-validate.sh` requires the daily timer enabled/active, last daily backup result `success`, and latest backup age <= 36 hours.

Manual end-to-end service validation:
- service start: 2026-09-24 05:03:47 CEST;
- service end: 05:03:59 CEST;
- Result=success, ExecMainStatus=0;
- previous backup: `manual-20260924T025655Z`;
- new backup: `manual-20260924T030347Z`;
- physical backup growth: 876 KiB thanks to hardlink dedupe;
- runtime stamp advanced immediately to `manual-20260924T030347Z`;
- `habbo-status.sh` remained `OVERALL READY`.

Live hashes:
- `habbo-backup-daily.sh`: `6ef05fd61a40eb9b851605686a8ac2cd25afc5dde48df7c50b8ee186a38d1568`
- `habbo-backup-daily.service`: `13289a0c28eb3a16a9cf86073433d6e30c1495d49628eb00628cbc8e1ce5bad8`
- `habbo-backup-daily.timer`: `86a0f520935a2a2b2269576d7c8b93abc059b788c1bf5982d91e073bb654cd4b`
- `backup.sh`: `186c59974de1516e4f550cbb700f97b956ff174f07c6fc6ee937b484c36bf433`
- `verify-latest-backup.sh`: `be2b12398c90b7c3cde4e59e64ee6a75c52d8f7976a04930bfd10ca569d6b89a`
- `deployment-final-validate.sh`: `1bfd0d5a97d8a71bec1c4e37ff5ffdb5f0ad14a003d2f6ef83cd8908f6b1eec4`
- `habbo-status.sh`: `444e8fc0cc73669dc017a3768a896cc009febd9e56aa4e6db5a043c8592f30b2`

Git commits:
- daily runner: `df2c72eb0a2e176844d6b9e758a5726def3dac22`
- daily service: `b47e799fc5a9903ced9ee7cb1db062be21468b39`
- daily timer: `a2e5dfcee9683b9ff2266bbaa051d88ce7c5db24`
- backup integration: `d82d41dcf257c04b55b87effdd79cad5c9e1f2aa`
- restore verifier integration: `38387adafd597e54820603086fa9469b9596f7b2`
- final validator integration: `e7346c8202edc0f5a651f4ebb98a0b01b915b03b`
- status integration: `fb383f979f5096346acf54ec4787d335e8618104`

## Database backup consistency 2026-09-24

The MariaDB backup path was audited for transactional consistency across storage engines.

Engine inventory:
- 84 InnoDB tables;
- 3 MyISAM tables: `cms_stickers` (0 rows), `cms_stickers_catalogue` (~1488 rows), `games_ranks` (8 rows);
- 1 view: `vw_users_hc_duplicates`.

The previous dump used `--single-transaction`, which is transactionally consistent for InnoDB but does not provide the same guarantee for MyISAM.
The normal Havana DB user intentionally lacks RELOAD, so it cannot acquire the global table lock needed by `--lock-all-tables`.

Measured dump timings:
- container-local root + `--lock-all-tables --routines --triggers`: about 0.81 s;
- normal application user + `--single-transaction --routines --triggers`: about 0.84 s.

Because the database is small and the locked dump is not slower in practice, `backup.sh` now uses the MariaDB root credential only inside the container with `--lock-all-tables --routines --triggers`.
This gives a consistent snapshot across both InnoDB and MyISAM without converting legacy tables.

Added `/srv/habbo/ops/db-backup-consistency-smoke.sh`.
It reports engine counts and fails if:
- an unexpected storage engine appears;
- MyISAM exists but `backup.sh` lacks `--lock-all-tables`;
- MyISAM exists but the dump is not using container-local root;
- `--single-transaction` reappears while MyISAM exists.

Validation:
- guard result: `PASS: Habbo DB backup consistency smoke`;
- reported `innodb=84 myisam=3 views=1 dump_mode=lock-all-tables`;
- backup `manual-20260924T031405Z` created with the new dump mode;
- physical growth only 876 KiB thanks to hardlink dedupe;
- restore verifier PASS with 88 tables, 40 navigator_styles, RogerVideo=1, room1000=1;
- aggregate deployment validator PASS with the DB consistency guard included.

Live hashes:
- `backup.sh`: `6b6a80b8dfc0484f46f9c08020dbca03f2d478db64c36bd32b4df72841fba836`
- `db-backup-consistency-smoke.sh`: `8ed6d55a9d201c92b72e1ecf70545dd77da63ea04efc2508759049dbe0492c54`
- `verify-latest-backup.sh`: `b4f23608296e02887d5bbc58cfae4137e53c997474338e754ff19fd228152456`
- `deployment-final-validate.sh`: `965e5759b60c85185b26d1247b17decca7ab811b40580dbf1f88117f05fb6d05`

Git commits:
- backup consistency: `1ede22649cf5a105105ed4868e8db5213612ddb3`
- DB guard: `94da7728c625f8cdd9057d4f9b276ecdfb2bad13`
- restore verifier: `d351811c13cf459bf6b6f761df9978b265529f99`
- aggregate validator: `e16120e46e9141c6c2afb618e448fd8f8f158ebf`

First fully automatic daily backup proof:
- timer fired automatically at 05:10:17 CEST;
- completed at 05:10:30 CEST with Result=success / ExecMainStatus=0;
- created `manual-20260924T031017Z`;
- runtime stamp advanced automatically to that backup;
- next daily run scheduled for the following day at 05:10;
- restore verifier, status and aggregate validator all passed against the automatic backup.

## Secret permissions and self-contained recovery 2026-09-24

A recovery audit found that live secret permissions were good, but previous backups were not self-contained for a total VPS loss.

Live permission findings:
- `/srv/habbo/.env`, `docker-compose.yml`, `PROJECT_CONTEXT.md` and Cloudflare config are `0600 root:root`;
- Cloudflare tunnel credential JSON is `0600 root:root`;
- systemd unit files are normal `0644 root:root` and do not embed password/token assignments;
- no world-writable regular files exist under `/srv/habbo`;
- MariaDB datadir contains expected group-writable container-managed files and was left unchanged.

Recovery gaps found and fixed:
- Compose depends on `HABBO_DB_PASSWORD` and `HABBO_DB_ROOT_PASSWORD` from `/srv/habbo/.env`;
- previous backups did not include `.env`, so Compose on a fresh VPS would silently default those variables to blank;
- previous backups stored Cloudflare `config.yml` but not the credential JSON referenced by `credentials-file`, so a fresh VPS could not bring the public tunnel back.

Fixes:
- backup root `/srv/habbo/backups` hardened to `0700 root:root`;
- each backup now includes `.env` as `0600`;
- each backup now includes `cloudflared-tunnel-credentials.json` as `0600`;
- restore verifier requires non-empty DB password variables and runs `docker compose config` using only the backed-up `.env` + compose file;
- restore verifier parses the Cloudflare config/credential JSON and requires the backed-up `TunnelID` to match without printing sensitive values;
- added `secret-permissions-smoke.sh`, which checks live secret modes, backup modes, Cloudflare credential permissions, absence of world-writable files and absence of embedded secrets in Habbo systemd units.

Validation:
- first `.env`-complete backup: `manual-20260924T032252Z`, Compose offline config PASS, restore PASS;
- first `.env` + Cloudflare-credential-complete backup: `manual-20260924T032502Z`, physical growth 884 KiB, restore PASS;
- secret permissions smoke PASS with `live_secrets=0600 backups=0700/0600 cloudflare_credential=0600 world_writable=0 systemd_embedded_secrets=0`;
- aggregate validator PASS against `032502Z`.

Live hashes:
- `secret-permissions-smoke.sh`: `4ba542f925205f16496630a079567a7644e680e2f2bf96e23e82d258853ed99d`
- `backup.sh`: `0ba435723044acc637cd3cd175a0c976c8898d3659874803213b362e33e0415f`
- `verify-latest-backup.sh`: `8df690118cd8acbf36c1228fddcfcab7dccb0e5b03a7a5d3384f1fdf3fe5e6f4`
- `deployment-final-validate.sh`: `f1e1104863784ccaef11ba78b824215d0dfc35673ab92821db9ad8480e461269`

Git commits:
- secret guard: `36d2ca82be8defc28e7fafd312cc6b61f6a6e9f0`
- backup recovery secrets: `3d7dc3c3ff52bba86f62c971185e5969a05338eb`
- restore verifier: `49076ffe8a004da705eb1fb647002063f0de4166`
- aggregate validator: `cad0c886bbead9d753976657a6de8e6bfbcd8c06`

## Disaster-recovery source closure 2026-09-24

The FINAL-v2 ZIP was confirmed to be a validation/recovery bundle, not a complete copy of the ~756 MB web tree and ~1.3 GB V31 tree.
Its restore script explicitly requires the historical core, MariaDB chunks, Havana WWW chunks, runtime and Wine prefix.

Independent source inventory was re-verified in ChatGPT Library folder `/Habbo 2009 Dual Linux`:
- FINAL-v2 + SHA file;
- combined runtime ZIP and Wine prefix archive;
- `habbo-core-small.zip`;
- six MariaDB chunk ZIPs;
- eight WWW chunk ZIPs;
- five runtime chunk ZIPs;
- two Wine-prefix chunk ZIPs;
- chunk hash manifests and restore scripts.

To remove GitHub as a restore dependency, a complete offline Git bundle of the clean Havana checkout was created:
- commit `b550f00f27788145d26723fd19e943aa63504a63`;
- bundle SHA-256 `77672bee2a6b8f879aa8cb0acbac41b7bc203b4487e1464ebacbc1848564bcb5`;
- bundle size 4,304,844 bytes;
- bundle records complete history.

Each promoted backup now includes:
- canonical FINAL-v2 ZIP;
- offline Havana Git bundle;
- `DISASTER_RECOVERY_MANIFEST.md`;
- Library backend/WWW chunk hash manifest;
- Library runtime/prefix chunk hash manifest.

`disaster-recovery-source-smoke.sh` pins FINAL-v2, Havana commit/bundle, clean live checkout and MariaDB 11.5.2 registry digest.
`verify-latest-backup.sh` now additionally opens FINAL-v2, validates manifest line counts, verifies the Git bundle and performs a real offline clone from the promoted backup.

Offline clone proof from promoted backup `manual-20260924T033517Z`:
- `git bundle verify`: complete history, exact HEAD;
- offline clone HEAD: `b550f00f27788145d26723fd19e943aa63504a63`;
- restored and live tree object both `e61e788980d5240bcfdc97cbb2a1ebddc7d80045`;
- `Dockerfile-Server` and `Dockerfile-Web` byte-identical to live checkout.

Dedupe proof:
- first disaster-source backup `manual-20260924T033517Z` added 8,500 KiB because FINAL-v2 and the Havana bundle were new to the chain;
- second backup `manual-20260924T034656Z` added only 880 KiB;
- FINAL-v2 shares inode `252027` across both backups;
- Havana bundle shares inode `252022` across both backups.

Git commits:
- disaster source guard: `e17630809bee7cb930123e5edd6749644f8d1a64`
- backup integration: `eca18ed56b7b4ba87b9c6fec47d6ff12418cf015`
- restore verifier integration: `1637c75bd8ed1f7632dc9f0f5a3eff1863cd443a`
- final validator integration: `77bc4e8dda149a8fa0a2c1a9e86c9394e486e61d`
- disaster manifest: `6ca447ee671eefe678cf46987b91ad86a1e62683`
- Library chunk hashes: `f7e2b39d876dfdb2056d182c24f023be77e6d43e`
- runtime/prefix hashes: `ac8bbf738e264316272a22a4ba9637a277dc71a1`
- offline-clone verifier: `ce3ef3fa075f75cc57e416b5ae6b8cd1ef0dad16`

## Host prerequisites and weekly disaster drill 2026-09-24

A host-prerequisite manifest and a non-destructive weekly restore drill were added.

Host recovery manifest:
- Ubuntu 22.04.5 LTS x86_64 captured host;
- docker.io 29.1.3-0ubuntu3~22.04.2, containerd 2.2.1-0ubuntu1~22.04.2;
- Docker Compose v2.27.0, active plugin SHA-256 `f3ba3bf1e4ab18e96c2d36526a075a02a78fb5f8e80d3e3ca9c5bf256d81d0a0`;
- python3-websockify 0.10.0+dfsg1-2build1;
- cloudflared 2026.7.3, `/usr/bin/cloudflared`, SHA-256 `9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17`;
- `cloudflared-stremio-legacy.service` is now included in promoted backups alongside config + credential JSON.

The restore drill reconstructs a fresh tree under `/tmp` only and does not start replacement containers or touch production ports. It:
- restores `.env`, Compose, context, disaster manifest, ops overlay and frontend overlay;
- clones Havana offline from the backed-up Git bundle;
- verifies/extracts FINAL-v2;
- resolves Compose from backed-up `.env` and structurally verifies every published port is loopback-only;
- verifies the Cloudflare config/credential pair;
- restores and syntax-checks the 10 required systemd units;
- invokes the isolated temporary-DB restore verifier.

Successful manual drill:
- backup: `manual-20260924T035625Z`;
- result: PASS with `compose=resolved cloudflare=coherent systemd=verified final_v2=verified db_restore=verified`.

Weekly automation:
- `habbo-disaster-drill.timer` enabled and active;
- schedule: Sunday 05:40 local time with up to 300 seconds randomized delay, Persistent=true;
- service timeout: 300 seconds;
- success stamp: `/run/habbo-disaster-drill`;
- aggregate validation requires timer enabled/active, last service result success, stamp age <= 8 days and referenced backup still present.

Initial service proof:
- 2026-09-24 06:00:11 CEST start;
- 06:00:21 CEST finish;
- Result=success, ExecMainStatus=0;
- stamp references `manual-20260924T035956Z`;
- next scheduled automatic run observed for Sunday 2026-09-27 around 05:44 CEST.

Live hashes:
- `HOST_PREREQUISITES.md`: `a8aec4c1933c56ab9da3af9fdfa121f8f750dce03d19bf200e8506e06b1faba4`
- `disaster-restore-drill.sh`: `1778c275cf9babf1d550d4fd5685b6fe2b50fba809d8f9e7f53a8893f536590a`
- disaster drill service: `a08b4585b2d1c8c92740d68c3dc1350558c192340a77cecfd3af274d935a5f9c`
- disaster drill timer: `1a3b462231955544ca09a47a84a263237b666e243a03d2c741ec7ac59be87f64`
- `backup.sh`: `9f8feecbaa526cd69c93809dda12cf7e961ea4337a993bd7b415b8ad98042675`
- `verify-latest-backup.sh`: `301febcce3e1ca1575c19e4533a55e4962ab41d2b5da6bd9e21d78bae7967d3c`
- `deployment-final-validate.sh`: `5a37a3a1bc5a44f10e5fa268458f50ec6e89a6e9c0d440391d7bf633df13dc57`
- `habbo-status.sh`: `121486b179e091234e0c4a5ad587781bab79542a17693eff825957f4fed3eb64`

Git commits:
- host prerequisites: `8332bd498216bc5f01c1bbae146990d52adf68ce`
- host-aware backup: `e95939b781c947415dc5198656a8d2f8e5d85ce4`
- host-aware verifier: `71c9b2a2a860ae986233b2924f84bcebebbfdb4c`
- shared Cloudflare secret guard: `864c51b321bbb4955a3074d972a0a96a4e37eeec`
- restore drill: `bce294aced851fa604686a2bedaffcea4ddda897`
- stamped drill script: `3394e7d7dba740735eac33de45c009d7ee726d5c`
- drill service: `97d0dcc9f815792090a252e5329cc09db6c7f05e`
- drill timer: `2bebf67b4ff4315d4b47851bf9cb86bcfdcaec94`
- backup weekly integration: `6edf62a4ca36a530c31a88172e0d75f4b428ad8e`
- verifier weekly integration: `dde866868ccb4c3c8e2cfb18b4809b3994f63615`
- final-validator weekly integration: `d92bb6732373bc0a7d1a7a618fce3fab9f7ac8c3`
- status weekly integration: `1c2ebd36bd72c99f388f7138ecf6ec61bbf37fce`

## Off-host mutable-state backup to VPS2 2026-09-24

The remaining same-disk failure domain was closed for current mutable production state.
Historical large assets remain independently protected in ChatGPT Library; the current promoted VPS1 backup is additionally copied to VPS2.

VPS2 pull:
- script: `/usr/local/sbin/habbo-vps1-offsite-pull.sh`, mode 0700;
- destination: `/var/backups/habbo-vps1`, mode 0700;
- archives + checksum files: mode 0600;
- timer: daily 05:25 local time, Persistent=true, randomized delay up to 60 seconds;
- retention: newest 3 complete archives only;
- transport: existing root SSH path from VPS2 to `bridge-old`;
- source backup SHA256SUMS is checked on VPS1 before streaming;
- full promoted backup is streamed as tar.gz to VPS2;
- gzip and every backed-up file checksum are revalidated after extracting into VPS2 `/dev/shm`;
- promotion to VPS2 `LATEST` is atomic only after verification.

The offsite archive contains current DB and recovery secrets, so it is intentionally root-only. It is not uploaded to any external service.

After a verified pull, VPS2 writes `/srv/habbo/OFFSITE_BACKUP_STATUS` on VPS1 as 0600 and `/run/habbo-offsite-backup` as 0644. The marker contains no secret: UTC time, source backup, archive SHA-256, archive size, offsite host and path.

`offsite-backup-smoke.sh` requires:
- persistent marker mode 0600 root:root;
- proof age <= 36 hours;
- offsite source exactly equal to current `LATEST_PUBLIC_WEB_BACKUP`;
- valid 64-hex archive SHA-256, positive size, host VPS2 and expected archive path.

`habbo-status.sh` reports offsite age and latest-match state. `deployment-final-validate.sh` includes the offsite smoke.

Observed transition proof:
- offsite copy of `manual-20260924T040336Z`: 19,331,570 bytes, SHA verified on VPS2;
- a new local backup `manual-20260924T040928Z` was then promoted;
- before VPS2 pull, status correctly reported `offsite latest match FAIL` and `OVERALL DEGRADED`;
- VPS2 pull ran 06:10:00–06:10:04 CEST with Result=success/status0;
- copied `040928Z` archive size 19,332,483 bytes and verified its checksum;
- VPS1 marker moved to `040928Z`, offsite smoke passed, status returned `OVERALL READY`, aggregate validator passed.

VPS2 timer next automatic run was observed for 2026-09-25 around 05:25 CEST.

Live hashes:
- VPS1 `offsite-backup-smoke.sh`: `484ed1a8c643597b3aa9740302dde7ca2b50d40d8cbfad813fb963bbf5354c6b`
- VPS1 `verify-latest-backup.sh`: `5f08495b7c6720e829dbbc8446216fe1df0c12cdf60853b2ad58b0e98a1f16ba`
- VPS1 `deployment-final-validate.sh`: `1d9f4d1eab61d2932120c68fe365477949b8a88cf080a22c45ac20f6a6f6dd96`
- VPS1 `habbo-status.sh`: `2a47e967f4425273ed62b367a342b4ff525f9d53917dbb7fb422a0bc9d919762`
- VPS2 pull script: `85bd9f9f0026119b18a4842129ede08ac6509da11ae287062aebd012a739ff23`
- VPS2 service: `54f55d6f437e981761d124f23d90f838ee1b8f09f96fd632812c879987e66ab0`
- VPS2 timer: `e748fafaf8121226e4852513b0f28f174a89d8f99ce6b7ec4429e1268ff54c58`

Git commits:
- VPS1 offsite guard: `aa31ee20fb12976526c772d02527a48f26700865`
- VPS1 verifier: `387608c2cc9984ad82d8434aee0e22ba05b3624d`
- VPS1 final validator: `deadf9df1fac630926eca17758301117355f0b68`
- VPS1 status: `8283325887a4b844a6700d23b75b71fc5cea8248`
- VPS2 pull: `88d106200d1de9f9db7aea5db4cae83ff0b8c53b`
- VPS2 service: `a42bd37602335127aee81b8739c000c85949a355`
- VPS2 timer: `c998d01ea0b176d334fb366bd269dd0820b70cc2`

## Off-host mutable-state backup on VPS2 2026-09-24

The remaining single-host failure mode was the current mutable state: VPS1 local backups contained current DB state and current secrets, while the ChatGPT Library independently protected the large historical assets.

VPS2 now pulls promoted VPS1 backups to a separate host:
- destination: `/var/backups/habbo-vps1`, mode `0700 root:root`;
- archive files + checksum files: `0600 root:root`;
- service: `habbo-vps1-offsite-pull.service` on VPS2;
- timer: `habbo-vps1-offsite-pull.timer`, daily 05:25 local, Persistent=true, up to 60 seconds randomized delay;
- retention: three newest complete tar.gz archives;
- the source backup is verified on VPS1 before transfer;
- VPS2 extracts the received archive into `/dev/shm`, rewrites the absolute SHA256SUMS paths to local basenames, and re-verifies every archived file before promotion;
- a verified archive gets its own SHA-256 sidecar and becomes `/var/backups/habbo-vps1/LATEST`.

Successful off-host proof is written back to VPS1 as `/srv/habbo/OFFSITE_BACKUP_STATUS` (`0600 root:root`) and mirrored to `/run/habbo-offsite-backup`.
The marker contains only timestamp, source backup path, archive SHA-256, archive size, offsite host and offsite archive path.

Initial implementation caught two safe failures before promotion:
- local verification originally attempted to use VPS1 absolute paths from SHA256SUMS on VPS2; no archive/LATEST/marker was promoted;
- marker writing originally had fragile nested shell quoting; it was replaced by `ssh ... bash -s --` with positional arguments.

First successful off-host copy:
- source `manual-20260924T040336Z`;
- archive size 19,331,570 bytes;
- archive SHA-256 `4940fa2c7f64493d841bde139dbd9e860f3462ccb095f6c8c1017664c1f18ed0`;
- VPS2 service Result=success / ExecMainStatus=0.

End-to-end lag behavior was explicitly tested:
- a new VPS1 backup `manual-20260924T040928Z` was promoted;
- runtime health was refreshed, but offsite still referenced the prior backup;
- `habbo-status.sh` correctly reported `offsite latest match FAIL` and `OVERALL DEGRADED`;
- `offsite-backup-smoke.sh` correctly failed with `offsite backup does not match latest backup`;
- after the VPS2 pull, the offsite archive verified successfully and VPS1 returned `offsite latest match OK` / `OVERALL READY` without touching Habbo services.

Second successful off-host copy:
- source `manual-20260924T040928Z`;
- archive size 19,332,483 bytes;
- archive SHA-256 `8bb53fea1fdad37381167fd4041de09cdc6c8bee042585919f5556be64165e8b`;
- final aggregate validator PASS.

`offsite-backup-smoke.sh` requires:
- durable marker mode 0600 root:root;
- proof age <=36 hours;
- offsite source backup equals current LATEST_PUBLIC_WEB_BACKUP;
- valid archive SHA-256 and positive size;
- offsite host exactly VPS2;
- archive path matches the backup name.

`habbo-status.sh` reports offsite age and latest-match state. The aggregate final validator runs the offsite smoke.

Live hashes:
- VPS2 pull script: `85bd9f9f0026119b18a4842129ede08ac6509da11ae287062aebd012a739ff23`
- VPS2 service: `54f55d6f437e981761d124f23d90f838ee1b8f09f96fd632812c879987e66ab0`
- VPS2 timer: `e748fafaf8121226e4852513b0f28f174a89d8f99ce6b7ec4429e1268ff54c58`
- VPS1 offsite smoke: `484ed1a8c643597b3aa9740302dde7ca2b50d40d8cbfad813fb963bbf5354c6b`
- verifier: `5f08495b7c6720e829dbbc8446216fe1df0c12cdf60853b2ad58b0e98a1f16ba`
- final validator: `1d9f4d1eab61d2932120c68fe365477949b8a88cf080a22c45ac20f6a6f6dd96`
- status: `2a47e967f4425273ed62b367a342b4ff525f9d53917dbb7fb422a0bc9d919762`

Git commits:
- VPS2 pull: `b778e89375e27caf61dd1755a836bd175fd4bb35`
- VPS2 service: `488b19d7837746fca7a8e27998662405ed243ba0`
- VPS2 timer: `fda2b2480c4c0bed90abdf093cc3e6869791903f`
- VPS1 offsite smoke: `608b0ca7be0f890da3413ae8db49813df8ce925d`
- verifier: `ca797bd909fba4696c2496d7b73262043ec42995`
- final validator: `12422fd56adf2a178c27fe2fa508fd47f68f7cc8`
- status: `0a72a8ce01a3162136257518fb60697ec4366178`

## Off-host retention proof 2026-09-24

The three-copy retention policy on VPS2 was observed in real operation.

Before the retention turnover, off-host archives included `manual-20260924T040336Z`, `040928Z`, `041330Z` and then the new `042223Z` generation.
After the pull of `042223Z`, VPS2 contained exactly three archives:
- `manual-20260924T040928Z.tar.gz`;
- `manual-20260924T041330Z.tar.gz`;
- `manual-20260924T042223Z.tar.gz`.

The former oldest archive `040336Z` was removed only from `/var/backups/habbo-vps1` on VPS2.
The source backup directory `/srv/habbo/backups/manual-20260924T040336Z` remained present on VPS1.
Therefore the retention loop is scoped to the dedicated off-host destination and does not delete source backups.

`041330Z` exists on VPS1 with filesystem creation time around 06:13 CEST, but there were no `habbo-backup-daily.service` or `habbo-disaster-drill.service` journal entries in that window. It was not created by those scheduled units.

## VPS2 offsite restore drill 2026-09-24

A second, independent recovery drill now runs on VPS2 against the off-host tar.gz archive itself, not against the live VPS1 backup directory.

The drill validates from the off-host archive:
- archive SHA-256 sidecar;
- every internal SHA256SUMS entry after remapping VPS1 absolute paths to extracted basenames;
- FINAL-v2 hash + ZIP integrity;
- Havana offline Git bundle hash + exact commit + clean checkout;
- Library chunk manifests cardinality;
- Compose resolution using only archived `.env` + compose file, with structural loopback-port checks;
- Cloudflare config/credential coherence;
- presence of 12 required systemd unit files;
- a real MariaDB restore from archived `havana.sql.gz`.

MariaDB restore isolation:
- exact image pinned by digest `mariadb@sha256:2d50fe0f77dac919396091e527e5e148a9de690e58f32875f113bef6506a17f5`;
- temporary container with `--network none` and no published ports;
- `/var/lib/mysql` on tmpfs;
- image removed after the drill to recover VPS2 disk headroom.

Two drill bugs were found and corrected safely:
- initial client readiness/import attempted the default socket path; fixed to explicit TCP `127.0.0.1` inside the isolated container;
- final invariant query mistakenly referenced `navigator_publics`; corrected to canonical `navigator_styles`.
Neither failure touched production nor promoted a successful drill marker.

Successful off-host restore proof:
- source archive: `manual-20260924T042601Z.tar.gz`;
- archive SHA-256: `32e8c00a792aea9bd6d43f4875eaea73a5901c0f314651eb903447d2b2eeb821`;
- Havana commit `b550f00f27788145d26723fd19e943aa63504a63`;
- Compose resolved; Cloudflare coherent; 12 units present;
- restored DB invariants: 88 tables, 40 navigator_styles, RogerVideo=1, room1000=1;
- VPS2 filesystem returned to ~943 MiB free after image cleanup.

Automation:
- VPS2 `habbo-vps1-offsite-restore-drill.timer` enabled + active;
- schedule: Sunday 06:20 local, Persistent=true, up to 300 seconds randomized delay;
- initial systemd proof: 06:45:34 -> 06:45:59 CEST, Result=success / ExecMainStatus=0;
- successful drill writes `/var/backups/habbo-vps1/OFFSITE_RESTORE_DRILL_STATUS` on VPS2 and a root-only `/srv/habbo/OFFSITE_RESTORE_DRILL_STATUS` proof on VPS1.

VPS1 `offsite-restore-drill-smoke.sh` requires:
- root-only durable status file;
- proof age <=8 days;
- valid source backup path + SHA;
- offsite host VPS2;
- 88 tables, 40 navigator_styles, RogerVideo=1 and room1000=1.

Live hashes:
- VPS2 restore drill: `9a73c13594adf5f32ec05641758822d0b1caa0422e4069860dc04670575cf9c2`
- VPS2 restore drill service: `a7da4568d7253e7f0b5c6880cd60a2b90a987a6c218e8cdfb496cb83e0bd5bbe`
- VPS2 restore drill timer: `590639228ccf90e47806c53b5368c4fc76fc0bab73f1531354b81eff61315731`
- VPS1 offsite restore smoke: `6e3a8d199c29bf85cd269b171fa3f99539387f33a271bee46d48ab4a6e60fd5f`
- verifier: `144ea3719b56d67a63d0aafd28354177fe6a324710f55ccf7f9aff20f16520dd`
- final validator: `eba5794dadb87f7d69599c60c93dc7d41c0318f5e043c0ebf5a852da09f11bb2`
- status: `faa3d9a89ac34d74ec81e9d3cb34ff8ef5814c26cbb9558d2e1deb4b61cd56f1`

Git commits:
- VPS2 drill: `ce400b7438db412f2fa08722fac5a9258ab203de`
- VPS2 drill service: `8704720e73a728e83dffdb6956d32d6f9615a92a`
- VPS2 drill timer: `22cb8e2c0ac68c7a169ebf18183fc17ea636f78c`
- VPS1 drill smoke: `83ed9701bdb97db0dcdce70986fa5f35eaf84b4f`
- verifier: `803e216fd56de837be6f54e8bbb816d9af06b5bd`
- final validator: `fd392457bccc243567f0ba0f6dee8d992502d425`
- status: `fd831e3b896b13a5b7fa5214d272ab9fd3f75d2e`

## Automated WebKit iPhone regression 2026-09-24

The external Safari/iPhone regression is now automated on VPS2 instead of being a manual-only check.

VPS2 components:
- `/usr/local/sbin/habbo-public-webkit-smoke.py`: Playwright WebKit using the `iPhone 14 Plus` device profile;
- `/usr/local/sbin/habbo-public-webkit-daily.sh`: success wrapper + durable VPS1 proof;
- `/usr/local/sbin/habbo-public-webkit-failed.sh`: `OnFailure` recorder that writes a failure latch to VPS1;
- `habbo-public-webkit.service` + `habbo-public-webkit.timer`;
- `habbo-public-webkit-failed.service`.

Schedule:
- daily at 05:35 local time;
- Persistent=true;
- up to 60 seconds randomized delay.

Successful WebKit scenario:
- public home must return 200 with title `Habbo 2009 ~ Home`;
- legacy libs2.js must precede landing.js;
- a physical touchscreen tap must focus the login field;
- navigation by touchscreen to `/register` must succeed with title `Habbo 2009: Register`;
- a touchscreen tap must toggle the marketing checkbox;
- no HTTP >=400 responses, failed requests, JS page errors or console errors are allowed.

Remote proof on VPS1:
- `/srv/habbo/WEBKIT_STATUS` mode 0600 root:root;
- fields: timestamp, result=success, engine=webkit, device=iPhone 14 Plus, scenario=home+register;
- `/srv/habbo/WEBKIT_FAILED` is an explicit failure latch and is removed only by a later successful WebKit run.

The marker transport was hardened after a quoting issue truncated a human summary field. Proofs now travel over stdin rather than SSH command arguments with spaces.

Controlled failure round trip:
- only `habbo-public-webkit.service` was temporarily overridden to run `/bin/false`; no Habbo/Cloudflare/Stremio service was touched;
- service ended with Result=exit-code and ExecMainStatus=1 at 06:54:51 CEST;
- `habbo-public-webkit-failed.service` succeeded and wrote the root-only `WEBKIT_FAILED` latch to VPS1 with recent journal evidence;
- WebKit timer remained active;
- override was removed, service restored, and a real WebKit run succeeded at 06:55:04 CEST;
- the failure latch was then cleared automatically and the timer remained active.

VPS1 `public-webkit-remote-smoke.sh` requires:
- success marker mode 0600 root:root;
- no failure latch;
- proof age <=36 hours;
- result success, engine webkit, device iPhone 14 Plus, scenario home+register.

`habbo-status.sh` now reports WebKit proof age, failure latch and proof state. The aggregate final validator runs the WebKit proof smoke.

Live hashes:
- WebKit Python smoke: `30318a3ab36ec0cb4b5adbbdbf0c11d67d4a70a9a31c5ff661dbcf166f85be2e`
- daily wrapper: `6d939c84b76afa98a76db12497314373788f7c8e40ee1da4276a1b4c379d0ba9`
- failure handler: `b81882a29c57a645ab2ca70adb066152ec7929cfafa3d9560bdaf50275453a54`
- WebKit service: `d5777b3713cecf5c4856c72a186fe43fa3c6cdcb53ce118d832718ec835114fc`
- failure service: `8b04b250d0be3c9597ba3a3812c9b6a4cad3f2b4f29750b3edb4a97957ea47a8`
- WebKit timer: `2de0d3fa16b5a3dfc07f520a9e210253ea7c4ba4821afb09f2a89b0d5d626a5d`
- VPS1 WebKit proof smoke: `51ffe85f460a7ebcbcc4375be22f39775ba1b01a462d9c7dea3e92731a8435cd`
- verifier: `6fae88503748961a68f7a97b773ae2a7ffc57728bee8442b4a39eb3e56253ee2`
- final validator: `9f9925dab9904fcf26a3c6e5737fa813d102d9b2c3ccb4891637a6a36184253b`
- status: `16f4ba25781e94fc86ae2595bfb73f06777aeddf36cfbb8b576f47b3954204b6`

Git commits:
- WebKit smoke: `b834c65ca975b594b791e76ea9f63380aba75987`
- daily wrapper: `242496f8a1cc4a00cfd90301ad851d02ea78718e`
- failure handler: `207716406ac84c8a2d4a2ae96ab67f5b32211f56`
- WebKit service: `e7f5d7f07ee32ef6ada7aa8486f0fb76560353f9`
- failure service: `7f04773af176b3d1e4b71aeb9b54c8f7ca29963f`
- timer: `1176b39bc9159d1ede570acb5b7157fd1141841f`
- VPS1 proof smoke: `d854bd174501ff0786d85acea1db0fb17cdc7dcf`
- verifier: `3c8eb87420a3811825cd6f2df352e9eadb866052`
- final validator: `f19181f527391d3cfc160a7cfd03ee3465ea0674`
- status: `6b1b5cfee2991a23940cdedcf1e997cb170f24ea`

## Immediate VPS2 failure latches and disk preflight 2026-09-24

VPS2 off-host jobs now report failure immediately to VPS1 instead of relying only on proof expiry.

Added shared VPS2 failure recorder:
- `/usr/local/sbin/habbo-vps1-offsite-failed.sh`;
- records unit result, exit status and recent journal;
- writes root-only latch files on VPS1.

Pull path:
- `habbo-vps1-offsite-pull.service` now has `OnFailure=habbo-vps1-offsite-pull-failed.service`;
- failure latch: `/srv/habbo/OFFSITE_BACKUP_FAILED`;
- a later successful pull removes the latch automatically.

Restore drill path:
- `habbo-vps1-offsite-restore-drill.service` now has `OnFailure=habbo-vps1-offsite-restore-drill-failed.service`;
- failure latch: `/srv/habbo/OFFSITE_RESTORE_DRILL_FAILED`;
- a later successful restore drill removes the latch automatically.

Restore drill disk preflight:
- VPS2 `/` must have at least 800 MiB free;
- VPS2 `/dev/shm` must have at least 512 MiB free;
- failure occurs before pulling MariaDB if the threshold is not met;
- the MariaDB image is removed only when the drill itself downloaded it.

Controlled pull-failure proof:
- only the offsite pull service was temporarily overridden to `/bin/false`;
- Result=exit-code / ExecMainStatus=1;
- failure recorder service succeeded;
- VPS1 received `OFFSITE_BACKUP_FAILED` mode 0600 with journal evidence;
- offsite pull timer remained active;
- override removed; real pull succeeded and cleared the latch.

Controlled restore-drill failure proof:
- only the offsite restore service was temporarily overridden to `/bin/false`;
- Result=exit-code / ExecMainStatus=1;
- failure recorder service succeeded;
- VPS1 received `OFFSITE_RESTORE_DRILL_FAILED` mode 0600;
- restore timer remained active;
- preflight observed about 944 MiB root free and ~1.9 GiB `/dev/shm` free;
- real restore drill then passed with 88 tables, 40 navigator_styles, RogerVideo=1 and room1000=1;
- latch cleared and temporary MariaDB image was absent after cleanup.

VPS1 health integration:
- `offsite-backup-smoke.sh` fails while the pull failure latch exists;
- `offsite-restore-drill-smoke.sh` fails while the restore-drill latch exists;
- `habbo-status.sh` reports both latches independently.

VPS1 disk investigation:
- the temporary drop from ~1.77 to ~1.59 GiB free was not caused by Habbo backups or MariaDB growth;
- two regenerable APT caches created at 06:34 consumed about 151 MB total;
- only `/var/cache/apt/pkgcache.bin` and `/var/cache/apt/srcpkgcache.bin` were removed;
- unrelated `/tmp` trees were intentionally left untouched;
- disk smoke returned PASS with about 1.74 GiB free afterward.

Live hashes:
- VPS2 shared failure recorder: `4dae632c55f3a8ac267039f81d2322de0f4253166a7439f696831e77de2621b9`
- VPS2 pull script: `a4eb4b0e9549751ce101f21cb6c1b33c15435e45d09312c2b3dec3ba3eb862e9`
- VPS2 restore drill: `80a127fdf5f688f4a087ac71f58f487d42513ef94605138d12dc65155aceaabd`
- pull service: `de44db23dbee2f13ef47d822a07cdcf6a60013a1b3e038eb75600bf8d17b4d25`
- pull failure service: `9bac1f78e3fbb906b48b166afa6f3d0d039e2673e1994ae3ad5641c565b2336a`
- restore service: `cec0a3765ff0437f935d8bc00cbf76b3dda80278c841b4fd85dd644ca99e6726`
- restore failure service: `aaef7bf1fb0b697ffc3d18da55ed0e5b90063aa8cef52c18ae0f4b97e1b87932`
- VPS1 offsite backup smoke: `06df5313659cb6fef2b5cb1ff18d8c03869beb57afa7dbdcf9aa2a3058208f62`
- VPS1 offsite restore smoke: `75bcfd33fa53440139a73b958add228514c9879bf0b4b541581121de8cf228a1`
- VPS1 status: `5bc32cd9e115c69fe6742133e60767e82c74a70d8b69128efebbfd00ba92c3e2`

Git commits:
- failure recorder: `164185f840895d0158e21c003d740605434ce7d9`
- pull latch recovery: `af62cff5fd49f5c7da839afae7f02d8241728136`
- restore preflight/latch recovery: `eb26ce4d19cbe93f8456f28e4ce9643921b86553`
- pull service OnFailure: `3a715b230f2af8d93619b1816250d31434f2e197`
- pull failure service: `ba67a4e684f5b249f391c4633e408e135decedee`
- restore service OnFailure: `c6b219f0f5af537c77fc230ee62da8a568f0f9d5`
- restore failure service: `a02a27b757b5adbf573ca276a7fc89ca29dfd979`
- VPS1 pull smoke latch: `2f028f985d90fb104bc8754498c50db6a93cb776`
- VPS1 restore smoke latch: `2bb5e688e9aaaf045843f73e72b78f1ac061df14`
- VPS1 status latches: `2bb1e51de5035c9764536b119363514cb2671de0`

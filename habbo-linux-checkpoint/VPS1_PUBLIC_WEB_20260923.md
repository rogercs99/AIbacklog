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

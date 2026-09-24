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

## Isolated local backup restore verification 2026-09-24

The VPS1 backup verifier no longer creates a temporary database inside the live production MariaDB container.

Previous behavior:
- created `habbo_restore_verify_*` inside `habbo-mariadb-1`;
- imported `havana.sql.gz` there;
- queried invariants and dropped the temporary database in the exit trap.

New behavior:
- obtains the image ID already used by `habbo-mariadb-1`;
- verifies that image exposes pinned digest `mariadb@sha256:2d50fe0f77dac919396091e527e5e148a9de690e58f32875f113bef6506a17f5`;
- starts `habbo-backup-restore-verify-<pid>` with `--network none`;
- publishes no ports;
- stores `/var/lib/mysql` on a 320 MiB tmpfs;
- restores the archived SQL into isolated database `restore_verify`;
- requires exact invariants: 88 tables, 40 navigator_styles, RogerVideo=1, room1000=1;
- removes the verifier container via EXIT trap.

Proof against backup `manual-20260924T051335Z`:
- verifier PASS with `restore_isolation=network-none tmpfs-datadir no-published-ports live-db-untouched`;
- no `habbo_restore_verify_*` database existed before or after the run in production;
- no `habbo-backup-restore-verify-*` container remained after the run.

Disk health was extended to detect residues from both architectures:
- legacy temporary production DBs;
- stale isolated verifier containers;
- `/dev/shm/habbo-restore-verify.*` workdirs older than 10 minutes.

Live hashes:
- `verify-latest-backup.sh`: `7aca16c092b2fed64cb7fc9e6e0e991f04e3a53ae3d6c22f4bd67158f330f98d`
- `disk-health-smoke.sh`: `c39bf44f36a0623af1646a6932f075f4569b4160203596d4f9331d62603cb95b`

Git commits:
- isolated verifier: `8c834f1c38066b4dcd7b4828ca97451b39ccd8a0`
- stale isolated verifier guards: `3c61ac9fa3164f562e5c96bfd22fddc15a3870b6`

## Atomic backup publication 2026-09-24

The backup publisher was hardened so a failed or concurrent backup can never masquerade as a completed `manual-...Z` generation.

Publication protocol:
- exclusive `flock` on `/run/lock/habbo-backup.lock` rejects concurrent runs;
- work is created under hidden staging path `.manual-<timestamp>.incomplete`;
- failure cleanup removes the staging directory through an EXIT trap;
- SHA256SUMS is generated with relocation-safe relative paths;
- the staged backup is fully verified before publication;
- staging is renamed atomically on the same filesystem to `manual-<timestamp>`;
- `LATEST_PUBLIC_WEB_BACKUP` is written through a temporary file and atomically renamed.

Controlled failure proof:
- `tar` was shadowed through a temporary PATH entry and forced to exit 99 after staging began;
- backup returned rc=99;
- `LATEST_PUBLIC_WEB_BACKUP` remained `manual-20260924T052222Z`;
- no `.manual-*.incomplete` directory survived.

Controlled concurrency proof:
- the backup lock was held externally while a second backup was started;
- second backup failed with `another Habbo backup is already running`;
- LATEST remained unchanged and no staging residue was created.

First successful atomic generation:
- `manual-20260924T052813Z`;
- physical growth 884 KiB;
- checksum manifest uses relative filenames and re-verifies after publication;
- FINAL-v2 and Havana bundle retained hardlink dedupe to the previous generation;
- VPS2 offsite pull accepted the relative manifest and verified the resulting archive;
- VPS1 returned from expected offsite lag DEGRADED state to OVERALL READY.

Added `backup-publication-smoke.sh`:
- validates LATEST path and permissions;
- requires relative/parent-safe, duplicate-free checksum entries;
- re-verifies SHA256SUMS;
- rejects stale `.manual-*.incomplete` staging dirs;
- rejects stale temporary LATEST files;
- requires backup lock availability infrastructure.

Controlled stale-staging proof:
- a dummy `.manual-19990101T000000Z.incomplete` aged 20 minutes caused the smoke to FAIL;
- after removal the smoke returned PASS.

Live hashes:
- `backup.sh`: `9674803a4db0b60159a45f6a50e2ce1c0b8dbed209fc75b5b19d1a9428de32ac`
- `backup-publication-smoke.sh`: `aeb6afb580753be07902a33232553c75c3c1bb6003a736dcdbe16725fa0e0c33`
- `verify-latest-backup.sh`: `17ba79dd868bf37b6207e0bd8a1047188d4188726173e7ee3ed070d9d7f50af8`
- `deployment-final-validate.sh`: `1c85b88884dd3487a3f18fef325a042e73887647585802e689c2d01af41d3cee`
- `habbo-status.sh`: `f2440ff42bd130090d699be1eb4c9cf643fe9cbf4624c5608967393a5631baf8`

Git commits:
- atomic backup publisher: `1d718efe959cff337fcd87b81b10f87840f192bf`
- publication smoke: `4df81b718450bc0ce9acd8e62fef927f827b5c5e`
- verifier integration: `632c2a2eab1931e46f524f03bf7771d235e8d8ea`
- final validator integration: `348b2de6dfcb33e7a571e36767e94b87f3228971`
- status integration: `21090bb1462a8ee7178030aae155012adefc9b11`

## Guarded local backup retention 2026-09-24

Local backup accumulation is now actively bounded rather than merely reported.

Policy:
- keep 14 most recent local generations;
- always preserve current `LATEST_PUBLIC_WEB_BACKUP`;
- preserve backup referenced by `/run/habbo-disaster-drill`;
- preserve backup referenced by `/srv/habbo/OFFSITE_RESTORE_DRILL_STATUS`;
- preserve historical restore milestones `manual-20260923T183558Z` and `manual-20260923T205014Z`;
- use the same exclusive `/run/lock/habbo-backup.lock` as backup publication;
- refuse symlink directories or candidates missing `SHA256SUMS` / `havana.sql.gz`;
- dry-run by default; deletion only with `APPLY=1`.

Initial dry-run:
- total local generations: 63;
- KEEP: 16;
- DELETE candidates: 47;
- all current dynamic references were in KEEP.

First applied prune:
- 47 candidate directories removed;
- local backup count: 63 -> 16;
- backup physical usage: about 342 MiB -> 35.1 MiB;
- exact reclaimed backup blocks: 313,848 KiB (~306.5 MiB);
- root free space rose from ~1.73 GiB to ~2.03 GiB;
- both historical milestones, local disaster-drill source and current offsite-restore source remained present;
- publication, disk, offsite-backup and offsite-restore guards all remained PASS.

Automation:
- `habbo-backup-daily.sh` now runs retention only after the new backup is atomically published, restore-verified and the runtime stamp has advanced;
- it then verifies the newly-created backup still exists;
- `disk-health-smoke.sh` fails if more than 20 local backup generations accumulate;
- `habbo-status.sh` reports local backup count;
- `verify-latest-backup.sh` requires the prune tool to be included in the backup ops overlay.

Real systemd daily-service proof:
- `habbo-backup-daily.service` manually started at 07:39:10 CEST;
- completed at 07:39:27 CEST with Result=success / ExecMainStatus=0;
- created `manual-20260924T053910Z`;
- retention saw 17 backups, kept 16 and deleted exactly 1 candidate;
- runtime stamp advanced to `053910Z`;
- local backup count returned to 16;
- VPS2 copied and verified `053910Z`;
- independent VPS2 restore drill on `053910Z` succeeded with 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1.

Live hashes:
- `backup-retention-prune.sh`: `1e0f1bf001a492ea5af11c0c72727aa21e1662f2f150611a3e631f9e74d25605`
- `backup-retention-report.sh`: `1bd7243d3ca827615c583ffbefbffccd85f1024a2a7d8967ca5bcabfba68ee32`
- `habbo-backup-daily.sh`: `4d0088805d234b7a5da270c68b44753f6d1060b58b3d4545d60b8e0c162a7995`
- `disk-health-smoke.sh`: `855c5decd4dd976a3e058dfe59d152abcd8e309e645cab923ac179ed39654e0b`
- `verify-latest-backup.sh`: `6143daa0f38db77094d8da7770098e79fb3149eb1501112db9538646093363dc`
- `habbo-status.sh`: `333ae7a600bd05650ffea433946a704e8ff716b5bd027e29b3e6f985f753c248`

Git commits:
- prune tool: `858582305612885c99073a9227da7bbcac66dcb0`
- report alignment: `687a3f3b7336fe45dc1f7c889ef8842939dfe69e`
- daily integration: `3c0d440f3f4a43060fc626ea321c9b80f45b9085`
- disk count guard: `c3c1caebf8faedc26c2d1870382108b925da285a`
- verifier integration: `5783419a4b2883411bd27c76cd166b061bd235cc`
- status count: `202cd41dd6368b93dfc41b3e4721ca0c346ee972`

## Offsite scheduling race closure 2026-09-24

The VPS2 pull no longer assumes the VPS1 daily backup always completes before 05:25.

Coordination changes:
- VPS2 pull and offsite restore drill share `/run/lock/habbo-vps1-offsite.lock` with a 120-second wait;
- pull reads the remote `ActiveState` of `habbo-backup-daily.service` before reading/blessing LATEST;
- states `active`, `activating`, `reloading` or `deactivating` cause an immediate pull failure;
- this is important because the daily service is Type=oneshot and is normally `activating` while backup work is running;
- pull timer changed from once-daily 05:25 to hourly catch-up at minute `:25`, Persistent=true, with up to 60 seconds randomized delay.

Timer proof:
- `systemd-analyze calendar '*-*-* *:25:00'` normalized successfully;
- systemd reported the next trigger at 08:25 CEST after the change;
- timer remained enabled + active/waiting.

Controlled delayed-backup proof:
- only `habbo-backup-daily.service` was temporarily overridden with `/bin/sleep 30`;
- remote backup service reached `ActiveState=activating`;
- VPS2 pull refused with `FAIL: VPS1 daily backup state is activating; refusing to bless the previous generation`;
- pull service Result=exit-code / ExecMainStatus=1;
- OnFailure recorder succeeded and wrote `OFFSITE_BACKUP_FAILED` on VPS1;
- hourly pull timer remained active;
- override was removed and the real daily ExecStart restored;
- a normal pull then succeeded and automatically cleared the failure latch.

Shared-lock proof:
- the offsite lock was externally held for 4 seconds;
- a pull started during the hold waited instead of failing or racing;
- elapsed time was about 5 seconds;
- pull then completed success, latch stayed clear and offsite smoke passed.

Live hashes:
- VPS2 offsite pull: `3a354ffc974118bde8b0f1a827d71807ff43b703cf280bff64500b45cc633c97`
- VPS2 restore drill: `866f5e245aca680add0aecd29493d816870e9233a11c7dbdde44d761ae8fd0c4`
- VPS2 pull timer: `d299bac29cb2b0eea4c0149a22c54ba64df0828e4ce451fdf63b08e2198a00f0`

Git commits:
- coordinated pull: `3b43678eea8a6a45c4ffd21802ad6785d8593b1b`
- shared-lock restore drill: `b095c9cc4b16af7d0da90771f8911bdb3cfc8cba`
- hourly catch-up timer: `cecabd0b719ec24dc67a91bfe20a686030827d47`

## VPS2 control-plane self-monitoring 2026-09-24

VPS1 now requires a fresh health proof for the VPS2 automation control plane itself, not only fresh historical pull/restore/WebKit results.

VPS2 heartbeat components:
- `/usr/local/sbin/habbo-vps2-control-plane-heartbeat.sh`;
- `habbo-vps2-control-plane-heartbeat.service`;
- `habbo-vps2-control-plane-heartbeat.timer`.

The heartbeat runs hourly at minute `:05`, Persistent=true, with up to 60 seconds randomized delay.
It validates four timers as enabled + active:
- `habbo-vps1-offsite-pull.timer`;
- `habbo-vps1-offsite-restore-drill.timer`;
- `habbo-public-webkit.timer`;
- `habbo-vps2-control-plane-heartbeat.timer` itself.

It also rejects any failed Habbo VPS2 unit matching the offsite/WebKit namespace.
A success writes root-only `/srv/habbo/VPS2_CONTROL_PLANE_STATUS` on VPS1 and clears `/srv/habbo/VPS2_CONTROL_PLANE_FAILED`.
A detected unhealthy control plane writes both status and failure latch and exits non-zero.

VPS1 `vps2-control-plane-smoke.sh` requires:
- status mode 0600 root:root;
- no failure latch;
- proof age <=7500 seconds;
- result=success;
- timers_total=4 and timers_healthy=4;
- failed_units=0.

Controlled WebKit-timer failure proof:
- WebKit timer temporarily disabled/stopped;
- heartbeat exited status1 and wrote failed status/latch;
- timer restored; next heartbeat succeeded and cleared latch.

Controlled self-monitoring proof:
- the heartbeat timer itself was temporarily disabled/stopped;
- a manual heartbeat detected its own disabled/inactive timer and exited status1;
- VPS1 smoke failed and `habbo-status.sh` reported VPS2 control-plane latch FAILED / proof FAIL / OVERALL DEGRADED;
- heartbeat timer re-enabled;
- next heartbeat returned success with 4/4 timers healthy;
- VPS1 latch cleared and status returned OVERALL READY.

Live/Git identity was explicitly checked after correcting an intermediate stale-copy commit: all seven control-plane artifacts matched byte-for-byte between live files and the project branch.

Live hashes:
- VPS2 heartbeat: `f1d68b72f472d9dc76340fb8b7078afc73ac4c3776feff84e2d4f5645556c5c2`
- heartbeat service: `c3d40f7e63baf51c08c881b5e56dec5316a3c1b018b53abd73b8f331528a518b`
- heartbeat timer: `a7d84f226f8e1bcafb1141b1b545bf0c9fe52d964c5ebb65bc08e9d4e64fbab6`
- VPS1 control-plane smoke: `f2d71d0a310d44da633641df2e71eddc5246abbc585c65bbb8afa0f7b052e70c`
- verifier: `26d7cd469f4b1a1100911735d598e38a65cd62da7e5e3c24bf1f4d6d40c11058`
- final validator: `b467b32d28c060db9768dbe3860eeec910c16766224e37c7b30aaa0b87d25d5f`
- status: `52d0f767a15aff38646ba0b06109e302020d855002cd2a43f376453b4f4d9929`

Git commits:
- heartbeat: `49856a8756c63b16f704642a1588387d36f67201`
- heartbeat service: `37a9a6b61b2bec8837f8b8dec4b41916421087d0`
- heartbeat timer: `e9eb35ac0cbceffa13127c3435559ed5791d6790`
- initial VPS1 smoke: `345f2b983302d8234844f83c88c7ff7adda14783`
- verifier integration: `8a85f852076d2592e132e02e733f11ce769936f1`
- final validator integration: `2b92b791d08f28895da5bbe1881c3335f99df90b`
- status integration: `cec55f3bdf39126ef2546972f031dbc30a7cc14e`
- corrected 4/4 smoke: `5074090a61198bc031deb767c6fbb504c7d3ef65`
- corrected 4/4 status: `c980bdd9669d655367c974faa77d0627c4c78b01`

## VPS2 self-healing recovery-space preflight 2026-09-24

The off-host restore path now has a shared, self-healing capacity preflight instead of a duplicated static free-space check.

Real incident:
- at 08:09 CEST the offsite restore of `manual-20260924T060757Z` refused to start because VPS2 root had only 384,148 KiB free;
- the restore service failed immediately, OnFailure wrote `OFFSITE_RESTORE_DRILL_FAILED` on VPS1, and the previous successful restore marker was preserved;
- investigation found 426 MiB of regenerated `/var/lib/apt/lists` plus 145 MiB of APT caches;
- Quetzal Playwright Chromium 1181, Puppeteer cache and the 2.81 GiB Emscripten image were explicitly left untouched;
- only regenerable APT lists/pkgcache/srcpkgcache were removed;
- VPS2 recovered to about 945 MiB free;
- rerun restore of `060757Z` succeeded with 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1, removed the temporary MariaDB image and cleared the restore failure latch.

Shared preflight:
- `/usr/local/sbin/habbo-vps2-space-preflight.sh`;
- minimum root free: 800 MiB;
- housekeeping trigger: root free below 900 MiB;
- minimum `/dev/shm` free: 512 MiB;
- housekeeping removes only APT package indexes and caches;
- it refuses cleanup while APT/DPKG lock files are actively held;
- APT activity detection uses real lock holders via `fuser`, not broad process-name matching.

The restore drill now calls this preflight directly before creating temporary restore state.
The hourly VPS2 control-plane heartbeat also calls the preflight and publishes `root_free_kb` and `shm_free_kb` to VPS1.
VPS1 `vps2-control-plane-smoke.sh` requires both free-space minima in addition to the 4/4 timer proof.
`habbo-status.sh` displays VPS2 root and shm margins explicitly.

Preflight validation:
- normal execution with ~945 MiB root free returned `cleanup=none`;
- forced housekeeping branch returned `cleanup=apt-metadata` and still passed the minimums;
- a restore run using the shared preflight succeeded and left the MariaDB test image absent.

Live hashes:
- VPS2 space preflight: `376a1cedd77cda8c52f1aae7c095482287fd3c2bad26db943371c4911ed12fdf`
- VPS2 heartbeat: `46eb9be68a5eaa6e7f8c25d3198f23d685cf585487a9ca308e4ef74d97e86969`
- VPS2 restore drill: `46a143910a49ecf07a42dcb7ee140d187ac51e081070d0f90e06f5b17ea68794`
- VPS1 control-plane smoke: `4a4964caf6e28faac71fe015db1b80a7e4c226fd982664539db4500fa61c1287`
- VPS1 status: `365d0f6786f5a177f400c1ef67b747d5ee06ac7e0877c791774f9499c3948c27`

Git commits:
- space preflight: `e1252602037a05309be2d7af583cd98e5e92a81a`
- heartbeat capacity integration: `ef5bf61c3b1c2d2cbf541c6cba5488fb1d7f2086`
- restore shared preflight: `d40c7de931fccb3eb7eb7f24dbd5fccbd51f0069`
- VPS1 recovery-space guard: `02a8aa4e5e192d587edfddab8bd748cb98ab6aea`
- VPS1 status margins: `b00e315af285e1881e53bd3de0c2ef095b2bc3cb`

## VPS2 heartbeat hard-failure path 2026-09-24

The VPS2 control-plane heartbeat now has an independent systemd `OnFailure` path for failures that occur before its own script can write a status marker.

Changes:
- shared failure recorder `habbo-vps1-offsite-failed.sh` now supports `kind=control`;
- heartbeat service has `OnFailure=habbo-vps2-control-plane-heartbeat-failed.service`;
- the failure service writes root-only `/srv/habbo/VPS2_CONTROL_PLANE_FAILED` on VPS1;
- heartbeat failed-unit scan now includes the `habbo-vps2-control-plane*` namespace;
- a later successful heartbeat clears the hard-failure latch.

Controlled hard-failure proof:
- heartbeat `ExecStart` was temporarily overridden with `/bin/false`;
- main heartbeat service ended Result=exit-code / ExecMainStatus=1;
- hard-failure recorder service ended Result=success / ExecMainStatus=0;
- VPS1 received `VPS2_CONTROL_PLANE_FAILED` mode 0600 with kind=control, failed unit, result, status and journal;
- `habbo-status.sh` reported VPS2 control-plane latch FAILED / proof FAIL / OVERALL DEGRADED;
- override removed and real unit restored;
- healthy heartbeat returned success, cleared latch, smoke passed and VPS1 returned OVERALL READY.

Live hashes:
- shared failure recorder: `065a20b72e3e309bd36e63f235695916c3278eef49e34a77fb5872c0643db986`
- heartbeat: `a60bf28a561760274b3c34945dc772e03072b50684522c767997c89dfbcb7b25`
- heartbeat service: `100abd5c69c6512dcf3927e353d8a8807be0e1ee0224524722c1421b395082d2`
- hard-failure service: `e630f58cc3fc48a6b0302031913ab23fc221a47e3ff9c9117593d70bc401789c`

Git commits:
- shared recorder control support: `5d16f48a82de255c7f76f1b44c2da16a2f117e4c`
- heartbeat failed-unit namespace: `a0fdfbfb0b4729aada5cf1bd0f22f6e0d3a6e5ce`
- heartbeat OnFailure wiring: `4c4e06f2ee635354cb4443e479156b8cdf8871fa`
- hard-failure service: `c71bd7d108c1ab666f32cbcc5910e0ba3f0a6bb5`

## VPS2 heartbeat hard-failure path proof 2026-09-24

The VPS2 control-plane heartbeat now has a separately proven hard-failure path for failures that occur before the heartbeat script can write its own remote latch.

Durable wiring:
- `habbo-vps2-control-plane-heartbeat.service` has `OnFailure=habbo-vps2-control-plane-heartbeat-failed.service`;
- the failure service calls the shared `habbo-vps1-offsite-failed.sh` recorder with `kind=control`;
- the recorder writes root-only `/srv/habbo/VPS2_CONTROL_PLANE_FAILED` on VPS1 and mirrors it under `/run`.

Controlled hard-failure proof:
- only the heartbeat service received a temporary drop-in replacing ExecStart with `/bin/false`;
- the heartbeat script did not run, so it could not create the latch itself;
- heartbeat service ended Result=exit-code / ExecMainStatus=1;
- `habbo-vps2-control-plane-heartbeat-failed.service` ended Result=success / ExecMainStatus=0;
- VPS1 received `VPS2_CONTROL_PLANE_FAILED` mode 0600 with kind=control, unit, result, exit status and journal evidence;
- VPS1 immediately reported control-plane latch FAILED, proof FAIL and OVERALL DEGRADED;
- the heartbeat timer remained active throughout.

Recovery proof:
- temporary drop-in removed and daemon-reload performed;
- heartbeat service returned Result=success / ExecMainStatus=0;
- success removed the hard-failure latch automatically;
- VPS1 control-plane smoke returned PASS with 4/4 timers and recovery-space margins;
- VPS1 returned to OVERALL READY;
- heartbeat timer remained enabled + active with a real next trigger.

Live/Git identity after the proof:
- heartbeat service: match=true;
- heartbeat failure service: match=true;
- shared failure recorder with `kind=control`: match=true.

## VPS2 failed-unit parser regression 2026-09-24

A controlled dual failure exposed a parser bug in the VPS2 control-plane heartbeat.

Scenario:
- heartbeat service and its OnFailure recorder were both temporarily forced to `/bin/false`;
- both services ended Result=exit-code / ExecMainStatus=1;
- no remote latch could be written because both the primary heartbeat and its recorder path were intentionally broken;
- heartbeat timer remained active.

Expected deferred recovery:
- after restoring both units, the next heartbeat should detect the recorder service still present in systemd failed state;
- it should publish failed control-plane status/latch to VPS1;
- the restored OnFailure recorder should then run successfully;
- a second heartbeat should return to success and clear the latch.

Bug found:
- heartbeat used `systemctl --failed --no-legend | awk '{print $1}'`;
- on this systemd version the first field is the visual bullet `●`, not the unit name;
- therefore the heartbeat incorrectly published `failed_units=0` while the recorder service was visibly failed.

Fix:
- failed-unit enumeration now uses `systemctl --failed --no-legend --plain` before extracting field 1;
- unrelated failed services remain filtered out; Habbo offsite/WebKit/control-plane units remain in scope.

Regression proof after fix:
- stale failed recorder was visible as `habbo-vps2-control-plane-heartbeat-failed.service`;
- first heartbeat after fix exited status1 and published `failed_units=1` to VPS1;
- VPS1 received control-plane failure latch and became OVERALL DEGRADED;
- restored OnFailure recorder ran successfully;
- second heartbeat published `failed_units=0`, 4/4 timers healthy, valid recovery-space margins, cleared the latch and returned VPS1 to OVERALL READY.

Live heartbeat hash after fix:
- `d6f745b83af56f5ee1b7748959e35d654a15b9cb3046be616372d6a96c78920c`

Git commit:
- `73dcef7c217dbd332ba65477be3af292257c1dd7`

## Full VPS2 offsite retention store scrub 2026-09-24

The VPS2 control plane now validates all three retained offsite generations, not only the current LATEST archive.

Added `/usr/local/sbin/habbo-vps1-offsite-store-smoke.sh` on VPS2.
It acquires the shared offsite lock (45-second wait) and requires:
- store directory mode 0700 root:root;
- LATEST mode 0600 root:root and path matching `manual-YYYYMMDDTHHMMSSZ.tar.gz`;
- exactly three retained tar.gz archives;
- one root-only SHA sidecar for each archive;
- archive size >1 MiB;
- sidecar SHA syntax + exact sidecar path;
- SHA-256 verification of all three archives;
- `gzip -t` structural verification of all three archives;
- no `.tmp` / `.partial` residue;
- LATEST must point at the lexically newest retained generation.

The hourly VPS2 control-plane heartbeat now runs this scrub and publishes:
- `offsite_store_healthy=1`;
- `offsite_archives=3`.

VPS1 `vps2-control-plane-smoke.sh` now requires both fields, and `habbo-status.sh` reports `VPS2 offsite store` plus archive count.

Controlled store-count regression:
- a temporary empty `manual-19990101T000000Z.tar.gz` was added as a fourth archive;
- standalone store smoke failed with `offsite archive count mismatch: 4 (expected 3)`;
- file removed and standalone smoke returned PASS.

End-to-end heartbeat regression:
- the same temporary fourth archive caused heartbeat Result=exit-code / ExecMainStatus=1;
- heartbeat published `offsite_store_healthy=0`, `offsite_archives=0` and detail from the scrub;
- VPS1 received the control-plane failure latch;
- VPS1 reported store FAIL and OVERALL DEGRADED;
- temporary archive removed;
- next heartbeat published `offsite_store_healthy=1`, `offsite_archives=3`, cleared the latch and returned VPS1 to OVERALL READY.

A Bash presentation bug found during integration (`OK` accidentally executed through nested command substitution) was fixed before promotion; the logical readiness calculation itself had remained correct.

Live hashes:
- offsite store scrub: `7c1fe74afb44de91f8aeb814b37ebff6939a38c28fdce5a0e4910016db0ac397`
- VPS2 heartbeat: `1293c84412687e66c2c5d0269d307c6deb09f69830770615e4178b9ece865ac2`
- VPS1 control-plane smoke: `c564901bd256488afca2deb8053272c936b4a9b5754ad205604f16a1bfff261f`
- VPS1 status: `2433b2fe406c2e42c106a8497663d9b8c3fd7321e47676c11e99946f72c2c5f7`

Git commits:
- store scrub: `176d9979920756805d5a843f3ff73b5ccddd762f`
- heartbeat integration: `c8cfb622c73bb4fc4bbb207378c2cffb3cfba027`
- VPS1 guard: `59485a8c1ede94a36d82937da92ef182846cd8b1`
- VPS1 status: `2e637fd872e4e53581d58e0c6c28c2404caaf094`

## Complete backup manifests and deep retained-store scrub 2026-09-24

Backup manifests and the VPS2 retained-store scrub were upgraded so every retained generation has an internally complete integrity contract, including hidden files such as `.env`.

Local backup publisher changes:
- `backup.sh` no longer uses shell glob `*` for permissions, dedupe or SHA generation;
- top-level regular files are enumerated with `find ... -print0 | sort -z`, so dotfiles are included;
- `.env` now participates in chmod normalization, hardlink dedupe and SHA256SUMS;
- SHA256SUMS contains every top-level regular file except SHA256SUMS itself.

Local verifier changes:
- `verify-latest-backup.sh` still runs `sha256sum -c`;
- it additionally compares the sorted real top-level file list against the manifest list 1:1;
- it requires `.env` to appear exactly through that complete manifest contract.

First complete-manifest generation:
- `manual-20260924T070721Z`;
- `.env` appeared exactly once in SHA256SUMS;
- 29 top-level files matched 29 manifest entries exactly;
- isolated restore passed 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1.

Offsite migration:
- VPS2 retention was deliberately rotated to three complete-manifest generations: `070721Z`, `070908Z`, `070929Z`;
- no legacy manifest generation remains in the three-file offsite retention set.

Deep VPS2 retained-store scrub:
- each of the three tarballs is verified by external SHA256 sidecar and `gzip -t`;
- each is then extracted sequentially into a root-only `/dev/shm` workdir;
- internal `SHA256SUMS` must verify;
- internal manifest coverage must equal the extracted top-level file set exactly;
- `.env` must be manifest-covered and mode 0600;
- critical files `.env`, disaster manifest, project context, docker-compose, DB dump, ops overlay and FINAL-v2 ZIP must exist;
- FINAL-v2 must match canonical SHA `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`;
- DB dump gzip and ops overlay tar must be readable;
- workdir is removed after each generation and an EXIT trap guarantees cleanup on interruption.

Deep tamper proof:
- a three-generation lab store was created under `/dev/shm`;
- baseline deep scrub passed;
- `.env` inside one lab tar was modified and the tar was repacked;
- the external archive SHA sidecar was recalculated, so the outer SHA layer was valid;
- deep scrub still failed specifically with `internal manifest verification failed`;
- laboratory removed; production 3/3 deep scrub returned PASS.

Local publication regression:
- publication smoke now requires exact top-level manifest coverage, `.env` presence and mode 0600 for every manifested file;
- a hardlink-based laboratory copy of LATEST passed baseline;
- only the `.env` manifest line was removed in the lab copy;
- smoke failed with `LATEST manifest coverage mismatch`;
- laboratory removed; production publication smoke returned PASS.

Control-plane integration:
- heartbeat now publishes `offsite_deep_verified=1` only when the full 3/3 deep scrub returns success;
- VPS1 control-plane smoke requires deep verification;
- status shows `VPS2 deep scrub = OK`.

A cleanup-trap integration regression was also found and fixed: the scrub initially printed PASS but returned rc=1 because an empty-workdir test in the EXIT trap propagated status 1. `cleanup_work()` now always returns 0 after cleanup/no-op.

Live hashes:
- `backup.sh`: `9fc4a663b6056b523ccfe4743595a4745667fbe91826633427d1bdd390cca037`
- `verify-latest-backup.sh`: `a979dd231d708c12564e3954facdd0c17453c593ac29467ce6de69070df27180`
- VPS2 deep store scrub: `a7e18747a74c8efdbb6acfed6045a0e34849720312cff2027c4283555b33c0db`
- VPS2 heartbeat: `da2dd76bfa4ef39889d03e02577ccd75a3b3537529d0e33c38569fbdcf9be660`
- `backup-publication-smoke.sh`: `b142abfa9a4e29510c883e24dfcf9d32e35098047d2e992fa8f47ded1ccaee1d`
- VPS1 control-plane smoke: `eb30b5ce2b9c3ac26b77b41a048cd89ad63307bedd682dd9ae1b9006a85b8b8e`
- `habbo-status.sh`: `ab39c5b36092ac31a2d54e7168a9769435440d23235e5d8b1f7fb85a2d0301ec`

Git commits:
- complete backup manifest publisher: `fe7c50ec003e96838a0d3b6db998f0d560e98dfb`
- exact manifest verifier: `e6d24c19c1e00a7518abd5d582a44562bb198b09`
- deep retained-store scrub: `ae35ee552f13b59b92e0a2597c814389be2f182f`
- heartbeat deep proof: `7f8d0cae62ab461a061950890e22e9f73f5932ed`
- publication exact coverage: `c95cc7525b78b22409959e39bee7b40631bdfb58`
- VPS1 deep guard: `da0c1de45dd04f27ac5f81741b8e68b6cff8c0b9`
- status deep field: `dd8f3739defbcf0e69d30841a9f7eab81dbbd3b2`

Explicit post-update live/Git comparison: all seven artifacts returned `match=true`.

## VPS2 journal pressure relief and latest disaster-drill alignment 2026-09-24

The VPS2 recovery-space preflight gained a second conservative housekeeping phase for persistent journal pressure.

Behavior:
- APT metadata/cache cleanup remains the first action below 900 MiB root free;
- after that cleanup, if root free is still below 900 MiB and `/var/log/journal` exceeds 150 MiB, the preflight rotates journald and vacuums archived journals to about 120 MiB;
- `/var/log/btmp`, browser caches, npm, Quetzal, Puppeteer, Emscripten and unrelated Docker images remain untouched;
- journald housekeeping only trims older system journal history, not application data.

Real pressure-relief proof:
- VPS2 had about 889 MiB free and journald occupied 200 MiB;
- preflight ran with `cleanup=apt-metadata+journal`;
- journal usage fell from about 200 MiB to 120 MiB;
- root free increased to about 971 MiB;
- shared preflight remained PASS.

Post-cleanup recovery proof on `manual-20260924T072113Z`:
- offsite copy verified;
- full 3/3 deep retained-store scrub passed;
- WebKit PASS;
- heartbeat published 4/4 timers, deep store proof and about 988 MiB root free;
- offsite restore succeeded with 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1;
- temporary MariaDB image was absent afterward;
- no Habbo VPS2 unit remained failed;
- all five VPS1 failure latches were clear;
- VPS1 returned OVERALL READY.

Latest local disaster-drill alignment:
- before refresh, `/run/habbo-disaster-drill` still referenced `manual-20260924T054309Z`;
- `habbo-disaster-drill.service` was run against current `manual-20260924T072113Z`;
- Result=success / ExecMainStatus=0;
- stamp advanced to `072113Z` with canonical Havana commit `b550f00f27788145d26723fd19e943aa63504a63`;
- retention re-applied: 16 kept / 0 candidates;
- status returned OVERALL READY.

VPS2 space-preflight live hash after journald support:
- `6f29be0b5685bf59a3c6975a32e751f0f9193eda3354d9c9a1ac638022974665`

Git commit:
- journald pressure relief: `c30f479930388b5de579dbebecbda5c6c82cbaaf`

## Complete backup manifest and deep offsite scrub 2026-09-24

Backup integrity now covers hidden top-level files and the internal contents of all three retained offsite generations.

Local backup manifest hardening:
- `backup.sh` no longer relies on shell glob `*` for top-level permissions, dedupe or checksums;
- all top-level regular files are enumerated with `find`, including dotfiles such as `.env`;
- `SHA256SUMS` contains every top-level regular file exactly once except `SHA256SUMS` itself;
- `.env` therefore has an explicit checksum entry;
- permissions and hardlink dedupe now include hidden top-level files too.

`verify-latest-backup.sh` now:
- verifies SHA256SUMS;
- compares the sorted real top-level file list against the manifest list 1:1;
- requires `.env` to appear in the manifest;
- preserves the isolated MariaDB restore proof.

First complete-manifest generation:
- `manual-20260924T070721Z`;
- `.env` appears exactly once in SHA256SUMS;
- 29 actual top-level files = 29 manifest entries;
- isolated restore passed 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1.

Offsite retention was migrated completely to the new format:
- `manual-20260924T070721Z`;
- `manual-20260924T070908Z`;
- `manual-20260924T070929Z`;
- all three are complete-manifest generations, so no legacy exception remains in VPS2 retention.

Deep offsite scrub:
- each retained tarball is still checked by external SHA-256 and `gzip -t`;
- each tarball is then extracted sequentially into `/dev/shm`;
- its internal SHA256SUMS is verified;
- internal manifest coverage must match all top-level files exactly;
- `.env` must be manifest-covered;
- critical files must exist: `.env`, disaster-recovery manifest, project context, compose file, DB dump, ops overlay and canonical FINAL-v2 ZIP;
- canonical FINAL-v2 SHA-256 is rechecked internally;
- DB dump gzip and ops overlay tar structure are checked;
- each temporary workdir is removed, with EXIT cleanup protection.

Strong internal-integrity regression:
- a full 3-generation laboratory copy of the offsite store was created in `/dev/shm`;
- one archive's `.env` was modified internally;
- that archive was repacked and its external SHA sidecar recalculated, so the outer integrity layer looked valid;
- deep scrub still failed specifically with `internal manifest verification failed`;
- laboratory data was removed and the production 3/3 scrub returned PASS.

Local publication regression:
- a hardlink-based laboratory copy of current LATEST was created on VPS1;
- only `.env` was removed from the laboratory SHA256SUMS;
- publication smoke failed with `LATEST manifest coverage mismatch`;
- production publication smoke remained PASS and laboratory data was removed.

Control-plane integration:
- heartbeat publishes `offsite_deep_verified=1` only after the complete 3-generation deep scrub succeeds;
- VPS1 control-plane smoke requires `offsite_deep_verified=1`;
- `habbo-status.sh` reports `VPS2 deep scrub = OK`;
- publication smoke reports `manifest=complete+relative+verified`.

Live hashes:
- backup.sh: `9fc4a663b6056b523ccfe4743595a4745667fbe91826633427d1bdd390cca037`
- verify-latest-backup.sh: `a979dd231d708c12564e3954facdd0c17453c593ac29467ce6de69070df27180`
- offsite store deep scrub: `a7e18747a74c8efdbb6acfed6045a0e34849720312cff2027c4283555b33c0db`
- VPS2 heartbeat: `da2dd76bfa4ef39889d03e02577ccd75a3b3537529d0e33c38569fbdcf9be660`
- backup publication smoke: `b142abfa9a4e29510c883e24dfcf9d32e35098047d2e992fa8f47ded1ccaee1d`
- VPS1 control-plane smoke: `eb30b5ce2b9c3ac26b77b41a048cd89ad63307bedd682dd9ae1b9006a85b8b8e`
- VPS1 status: `ab39c5b36092ac31a2d54e7168a9769435440d23235e5d8b1f7fb85a2d0301ec`

Git commits:
- complete backup manifest: `fe7c50ec003e96838a0d3b6db998f0d560e98dfb`
- exact verifier coverage: `e6d24c19c1e00a7518abd5d582a44562bb198b09`
- deep offsite scrub: `ae35ee552f13b59b92e0a2597c814389be2f182f`
- heartbeat deep flag: `7f8d0cae62ab461a061950890e22e9f73f5932ed`
- complete publication smoke: `c95cc7525b78b22409959e39bee7b40631bdfb58`
- VPS1 deep guard: `da0c1de45dd04f27ac5f81741b8e68b6cff8c0b9`
- VPS1 deep status: `dd8f3739defbcf0e69d30841a9f7eab81dbbd3b2`

Explicit live↔Git comparison after promotion: all seven artifacts matched byte-for-byte.

## Disaster restore drill tmpfs isolation 2026-09-24

The local non-destructive disaster restore drill no longer builds its temporary reconstructed root under /tmp on the VPS1 root filesystem.

Changes:
- disaster-restore-drill.sh requires at least 512 MiB free in /dev/shm;
- its workspace is now /dev/shm/habbo-drill.<random>;
- the existing EXIT trap removes the workspace;
- successful output explicitly reports workspace=tmpfs;
- disk-health-smoke.sh fails on stale /dev/shm/habbo-drill.* workdirs older than 10 minutes.

Sizing before migration:
- VPS1 root free: about 2.1 GiB;
- /dev/shm free: about 2.0 GiB;
- Havana source bundle: ~4.2 MiB;
- FINAL-v2 ZIP: ~3.4 MiB;
- frontend overlay source: ~25 MiB;
- current backup ops overlay: ~24 KiB;
- current backup frontend overlay archive: ~11 MiB.

Real systemd proof on manual-20260924T073429Z:
- habbo-disaster-drill.service Result=success / ExecMainStatus=0;
- journal reported compose=resolved, cloudflare=coherent, systemd=verified, final_v2=verified, db_restore=verified, workspace=tmpfs;
- drill stamp advanced to 073429Z;
- zero habbo-drill.* workdirs remained in /dev/shm;
- disk health returned PASS with stale_disaster_drill_workdirs=0.

Live hashes:
- disaster-restore-drill.sh: 263f6729d3c6834ce92f0c71f7a16f4c5be8d5b9ae6220adf8f29cbfd31090f0
- disk-health-smoke.sh: df70c5a35f430d2790abe3f658d6eb38b2825597b5d2957204e411d6700e3804

Git commits:
- tmpfs disaster drill: 0761f96015f833cf3f77bad0fb085caa35f11e86
- stale drill workdir guard: 9ee09aea0122ce1692f00ca0dc5d49a8110c012d

Explicit live↔Git comparison after promotion: both artifacts matched byte-for-byte.

## Offsite restore isolation proof contract 2026-09-24

The VPS2 offsite restore drill is now self-contained with the same complete-manifest contract as the deep store scrub, and its proof marker records the isolation properties that were actually checked.

Restore drill hardening:
- archive SHA sidecar is still verified before extraction;
- extracted SHA256SUMS is checked directly with `sha256sum -c`;
- actual top-level files and manifest entries must have identical sorted-set digests;
- `.env` must be present in the internal manifest;
- the temporary MariaDB container is explicitly inspected after creation;
- NetworkMode must be `none`;
- `docker port` must be empty;
- /var/lib/mysql must be the expected 384 MiB tmpfs.

Both the local VPS2 status file and the proof copied to VPS1 now include:
- `manifest=complete`;
- `workspace=tmpfs`;
- `network=none`;
- `db_datadir=tmpfs`.

VPS1 offsite-restore-drill-smoke.sh requires all four fields in addition to archive SHA, host, age and restored DB invariants.

Real proof on manual-20260924T074228Z:
- restore service Result=success / ExecMainStatus=0;
- archive SHA-256 a9609475c50304930d34e2c34c12fe334fa0ed8c882bcf7d1fee17222d7261e1;
- manifest=complete;
- workspace=tmpfs;
- network=none;
- db_datadir=tmpfs;
- restored DB 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1;
- VPS1 offsite restore smoke returned PASS with the same isolation fields.

Live hashes:
- VPS2 restore drill: 3ef71dfcd4344823ad018043560aff6b6f8b7684f45cfb4b51a7ad22f96a2d53
- VPS1 restore proof smoke: bed008a1b282709d3422b1976b82690a8f7bf2c950d2ac3ca7741ac0f352ecca

Git commits:
- isolated restore proof: 870e45fd38e6c16dd7265d4d2414cc62ac27ba04
- VPS1 proof contract: e4ee318c9fdf68d61287d081e41825dfb687c4b8

Explicit live↔Git comparison after promotion: both artifacts matched byte-for-byte.

## Complete backup manifests and deep offsite scrub 2026-09-24

Backup integrity was hardened again after discovering that the previous top-level `sha256sum -- *` manifest omitted dotfiles such as `.env`.

Local backup publication contract:
- `backup.sh` now enumerates every top-level regular file with `find`, including dotfiles;
- permissions are normalized for all top-level files, including `.env`;
- hardlink dedupe now also applies to dotfiles;
- `SHA256SUMS` contains every top-level regular file except `SHA256SUMS` itself;
- `verify-latest-backup.sh` compares the actual top-level file set against the manifest 1:1;
- `.env` must appear exactly once in the manifest;
- the isolated DB restore remains unchanged and still requires exact 88/40/1/1.

First complete-manifest generation:
- `manual-20260924T070721Z`;
- `.env` present exactly once in SHA256SUMS;
- 29 actual top-level files = 29 manifest entries;
- isolated restore PASS 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1.

Offsite migration:
- two additional daily generations were created and synchronized after 070721Z;
- VPS2 retention was thereby migrated completely to the new format;
- retained generations became 070721Z, 070908Z and 070929Z;
- no legacy manifest generation remained in the three-copy offsite window.

Deep VPS2 scrub:
- each of the three retained tarballs is extracted sequentially to `/dev/shm`;
- its internal SHA256SUMS is verified;
- internal manifest coverage must exactly match every top-level regular file;
- `.env` must be manifest-covered and mode 0600;
- required recovery files are checked explicitly;
- canonical FINAL-v2 ZIP hash must remain `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`;
- DB dump must pass `gzip -t`;
- ops overlay must be readable as tar.gz;
- workdir is deleted between generations and protected by an EXIT cleanup trap.

Strong internal-integrity regression:
- a complete 3-copy offsite store was cloned into `/dev/shm`;
- `.env` inside one archive was modified;
- that archive was repacked and its EXTERNAL SHA sidecar was recalculated, so the outer archive check remained valid;
- deep scrub still rejected it with `internal manifest verification failed`;
- the laboratory was removed and production 3/3 scrub returned PASS.

Local publication regression:
- current LATEST was cloned using hardlinks into a root-only lab;
- only the lab copy of SHA256SUMS was replaced with a version lacking `.env`;
- publication smoke rejected it with `LATEST manifest coverage mismatch`;
- production publication smoke remained PASS and the lab was removed.

Control-plane integration:
- heartbeat publishes `offsite_deep_verified=1` only when the full 3-generation scrub succeeds;
- VPS1 control-plane smoke requires deep verification;
- `habbo-status.sh` reports `VPS2 deep scrub = OK`.

Live/Git identity:
- backup.sh;
- verify-latest-backup.sh;
- offsite store scrub;
- VPS2 heartbeat;
- backup-publication-smoke.sh;
- VPS2 control-plane smoke;
- habbo-status.sh;
- all seven were compared byte-for-byte against the deployment branch and returned match=true.

## Pipefail-safe recovery verification 2026-09-24

A real regression was found while creating the first post-deep-scrub canonical backup.

Symptom:
- `habbo-backup-daily.service` failed before promotion;
- staging was cleaned correctly and LATEST stayed on the previous valid generation;
- verifier logged `FAIL: ops overlay missing VPS2 recovery smoke` plus `tar: stdout: write error`.

Root cause:
- the recovery smoke actually existed in `/srv/habbo/ops` and was included by `tar -C /srv/habbo -czf ... ops`;
- `verify-latest-backup.sh` used `set -o pipefail` together with `tar -tzf ... | grep -Fxq ...`;
- `grep -q` exited immediately after finding the correct entry;
- `tar` then received SIGPIPE / write error;
- pipefail converted that successful match into a failing pipeline.

Fix:
- long producer pipelines no longer use early-exit `grep -q`;
- tar membership check now uses `grep -Fx ... >/dev/null` so grep consumes the stream;
- the same defensive change was applied to Havana `git bundle list-heads` checks in both the backup verifier and disaster-source smoke.

Regression proof:
- disaster-recovery-source-smoke returned PASS after the change;
- `habbo-backup-daily.service` rerun completed Result=success / ExecMainStatus=0;
- promoted `manual-20260924T081208Z`;
- its ops overlay contains `ops/vps2-control-plane-recovery-smoke.sh`;
- `.env` appears exactly once in SHA256SUMS;
- isolated restore verifier passed 88/40/1/1;
- local retention remained 16.

Live hashes:
- verify-latest-backup.sh: `264a15654f5f7914a03ab116e0895c979a9503c48527a04813c8be0c31b39dca`
- disaster-recovery-source-smoke.sh: `c3b1f394745618563caa6465a142f52b37868a784783ac3d6fc9ff91d5352b75`

Git commits:
- verifier pipefail fix: `e9c63bfb8a7f04c546f560548bf8b868154a5061`
- disaster-source pipefail fix: `cbbf84ebcfaf1ea13efc1215b2c5a1adb5bad755`

## Semantic VPS2 recovery validation across all offsite copies 2026-09-24

The deep offsite scrub now validates the VPS2 recovery kit semantically in every retained generation, not only byte-for-byte.

Transition handling:
- enabling the semantic check immediately exposed one retained legacy archive (`074228Z`) without a top-level VPS2 recovery kit;
- the archive was not corrupt, but no longer satisfied the new contract;
- no permanent legacy exception was added;
- two fresh daily generations were created and synchronized;
- VPS2 retention became exactly `081418Z`, `081937Z`, `081959Z`, all on the new recovery-kit format.

Per-generation semantic checks now include:
- `vps2-control-plane-overlay.tar.gz` present;
- `vps2-control-plane-files-sha256.txt` present with exactly 21 entries;
- overlay extraction succeeds;
- all 21 file hashes verify;
- tar inventory matches the manifest exactly;
- exactly 9 Habbo scripts;
- exactly 12 systemd units;
- Bash/Python syntax validation;
- every Habbo `ExecStart` path resolves inside the kit;
- every timer resolves to an included service;
- required pull/restore/heartbeat/WebKit scripts and timers are present.

Production proof:
- strict semantic scrub passed all three retained generations;
- no `/dev/shm/habbo-offsite-store-scrub.*` or recovery workdir residues remained;
- VPS2 had ~984 MiB root free after the scrub.

Live hash:
- offsite store semantic scrub: `3e8cb7d91c7580b30f61c744f7c6bdedc82e74343858e4826cc14be3d6f05d59`

Git commit:
- `8dcff3586e1f10b46fb6356ab09bebf1ebd01ad1`

## VPS2 recovery kit live-state refresh 2026-09-24

The VPS2 recovery kit was compared against the live control plane after the semantic offsite scrub work.

Drift audit:
- 21 expected recovery files checked against VPS2 live;
- 20 matched exactly;
- 1 drifted: `usr/local/sbin/habbo-vps1-offsite-store-smoke.sh`;
- the drift was expected because the live store scrub had just gained deep internal + semantic recovery validation.

Refresh:
- rebuilt `vps2-control-plane-overlay.tar.gz` from the exact 21 live paths;
- regenerated `vps2-control-plane-files-sha256.txt` from live bytes;
- local rebuild verified 21 files, 9 scripts and 12 units;
- staged on VPS1 and validated with `vps2-control-plane-recovery-smoke.sh` before promotion;
- promoted atomically into `/srv/habbo/releases/disaster`;
- canonical recovery smoke and disaster-recovery-source smoke both passed afterward.

Old artifact hashes:
- overlay: `4397bfa841303e8d684d4ce27be7b5109e0eb3f11f2155895acbc687d6522c4d`
- manifest: `d820459cd22ca0a687989b77db1f25e20a76748329da98fa2f0db376caf3b82e`

Current artifact hashes:
- overlay: `881b0165193bf6cc9cd68855f5681cc8f48f9b2064e11069197fc699e71050b5`
- manifest: `c280526054b37c256ac512859d2316eb57d78906784751af4de1208e29cd106d`

Post-promotion live-state proof:
- 21/21 MATCH;
- 0 drift;
- 0 missing.

The refreshed 21-file manifest is also versioned in Git.
Git commit:
- `10f6bb0c8ce2150cd91428006f59d2d9a9bbcc43`

## Live-current VPS2 recovery kits in all offsite generations 2026-09-24

The offsite scrub now rejects recovery kits that are internally valid but stale relative to the current VPS2 control plane.

Mechanism:
- every retained backup already carries `vps2-control-plane-files-sha256.txt`;
- during deep scrub VPS2 now runs that manifest directly against `/`, comparing all 21 recovery files to current live bytes;
- a mismatch fails the store scrub and therefore the hourly control-plane heartbeat.

Self-reference regression found during rollout:
- adding the live-current check changed `habbo-vps1-offsite-store-smoke.sh` itself;
- that script is one of the 21 recovery-kit files;
- therefore the just-refreshed kit immediately became 20/21 current again;
- strict scrub correctly detected the drift on `082943Z` rather than silently accepting it.

Final kit refresh:
- rebuilt the 21-file kit after the store scrub reached its final `semantic+live` form;
- final store-smoke hash inside the kit: `2643fc9af6fed862a25622e358b78b41bfe79445df36e49ea8b63631f1ed7496`;
- canonical recovery overlay hash: `9948095a6663f6b48d8aca7692de4e8e77db6364eccfbef6697c129ea0f1067c`;
- canonical recovery manifest hash: `061701f0df795d601a60a8738444dff36fae8c1ce5e2833987f4faf219916813`;
- staging and canonical recovery smoke both passed 21 files / 9 scripts / 12 units.

Offsite migration:
- created and synchronized `083337Z`, `083403Z`, `083425Z` after the final kit refresh;
- VPS2 retention became exactly those three generations;
- strict offsite scrub passed 3/3 with `vps2-recovery=semantic+live`;
- no scrub/recovery workdir residue remained;
- VPS2 root had about 976 MiB free afterward.

Durable Git state:
- store scrub commit: `ee27fdc2f200e2caebdb3fe13fea0bb6acd3d928`;
- refreshed 21-file recovery manifest commit: `07a9c35e64b5aa347b1998426c2305246f0140a5`.

## Executable VPS2 bootstrap rehearsal from retained backups 2026-09-24

The VPS2 recovery contract now proves that each retained recovery kit can actually reconstruct the control-plane filesystem tree, rather than only passing hashes/syntax/semantic inspection.

Initial retained-kit proof against then-LATEST `manual-20260924T090134Z.tar.gz`:
- bootstrap `--check-prereqs` from the retained kit passed Docker, Playwright 1.55.0, WebKit 2203, bridge-old SSH identity/fingerprint and VPS1 host fingerprint;
- bootstrap `--rehearsal` reconstructed a clean tmpfs target;
- source and target recovery manifests both verified 22/22;
- reconstructed inventory: 10 scripts, 12 systemd units, 4 offline timer enable symlinks;
- systemd unit verification passed after correctly combining the rehearsal unit path with the host's standard systemd unit paths;
- rehearsal workspace was removed afterward.

Hourly retained-store integration:
- `habbo-vps1-offsite-store-smoke.sh` now executes `--check-prereqs` plus `--rehearsal` for every one of the three retained generations;
- each rehearsal must verify the 22-file manifest, 10 scripts, 12 units, 4 timer links and `systemd-analyze verify`;
- production store output now reports `vps2-recovery=semantic+live+bootstrap`;
- three-generation candidate run completed successfully in about 6 seconds.

Canonical VPS1 recovery-source integration:
- `vps2-control-plane-recovery-smoke.sh` now executes the embedded bootstrap in rehearsal mode against a clean tmpfs target;
- canonical recovery smoke reports `bootstrap=rehearsed`.

Controlled rollout:
- VPS1 received a root-only `VPS2_CONTROL_PLANE_FAILED` maintenance latch before live changes, forcing OVERALL DEGRADED throughout migration;
- store smoke + heartbeat were installed together on VPS2; control/status/recovery-smoke were installed together on VPS1;
- one early rebuild attempt aborted before modification because of shell quoting; another ambiguous no-output run was explicitly audited and found to have left the canonical kit unchanged;
- a fresh local rebuild then verified all 22 live files before upload, including store-smoke hash `9242918838cf84dd423e921e0402f3c5f6152847d0ca9b635252a62aa70311ba` and heartbeat hash `e69fccf455676da59616bab96ba80d6a3bd8b3a3f858dc49d37228098b9136e3`;
- staged recovery smoke passed before promotion;
- canonical kit promotion was performed under `/run/lock/habbo-backup.lock` with rollback copies;
- post-promotion canonical recovery smoke and disaster-recovery-source smoke both passed.

Canonical recovery artifacts after promotion:
- overlay SHA-256: `3f4d64abb4862125ce823eb98bba6b64545199aa436ccd3d4b324af931cefe62`;
- manifest SHA-256: `026ed24857cc8b860af9d6f187a4fd4fd9aff429d6824059b9b608d56cb58aa4`.

Offsite migration:
- created/synchronized `093257Z`, `093323Z`, `093345Z`;
- VPS2 retention became exactly those three generations;
- strict 3/3 scrub passed with `semantic+live+bootstrap`;
- heartbeat published `offsite_bootstrap_verified=1`, `offsite_archives=3`, timers 4/4 and failed_units=0;
- maintenance latch cleared automatically only after the healthy heartbeat;
- VPS1 returned to OVERALL READY.

Git commits:
- store scrub bootstrap rehearsal: `195eb77383d4e3eec59b569a4fba16154203e37f`;
- heartbeat bootstrap proof: `bf49bd568e312a8a9a24f3831a0673d5d424db17`;
- VPS1 control-plane guard: `00a7e0cd09d99168ed71abbaabead4d2dc543f5a`;
- VPS1 status: `b3c8d41208cf64d225b3a5d1dd9ba1891562841f`;
- canonical recovery smoke rehearsal: `303a24fe11f71bf2c8262753bb95294b27494ac4`;
- refreshed 22-file recovery manifest: `ed82b53357476fe75613543f15aecbaca052aef9`.

Live/Git identity after rollout: all six updated artifacts matched byte-for-byte.

## Strict 3-generation VPS2 kit rotation after control-plane drift 2026-09-24

The retained offsite policy remains intentionally strict: all three retained generations must contain a VPS2 recovery kit matching the current live control plane, in addition to internal semantic/bootstrap validation.

A temporary latest-only live-drift experiment was not retained. The canonical all-3-live-current policy was restored before promotion.

Event and recovery:
- heartbeat/service hardening changed the live VPS2 control plane after the previous offsite generations had been created;
- strict store scrub correctly reported recovery-kit drift beginning with `manual-20260924T093323Z.tar.gz`;
- `/srv/habbo/ops/refresh-vps2-control-plane-kit.sh` rebuilt the canonical recovery source from the exact 22 live VPS2 files;
- staging recovery smoke passed with 22 files / 10 scripts / 12 units / bootstrap rehearsed;
- promoted recovery source passed again plus disaster-recovery-source smoke;
- refreshed overlay SHA-256: `8d3ec8a5f764c960f1fe3e95b5aa6a88e4b03e15833a417609a56e36eef74098`;
- refreshed manifest SHA-256: `36975b8352a0ebdb75b6c7fcb97b0de953172b2ee710536f96bc207f0d951cc0`.

Strict retention rotation:
- created and synchronized `manual-20260924T095109Z`;
- created and synchronized `manual-20260924T095134Z`;
- created and synchronized `manual-20260924T095158Z`;
- VPS2 retention became exactly those three generations;
- final 3/3 scrub passed `external-sha256+gzip+internal-manifest-full`, canonical critical files, `semantic+live+bootstrap`, private permissions and zero temp residue.

Latest-generation proof:
- offsite restore of `095158Z` passed manifest=complete, tmpfs workspace/datadir, network=none, 88 tables / 40 navigator_styles / RogerVideo=1 / room1000=1;
- archive SHA-256: `b227ff5d36877773d82dc64bae7074954950153aecaf7c8a288b9b05a2b689c2`;
- heartbeat returned success with 4/4 timers, no failed Habbo units and 3/3 deep-bootstrap store;
- VPS1 returned OVERALL READY;
- aggregate deployment validator passed on `095158Z` with isolated local restore and live DB untouched.

Heartbeat service retains `TimeoutStartSec=120` to leave margin for legitimate offsite-lock waiting plus deep scrub/bootstrap work. Its live unit is byte-identical to the Git branch.

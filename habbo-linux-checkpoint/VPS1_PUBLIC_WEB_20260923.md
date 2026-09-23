# VPS1 public web publication — 2026-09-23

## Symptom and root cause

An iPhone Safari request to `https://habbo.gamemodai.pro` showed that Safari could not find the server. The failure was reproduced from VPS2/control host `ES217221`: `habbo.gamemodai.pro` did not resolve, and HTTP/HTTPS failed before reaching TLS.

The root cause was a missing public DNS record for `habbo.gamemodai.pro`. The Habbo deployment itself was healthy but intentionally loopback-only.

## Public architecture

The website is now published through the existing Cloudflare Tunnel without exposing MariaDB, Shockwave, MUS, Flash or RCON directly.

Cloudflare ingress on VPS1:
- dynamic Habbo website routes -> `http://127.0.0.1:18081`;
- static prefixes `/c_images`, `/client`, `/gordon`, `/dcr`, `/flash`, `/web-gallery`, `/styles`, `/js` -> `http://127.0.0.1:18080`;
- existing Stremio ingress remains in the same connector and was regression-tested.

The DNS hostname is routed to the existing tunnel through a Cloudflare Tunnel CNAME. Public DNS was independently verified with Cloudflare and Google DNS-over-HTTPS.

No Habbo firewall opening was added. The game/database/admin ports remain bound to loopback.

## Static website overlay

Havana's HTML templates require legacy web assets that are distributed separately from the Havana repository and were not present in FINAL-v2.

The official Havana documentation references `havana_www_10_09_2024.7z`. The downloaded archive used for the deployment had:

- size: 508016467 bytes;
- SHA-256: `877273abddab946849aed3d5d2416185fe175a7207a602890fd08ebe7e376ed0`;
- archive integrity test: PASS.

Only the required `web-gallery` tree was retained in the VPS1 overlay:
- approximately 25 MB;
- 1030 files;
- deployed under `/srv/habbo/web/web-gallery`.

Compatibility paths `/srv/habbo/web/styles/local/uk.css` and `/srv/habbo/web/js/local/uk.js` were also created as empty local overrides, matching the empty equivalents in the official static package.

The approximately 485 MB downloaded archive and temporary extraction tree were deleted after deployment. The canonical FINAL-v2 ZIP was not modified.

## External validation

From VPS2 using an iPhone Safari user agent:
- `/`: HTTP 200, title `Habbo 2009 ~ Home`;
- `/register`: HTTP 200;
- favicon: HTTP 200;
- `landing.js`: HTTP 200;
- `frontpage.css`: HTTP 200;
- front-page GIF: HTTP 200;
- R39 external variables: HTTP 200;
- V31 DCR: HTTP 200.

TLS validation passes without disabling certificate verification.

The VPS2 local resolver showed an occasional DNS timeout during repeated requests. Direct Cloudflare and Google DoH queries continued to return valid answers, and the retrying public smoke passes from VPS1 and VPS2. This is distinct from the original missing-DNS-record failure.

Legacy footer URLs `/papers/disclaimer` and `/papers/privacy` are referenced by Havana templates but are not implemented by this build. They are not required for home, registration or login connectivity.

## Operations and recovery

Public smoke:
`/srv/habbo/ops/public-web-smoke.sh`

The smoke uses an iPhone Safari UA, retries transient network/DNS errors and validates the homepage plus critical dynamic/static resources.

The backup workflow now includes:
- `cloudflared-stremio-legacy-config.yml`;
- `web-static-overlay.tar.gz` containing `web-gallery`, `styles` and `js`;
- the existing database, ops, units and deployment overlays;
- `SHA256SUMS` covering the backup.

Stable latest-backup pointer:
`/srv/habbo/LATEST_PUBLIC_WEB_BACKUP`

Use `/srv/habbo/LATEST_PUBLIC_WEB_BACKUP` to locate the newest verified full operational backup. This avoids baking a stale timestamp into the runbook as later documentation-only backups are produced.

The database restore-roundtrip-tested backup remains:
`/srv/habbo/backups/manual-20260923T183558Z`

For a full recovery, restore the DB and normal overlays, extract `web-static-overlay.tar.gz` into `/srv/habbo/web`, restore the backed-up Cloudflare ingress config if required, restart the Habbo units and Cloudflare connector, then run both the internal and public smoke tests.

## Regression status

After publishing Habbo and restarting the shared Cloudflare connector:
- `cloudflared-stremio-legacy.service`: active;
- Stremio public endpoint: expected HTTP 307;
- Habbo backend smoke: PASS;
- public Habbo web smoke from VPS1: PASS;
- public Habbo web smoke from VPS2: PASS.

This is a VPS1 deployment/publication overlay. No new canonical Habbo bundle or release was created.

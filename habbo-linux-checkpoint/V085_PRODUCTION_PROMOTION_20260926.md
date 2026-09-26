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

## Post-deploy soak and WebKit cancellation hardening
- A read-only post-deploy soak confirmed `habbo-web-v085`, Cloudflare, Havana and static services had `NRestarts=0`; public `/`, `/play`, `habbo-es.js` and `habbo-modern.css` returned HTTP 200 at roughly 60–70 ms.
- The only recent Cloudflare origin error was the already-known transient `18100 connection refused` during the controlled proxy restart at 10:56:36 CEST; no later Habbo/Cloudflare 5xx or proxy errors were observed.
- A fresh official WebKit run exposed a false positive: WebKit emitted `Load request cancelled` for `/local-web/habbo-es.js` during authenticated navigation even though that first-party asset completed with HTTP 200.
- The smoke now suppresses that cancellation only when the matching `/local-web/habbo-es.js` response was actually observed as HTTP 200, using the same guarded contract already used for `/security_check`. All other request failures remain fatal.
- The patched smoke passed two temporary real runs and then the official systemd run; `WEBKIT_FAILED` is clear and the current proof is PASS.
- Regression `test_webkit_authenticated_settle_v085.py` now requires the guarded successful-cancellation set and the HTTP-200 prerequisite.
- VPS2 recovery kit was regenerated from the corrected live control plane and passed exact inventory/hash/syntax/bootstrap rehearsal; recovery fingerprint is `23bf18e3ff0366c6f517a971e1c1503c56e43c45fae7987ed88b209eea75c981`.
- Post-hardening canonical backup: `/srv/habbo/backups/manual-20260926T091819Z`; isolated restore PASS and matching VPS2 offsite store PASS.
- Runtime healthcheck and disaster drill both reference `manual-20260926T091819Z` and PASS.
- Final aggregate deployment validator PASS after the hardening.

## Periodic gameplay proof + fresh offsite restore closure
- The official daily WebKit smoke now covers the full authenticated path `home+register+login+me+V31+R39`, not only login/navigation.
- V31 is required to reach `window.__habboV31.connected === true`; R39 is required to reach `window.__habboR39.connected === true`.
- V31/R39 browser HTML is checked for SSO leakage and legacy `<object>/<embed>` plugin material; browser delivery remains noVNC-only.
- Gameplay network failures are evaluated first-party-only so unrelated third-party cancellations (for example Discord assets) do not create false production failures; JavaScript errors remain fatal.
- Official systemd WebKit proof PASS with `attempts=1`, iPhone 14 Plus and scenario `home+register+login+me+V31+R39`.
- VPS1 remote proof checker now requires that exact complete scenario; regression test locks the contract.
- The VPS2 offsite restore drill had an obsolete Havana bundle SHA (`77672...`) while the canonical disaster source already used `9e3ee88b...`; the pin was reconciled to `9e3ee88b2670e7156c7c05bca13646b9d5378e1b8d83f3a7f2eb53fefa344a4f`.
- Fresh offsite restore of the current generation is now proven, not merely inherited from an older backup.
- Final canonical backup: `/srv/habbo/backups/manual-20260926T093550Z`, SHA256 `4eb59c3b6ee937b2cee95ae844f5c90d3d9c4c703d4b4bd10da7cd9e23a40095`.
- Matching VPS2 offsite restore PASS: tmpfs, network=none, 88 tables, 40 navigator styles, RogerVideo=1, room1000=1.
- Recovery fingerprint: `d35f3a8faf8d46133ae96874e5996147a8d9c6515a4236771740cf7f1e9adf13`.
- Runtime health and disaster drill both reference `manual-20260926T093550Z`.
- Final aggregate deployment validator PASS with the complete WebKit gameplay scenario and fresh offsite restore proof.

## Smoke-owned runtime cleanup closure
- Post-deploy review confirmed the daily WebKit gameplay smoke could leave the R39 native Flash/noVNC runtime alive after the browser closed, keeping a smoke-only session resident longer than necessary.
- The daily wrapper now snapshots whether V31 and R39 were healthy before the smoke. On exit, it only attempts to stop runtimes that were not healthy before the smoke and therefore were started by the smoke itself.
- Before stopping a smoke-owned runtime, the wrapper checks for an established WebSocket connection on the corresponding public loopback port (`18131` for V31, `18139` for R39). If a connection exists, cleanup is skipped to avoid disrupting a real user.
- Cleanup is attached to `trap ... EXIT`, so it runs on both successful and failed smoke executions.
- Verified behavior: full WebKit `home+register+login+me+V31+R39` PASS, followed by V31 `healthy=no`, R39 `healthy=no`, and no listeners on `18131/18139/59131/59139`.
- Daily backup retention was also re-audited: `habbo-backup-daily.sh` already performs guarded runtime validation followed by `APPLY=1 KEEP_RECENT=14 backup-retention-prune.sh`; no duplicate systemd retention hook was added.
- Final canonical backup after this control-plane change: `/srv/habbo/backups/manual-20260926T095026Z`, SHA256 `edcabb2b3f34b430d85a666fd12d8ecd5aeba82194dfc15c2d2f3131ff4c2c1e`.
- Local retention reapplied from 20 to 16 protected generations.
- Matching VPS2 offsite copy and isolated offsite restore PASS; runtime health and disaster drill both reference `manual-20260926T095026Z`.
- Recovery fingerprint after the cleanup-aware control-plane refresh: `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.
- Final aggregate deployment validator PASS and `habbo-status.sh` = `OVERALL READY` with both V31/R39 runtimes idle after monitoring.

## Recovery ops-overlay hygiene closure
- A residual historical file `/srv/habbo/ops/verify-latest-backup.sh.pre-pipefix` was discovered during a post-deploy drift audit. It was inactive, but `ops-overlay.tar.gz` archived the whole `ops/` tree and therefore preserved the stale verifier in recovery artifacts.
- The historical copy was moved out of the active ops tree into `/srv/habbo/backups/ops-history/`.
- `backup.sh` now excludes `ops/*.pre-*`, `ops/*.bak*` and editor backup files ending in `~` from `ops-overlay.tar.gz`.
- `verify-latest-backup.sh` now rejects any ops overlay containing those stale backup/editor patterns, so future drift is detected rather than silently archived.
- Clean canonical generation: `/srv/habbo/backups/manual-20260926T095727Z`; its `ops-overlay.tar.gz` passed explicit hygiene inspection and contains the canonical verifier without stale copies.
- Matching VPS2 offsite archive restored successfully in tmpfs/network-none isolation: 88 tables, 40 navigator styles, RogerVideo=1, room1000=1.
- Backup SHA256: `d821a8e02b03517d89d844a81d7bcbf5bebc79581338df793ed8152bae53d787`.
- Recovery fingerprint: `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.
- Runtime health and disaster drill both reference `manual-20260926T095727Z`; aggregate deployment validator PASS.

## Daily backup retention edge closure
- `disk-health-smoke.sh` rejects more than 20 local `manual-*` backup generations.
- The daily wrapper previously ran runtime health **before** retention, so starting a daily cycle with 20 backups could create the 21st, fail health, and exit via `set -e` before pruning.
- `habbo-backup-daily.sh` now runs guarded retention (`APPLY=1 KEEP_RECENT=14`) immediately after publishing/verifying the new backup and before runtime health.
- The current backup is asserted to survive retention; runtime health then must advance to that exact backup.
- Real boundary test PASS: start=18 -> manual backup=19 -> manual backup=20 -> official daily service created the next generation -> retention reduced local generations to 16 -> `habbo-backup-daily.service` result=success / exit=0 -> runtime marker advanced to `/srv/habbo/backups/manual-20260926T100752Z`.
- Canonical generation after the boundary proof: `/srv/habbo/backups/manual-20260926T100752Z`, offsite SHA256 `8ab94f7b366366e0102f69e743cae5e6960d37b9906c45450bcd41b1bbac3380`.
- Matching VPS2 offsite store and isolated restore PASS; runtime health and VPS1 disaster drill both reference `manual-20260926T100752Z`.
- Final aggregate deployment validator PASS with `backup_count=16` and recovery fingerprint `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.

## Operational mirror drift closure
- A post-closure drift audit compared the versioned VPS1/VPS2 operational files against the exact files executed by production and control-plane systemd units.
- All apparent VPS2 differences except the already-synchronized gameplay files were trailing-newline-only; those were normalized so the repository now byte-matches the live control plane.
- VPS1 had three real repository lags that were already active and fully validated in production: `deployment-final-validate.sh` includes `habbo-web-v085` plus the VPS2 recovery smoke; `disaster-restore-drill.sh` performs `git fsck --full --no-dangling`; and `habbo-status.sh` monitors `habbo-web-v085`. The repo now mirrors those proven live versions exactly.
- Remaining VPS1 operational/unit newline-only differences were normalized to exact live bytes. No production runtime file was changed during this repository reconciliation.
- Exact audit result after synchronization: `VPS1_EXACT_DIFFS=0`, `VPS2_EXACT_DIFFS=0` across the audited critical scripts/units.
- The old Havana bundle SHA `77672bee...` in the historical public-web notes is now explicitly labelled historical/superseded; current recovery pin remains `9e3ee88b2670e7156c7c05bca13646b9d5378e1b8d83f3a7f2eb53fefa344a4f`.
- Retention dry-run after the closure: 16 managed backups, 16 kept, 0 candidates, `KEEP_RECENT=14`; daily backup already runs retention before creating the next generation.

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

## First autonomous production cycle proof
- After the periodic gameplay/recovery hardening was committed, the normal timers produced a newer backup generation without operator intervention: `/srv/habbo/backups/manual-20260926T100752Z`.
- That generation passed the normal latest-backup verifier and isolated local restore: 88 tables, 40 navigator styles, RogerVideo=1, room1000=1, network=none, tmpfs datadir, no published restore ports and live DB untouched.
- The scheduled offsite pull published the same generation to VPS2; `offsite latest match` remained OK and the store smoke kept 3 deeply verified deterministic generations.
- The offsite restore drill then restored `manual-20260926T100752Z` itself, SHA256 `8ab94f7b366366e0102f69e743cae5e6960d37b9906c45450bcd41b1bbac3380`, with the same DB invariants and full isolation.
- VPS2 heartbeat subsequently reported 4/4 timers healthy, no failed units, clear latch and recovery fingerprint `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.
- Local backup retention also self-converged back to 16 protected generations.
- Aggregate `deployment-final-validate.sh` PASS against the automatic `100752Z` generation, including full WebKit scenario `home+register+login+me+V31+R39`, fresh offsite restore proof, recovery/bootstrap checks and public HTTP 200.
- `habbo-status.sh` remained `OVERALL READY` throughout the autonomous cycle.

## Official-cycle idempotency proof
- A second full cycle was triggered through the real systemd services rather than ad-hoc commands to prove the operational chain is repeatable.
- `habbo-backup-daily.service` created `/srv/habbo/backups/manual-20260926T103715Z`, returned success, retained the current generation, converged local storage back to 16 managed backups and advanced `/run/habbo-runtime-health` to the exact same backup.
- The official VPS2 pull published `/var/backups/habbo-vps1/manual-20260926T103715Z.tar.gz`; offsite store smoke kept 3 deeply verified deterministic generations and latest matched production.
- The official offsite restore drill restored that exact generation in tmpfs/network-none isolation: 88 tables, 40 navigator styles, RogerVideo=1, room1000=1, no live DB mutation.
- Offsite archive SHA256: `05b2263830d32433937a4d6094774f8a1156e971c97d87bf9e490965841140d4`.
- VPS2 control-plane heartbeat PASS with 4/4 timers, no failed units and recovery fingerprint `b2c2efa39e6f702ce6f77ad3dc8d19a61b3febf616fafd9b9929f1d46e9ccfbf`.
- VPS1 disaster drill subsequently advanced to `/srv/habbo/backups/manual-20260926T103715Z` and PASS.
- Aggregate `deployment-final-validate.sh` PASS against `103715Z`, including full WebKit scenario `home+register+login+me+V31+R39`, fresh offsite restore proof, public HTTP 200 and backup_count=16.
- `habbo-status.sh` remained `OVERALL READY`; repeating the official chain did not accumulate runtimes, backups, latches or recovery drift.

## Scheduled daily-path rehearsal
- The real `habbo-backup-daily.service` was executed end-to-end, not merely `backup.sh` manually.
- It created `/srv/habbo/backups/manual-20260926T104813Z`, then applied retention with `KEEP_RECENT=14`, reducing the local set from 17 to 16 protected generations while preserving `LATEST`, referenced restore/drill generations and milestone backups.
- The wrapper then ran runtime health and advanced `/run/habbo-runtime-health` to the same `manual-20260926T104813Z` generation.
- VPS2 offsite pull/store smoke PASS for that generation; offsite restore drill PASS in tmpfs/network-none with 88 tables, 40 navigator styles, RogerVideo=1 and room1000=1.
- VPS2 heartbeat PASS; VPS1 disaster drill PASS on `manual-20260926T104813Z`.
- Final aggregate deployment validator PASS with local backup count=16 and public Habbo HTTP 200.
- This proves the actual timer target (`habbo-backup-daily.service`) performs backup -> retention -> runtime validation safely, rather than relying on manually sequenced maintenance.

## Scheduled operations + postboot rehearsal
- Executed the exact `habbo-backup-daily.service` target used by the daily timer. It created `/srv/habbo/backups/manual-20260926T104813Z`, applied retention, preserved protected generations, and advanced runtime health to the same backup.
- Retention reduced the local set to 16 protected generations and proved the daily wrapper ordering is backup -> verified publication -> retention -> runtime validation.
- VPS2 pulled and restored `104813Z` successfully; VPS1 disaster drill and aggregate final validator also passed against `104813Z`.
- Re-ran the real `habbo-postboot-validate.service`; it passed on attempt 1 and refreshed `/run/habbo-postboot-validated` to `manual-20260926T104813Z`, while public Habbo remained HTTP 200 (~73 ms).
- `systemd-analyze verify` across the Habbo production/recovery units on VPS1 and VPS2 reported no Habbo unit errors or dependency/order cycles. Only unrelated host warnings from snapd/rc-local were emitted.

## Wide operational mirror audit closure
- A broader live-vs-repository audit was run after the scheduled/postboot rehearsal, beyond the earlier critical-file subset.
- VPS2 remained byte-identical for the mapped operational files.
- VPS1 exposed 12 repository drifts: 9 were final-newline-only and 3 were real repository lags in already-live validators (`cloudflare-ingress-smoke.sh`, `network-perimeter-smoke.sh`, `public-web-smoke.sh`).
- The live validators already enforced v0.8.5 behavior: frontend `18100`, V31/R39 WebSocket routes `18131/18139`, `/play`, localized JS/CSS and noVNC asset availability.
- Those proven live bytes, plus the nine EOF-only files, were mirrored into `vps1-overlay`; production was not modified.
- Syntax/systemd validation PASS; the 12-file captured live comparison is now byte-identical and the preceding VPS2 audit remains zero-drift.
- Natural timer observation also confirmed `habbo-runtime-healthcheck.timer` fired itself at 13:00:06 CEST, exited 0 at 13:00:15 and retained `manual-20260926T104813Z` as the validated latest backup.

## Multi-hour autonomous soak confirmation
- At 13:26 CEST, several hours after production closure, `habbo-status.sh` remained `OVERALL READY` with no Habbo failed units on VPS1 or VPS2.
- The autonomous daily path had advanced the canonical generation to `/srv/habbo/backups/manual-20260926T104813Z`; local retention held at 16 backups and offsite latest matched.
- Offsite restore for `104813Z` remained proven in tmpfs/network-none with 88 tables, 40 navigator styles, RogerVideo=1 and room1000=1.
- A later automatic WebKit proof remained PASS with attempts=1 and full scenario `home+register+login+me+V31+R39`.
- Fresh aggregate `deployment-final-validate.sh` PASS against `104813Z`.
- Read-only mirror audit after the soak: VPS1 wide operational set `31/31` byte-identical to Git; VPS2 recovery/control-plane set `23/23` byte-identical to Git. No production change was required.

## Daily self-healing recovery-kit refresh
- A real `habbo-backup-daily.service` rehearsal exposed one remaining automation gap: a backup could be locally valid but carry a stale VPS2 recovery kit if the live control plane changed after the previous manual kit refresh.
- The drift detector correctly caught the condition on `manual-20260926T115730Z`; exactly one live control-plane file differed: `/usr/local/sbin/habbo-public-webkit-daily.sh`.
- `habbo-backup-daily.sh` now refreshes and fully rehearses the VPS2 recovery kit before creating each daily backup.
- Failure semantics deliberately preserve data: if the VPS2 kit refresh fails, the local backup, retention and runtime-health path still runs, but the daily service exits non-zero afterward so recovery drift cannot be reported as healthy.
- The actual systemd daily service was executed after the change and PASSed, including recovery-kit refresh, backup restore verification, retention to 16 generations and runtime-health advancement.
- Canonical automatic generation: `/srv/habbo/backups/manual-20260926T120051Z`; offsite SHA256 `2de76580cf895d7aa74a7c2492e0c9333ba0f4878fada44c99b84f967487524c`.
- Matching VPS2 store smoke and isolated offsite restore PASS; recovery fingerprint `432b6678ed7ca13e3481e133b8557dc88fd0211ff62a17fdbaced707c79decbc`.
- VPS1 disaster drill and runtime health both reference `manual-20260926T120051Z`.
- Final aggregate deployment validator PASS after the fully automated rehearsal.

## Weekly offsite restore forced-fresh pull closure
- The VPS2 weekly restore service previously had only `After=habbo-vps1-offsite-pull.service`; ordering alone did not guarantee the pull service would actually be started.
- `habbo-vps1-offsite-restore-drill.service` now declares `Requires=habbo-vps1-offsite-pull.service` while retaining `After=...`, so every restore activation first starts and successfully completes a fresh offsite pull or fails visibly.
- Behavioral proof: starting only the restore service advanced the pull `ExecMainStartTimestampMonotonic` from `432429865963` to `432514250540`; the restore remained queued until pull completion and then restored the newly pulled generation.
- Real daily wrapper rehearsal then refreshed the complete VPS2 recovery kit (29 files / 14 scripts / 15 units), created `/srv/habbo/backups/manual-20260926T122914Z`, applied retention to 16 protected local generations, and advanced runtime health.
- Starting only the restore service after that rehearsal pulled and restored exactly `manual-20260926T122914Z` on VPS2; archive SHA256 `8d6d06217aeadd4b46981173c1db9b90b266be833321322c7e66cbbf6489e881`; tmpfs/network-none restore invariants PASS.
- VPS1 disaster drill also advanced to `manual-20260926T122914Z`.
- Final aggregate validator PASS with both Chromium desktop and WebKit iPhone full `home+register+login+me+V31+R39` proofs, 5/5 VPS2 timers, recovery fingerprint `1a1e4b01016f2d5ef331ee35e127276ebf774312a128759ad7e8dd97dc539c5a`, backup count 16 and no failed Habbo units.

## Periodic Chromium/PC proof + recovery closure
- Production now has a daily Chromium desktop regression monitor in addition to WebKit/iPhone.
- Chromium runs at desktop viewport 1440x900 and proves home+register+login+me+V31+R39, including real V31 and R39 public noVNC connections.
- The Chromium monitor uses the same guarded first-party network semantics as the hardened WebKit flow and checks that V31/R39 browser HTML does not expose SSO/plugin markup.
- Browser monitors share /run/lock/habbo-public-browser-smoke.lock, preventing WebKit and Chromium from competing for V31/R39 runtime ownership.
- Chromium systemd proof PASS fresh with attempts=1; remote latch is clear.
- VPS2 Chromium timer is enabled/active and is now the fifth monitored control-plane timer.
- Recovery kit expanded from 23 files / 11 scripts / 12 units / 4 timer links to 29 files / 14 scripts / 15 units / 5 timer links. Hash, syntax, inventory and bootstrap rehearsal PASS.
- Canonical post-Chromium backup: /srv/habbo/backups/manual-20260926T124015Z.
- Backup SHA256 on VPS2: 8837884e4c5702116ad936a7175e5c371de78a9459fc15dba2136267b2556274.
- Fresh isolated offsite restore of 124015Z PASS: network=none, tmpfs datadir, 88 tables, 40 navigator styles, RogerVideo=1, room1000=1.
- Recovery fingerprint: 1a1e4b01016f2d5ef331ee35e127276ebf774312a128759ad7e8dd97dc539c5a.
- Runtime health and disaster drill both reference manual-20260926T124015Z.
- Daily backup retention is operational, not merely configured: the 2026-09-26 12:29 UTC run applied KEEP_RECENT=14, preserved milestones/referenced generations and pruned two stale backups; the daily service itself completed successfully.
- Final aggregate deployment validator PASS with both Chromium desktop and WebKit iPhone full gameplay proofs.

## Chromium executable resolver hardening
- The periodic Chromium smoke no longer pins Playwright revision 1181 in source. It resolves the highest executable cached Chromium/headless-shell revision under `PLAYWRIGHT_BROWSERS_PATH`, with an explicit `HABBO_CHROMIUM_EXECUTABLE` override for controlled recovery/debug cases.
- Resolver regression PASS; current cache contains Chromium/headless-shell revision 1181 and selects the working headless-shell path automatically.
- Official Chromium systemd smoke PASS after the resolver change: desktop 1440x900, `home+register+login+me+V31+R39`, attempts=1, failure latch clear.
- VPS2 recovery kit regenerated successfully with 29 files / 14 scripts / 15 units and bootstrap rehearsal PASS.
- Canonical post-resolver generation: `/srv/habbo/backups/manual-20260926T130444Z`.
- Offsite SHA256: `a4b4d17b8941492c40a3a71d89ca73a70c996bc37d2582d633f5efdc7344f5ae`.
- Fresh VPS2 isolated restore of `130444Z` PASS: tmpfs, network=none, 88 tables, 40 navigator styles, RogerVideo=1, room1000=1.
- Recovery fingerprint: `fea9619ea4e0b810d852cef0368282e7c1dd349d32c07756488c1bb9e7f5a223`.
- Runtime health and disaster drill both reference `manual-20260926T130444Z`.
- Final aggregate validator PASS with Chromium + WebKit full gameplay proofs and fresh offsite restore.

## Durable backup/disaster failure latches
- Added persistent failure latches for scheduled backup and disaster drill: `/srv/habbo/BACKUP_FAILED` and `/srv/habbo/DISASTER_DRILL_FAILED`.
- `habbo-backup-daily.service` now uses `OnFailure=habbo-backup-daily-failed.service`; the handler records timestamp, systemd result/status, current latest backup and recent journal. A successful guarded backup removes `BACKUP_FAILED` only at the end of the complete success path.
- `habbo-disaster-drill.service` now uses `OnFailure=habbo-disaster-drill-failed.service`; the handler records equivalent evidence. A successful isolated disaster drill removes `DISASTER_DRILL_FAILED` only after the restore proof is complete.
- `habbo-status.sh` treats either latch as fatal to readiness even if the most recent systemd `Result` is currently success, preserving historical failure visibility until a later proven-successful run clears it.
- Synthetic latch lifecycle test PASS for both paths: manually created latch -> `OVERALL DEGRADED`; real successful backup/drill -> latch cleared -> `OVERALL READY`.
- The backup/restore contract archives both new failed units and both handlers; local verifier and VPS2 offsite restore require them to be present.
- New validated generation after the latch lifecycle test: `/srv/habbo/backups/manual-20260926T132452Z`, offsite SHA256 `5e3a093fda51bef7ec88b8d14737194461bb4e405ae249aa34fb7111f4cb2d98`.
- VPS2 store smoke and isolated offsite restore PASS for `132452Z`; final aggregate deployment validator PASS with exit code 0.

## Durable postboot failure-latch closure
- Audit found the remaining asymmetry in scheduled/boot validation: habbo-postboot-validate.service had no durable OnFailure latch, unlike runtime, backup, disaster, WebKit, Chromium and VPS2 recovery jobs.
- Added habbo-postboot-validate-failed.service and ops/postboot-failed.sh. On failure they persist /srv/habbo/POSTBOOT_FAILED with timestamp, unit result, exec status, latest backup and recent journal.
- habbo-status.sh now degrades while POSTBOOT_FAILED exists.
- A successful postboot validation clears POSTBOOT_FAILED only after publishing /run/habbo-postboot-validated.
- Safe behavioral proof without breaking production: manually invoked the failure handler -> POSTBOOT_FAILED created -> habbo-status.sh = OVERALL DEGRADED; restarted only habbo-postboot-validate.service -> validation PASS -> latch cleared -> OVERALL READY.
- Backup contract now captures habbo-postboot-validate-failed.service and ops/postboot-failed.sh; verify-latest-backup.sh requires both and requires the OnFailure wiring.
- disaster-restore-drill.sh now treats habbo-postboot-validate-failed.service as a mandatory restored unit.
- Real habbo-backup-daily.service PASS generated /srv/habbo/backups/manual-20260926T133735Z with the new postboot failure contract included.
- Matching VPS2 archive SHA256: d979e65f9010f4d537a4f986448bf75a160e0dfc0df5bb5ff5fa6604757728cb.
- Matching VPS2 isolated restore PASS: tmpfs, network=none, 88 tables, 40 navigator styles, RogerVideo=1, room1000=1.
- Runtime health and VPS1 disaster drill both advanced to manual-20260926T133735Z.
- VPS2 recovery fingerprint: 350d044edf0688a16f5b11255b3cefa82b0a20a7dd0f3f5cdb272eec37c5c9fe.
- Aggregate deployment-final-validate.sh PASS with the new postboot failure unit present in the backup/restore contract.

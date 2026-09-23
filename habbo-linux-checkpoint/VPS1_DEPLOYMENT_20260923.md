# VPS1 deployment — FINAL-v2 — 2026-09-23

## Scope
Deploy the already-validated immutable FINAL-v2 release to VPS1/OLD. No R39/V31 reinvestigation and no mutation of the canonical ZIP.

## Target and source
- VPS1/OLD: SSH alias `bridge-old`, host `85.208.23.189`, hostname `secureme`.
- Canonical asset: `habbo-2009-dual-linux-FINAL-v2-20260923.zip`.
- Size: `3476825` bytes.
- SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`.
- VPS1 copy: `/srv/habbo/releases/final-v2/habbo-2009-dual-linux-FINAL-v2-20260923.zip`.
- The ZIP passed exact size/hash, `unzip -t`, internal `EVIDENCE_SHA256.txt`, and embedded QEMU 9.2.4 verification on VPS1.

## VPS1 overlay architecture
The immutable release remains untouched. VPS-specific runtime/configuration lives under `/srv/habbo`.

- Docker Compose: MariaDB 11.5.2, Havana server, Havana web.
- MariaDB host binding: `127.0.0.1:13307 -> 3306`.
- Havana: `127.0.0.1:12321` Shockwave, `12322` MUS, `12323` Flash, `12309` RCON.
- Havana web: `127.0.0.1:18081`.
- systemd `habbo-static.service`: `127.0.0.1:18080`.
- systemd `habbo-websockify.service`: `127.0.0.1:18082 -> 127.0.0.1:12323`.
- Docker restart policy: `unless-stopped`.
- Docker, habbo-static and habbo-websockify are enabled for boot.
- No public UFW rule was added. Existing Stremio, WireGuard, Cloudflare and nginx services were not changed.

## Validation performed
A pre-change backup was created at `/srv/habbo/backups/deploy-final-v2-20260923-195330`, including sanitized operational config copies and a compressed DB dump.

A real restart of the Docker stack and both Habbo systemd units was performed. After settling:
- MariaDB: healthy.
- Schema: 88 tables and 40 navigator_styles.
- RogerVideo: id 1, offline, selected room 1000.
- Room 1000: RogerVideo Lab.
- Expected listeners 12309/12321/12322/12323/13307/18080/18081/18082: PASS.
- Static HTTP 18080 and Havana web 18081: PASS.
- No fatal application errors observed after restart; transient DB connection warnings occurred only during the forced restart window.
- Persistent smoke test: `/srv/habbo/bin/habbo-smoke-test` -> PASS.

## Operations
`/srv/habbo/bin/habbo-control {start|stop|restart|status|logs|smoke}`

Backup:
`/srv/habbo/bin/habbo-backup`

VPS-local runbook:
`/srv/habbo/docs/VPS1_FINAL_V2_DEPLOYMENT.md`

## Recovery
Before risky changes, run `habbo-backup`. Validate the selected backup's `SHA256SUMS`, restore compose/.env/systemd unit files as needed, then restore `havana.sql.gz` into the MariaDB container using the credentials already held locally in the deployment environment. Do not copy those credentials into Git or knowledge.

## Remaining validation boundary
The backend/persistence deployment is validated. Historical R39 and V31 gameplay evidence in Release v1.1 remains PASS. This deployment record does **not** claim a new graphical avatar/WALK run on VPS1 because that requires an external graphical client path. A fresh gameplay check, if required for the VPS1 deployment gate, should use fresh one-use SSO credentials and verify room/avatar/WALK without persisting the ticket.

## Fresh R39 validation preparation on VPS1
- Official Adobe Flash Player 32.0.0.465 was fetched using the immutable FINAL-v2 helper and verified: archive SHA-256 `883f7aa23301fc80de879501157533a4acdbfee0721ed7c57676dc032fdf96c3`, player SHA-256 `0bdd5116aa4e8dc88fb9e705c85c1f7ef4a29415ffb9b2132a3eb1aeafaae7b0`.
- Runtime path: `/srv/habbo/r39/runtime/flashplayer`.
- VPS1 already has Xvfb, xdotool, ImageMagick, ffmpeg and x11vnc, so headless graphical validation is technically possible.
- A first native Flash probe successfully created an Adobe Flash Player 32.0.0.465 X11 window, but did not establish TCP 12323 or authenticate. This is recorded as a probe failure, not gameplay PASS.
- The probe's temporary SSO was cleared afterwards and the canonical backend smoke test returned PASS again.
- V31 assets on VPS1 include the hiperesp launcher, PRoot 5.4, explicit QEMU i386 9.2.4 and Wine32 5.11. The live `vars.txt` is intentionally absent after credential hygiene; only `vars.example.txt` remains, so a fresh local CRLF vars file must be generated for the next V31 validation run.

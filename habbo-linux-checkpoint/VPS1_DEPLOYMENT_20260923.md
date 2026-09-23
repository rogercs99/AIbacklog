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

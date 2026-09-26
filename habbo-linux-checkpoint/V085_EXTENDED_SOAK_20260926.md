# Habbo v0.8.5 — Extended production soak — 2026-09-26 evening

## Scope
Read-only post-deploy soak several hours after the v0.8.5 promotion, preserving the active product/runtime state and avoiding unrelated failed units or concurrent bootstrap work.

## Fresh production evidence
- `habbo-status.sh`: `OVERALL READY`.
- Public Habbo HTTP: `200`; shared Stremio ingress: `307` as expected.
- Canonical latest backup: `/srv/habbo/backups/manual-20260926T175326Z`.
- Offsite latest match: OK; offsite restore proof: OK; all Habbo failure latches clear.
- Current recovery fingerprint: `7e791406dca223418e6d910c7caf6346c0fc27c8d505d06b31865a9453eff1b2`.

## Fresh browser proof
- WebKit/iPhone 14 Plus official smoke executed at `2026-09-26T17:59:13Z`: PASS, attempts=1.
- WebKit scenario: `home+register+login+me+V31+R39`.
- Chromium/Desktop 1440x900 official smoke executed at `2026-09-26T18:00:15Z`: PASS, attempts=2.
- Chromium scenario: `home+register+login+me+V31+R39`.

## Live drift proof
- Fresh autonomous drift watch at `2026-09-26T18:00:37Z`: PASS.
- Baseline SHA256: `94583088a5bd20dd2bd38a24a185861e9087569e2f47d2f5b7cc3c8709ac1d6a`.
- Release files: 14, verified=1.
- Tracked summary: `matches=87 drifts=0 missing=0 notes=0`.
- Live drift failure latch: clear.

## Aggregate validation
Fresh `/srv/habbo/ops/deployment-final-validate.sh`: PASS across VPS1 smoke, network perimeter, shared Cloudflare ingress, disk health, backup publication, DB consistency, secret permissions, disaster source, VPS2 recovery, offsite backup+restore, Chromium proof, WebKit proof, live drift proof, VPS2 control plane, dynamic iPhone assets, public web and isolated backup restore.

## Concurrency note
The repository had unrelated concurrent modifications in the VPS2 browser bootstrap self-repair files. This soak did not modify, stage or commit those files. Historical `v31-web-touch-lab.sh` remains deliberately untracked.

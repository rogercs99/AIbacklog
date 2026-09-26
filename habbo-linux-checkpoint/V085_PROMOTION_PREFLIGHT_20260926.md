# Habbo v0.8.5 — production promotion preflight (2026-09-26)

Scope: read-only production inspection + Git/lab hardening. No production deployment or service modification was performed.

## Target resolution
- MCVPS current host `ES217221` is not VPS1 production.
- Canonical Habbo VPS1 is SSH alias `bridge-old`, hostname `secureme`.
- VPS1 root `/srv/habbo` is present.

## VPS1 current product health
PASS:
- `habbo-stack`, `habbo-static`, `habbo-websockify`, `cloudflared-stremio-legacy` active.
- Public `https://habbo.gamemodai.pro/` returns HTTP 200.
- Latest backup exists: `/srv/habbo/backups/manual-20260926T031053Z`.
- `verify-latest-backup.sh`: PASS.

## Promotion blockers
The new read-only preflight intentionally returns `PROMOTION_BLOCKED` with two blockers:

1. Remote WebKit proof latch failed.
   - Failure occurred after the page `load` event while waiting for final authenticated `/me` `networkidle`.
   - Playwright WebKit error: page crashed.
   - This is a regression-runner failure, not evidence that the public Habbo page itself is unavailable.

2. VPS2 control plane reports offsite recovery-store drift.
   - Exact live-vs-archive drift is limited to two files:
     - `/usr/local/sbin/habbo-public-webkit-daily.sh`
     - `/usr/local/sbin/habbo-public-webkit-smoke.py`
   - The retained recovery kit predates the authenticated `home+register+login+me` WebKit smoke update.

## WebKit runner hardening prepared in Git only
The versioned VPS2 WebKit smoke was synchronized with the authenticated live runner and hardened so that after `/me` navigation it no longer waits for `networkidle`. Instead it waits for a visible `body`, while still requiring:
- `/security_check` HTTP 200;
- `/me` HTTP 200;
- authenticated username visible in the page;
- no collected HTTP/request/JS errors.

A temporary, non-installed copy of this exact settle change was executed from VPS2 against the public site and passed the full `home+register+login+me` flow on iPhone 14 Plus WebKit.

Static regression: `tools/test_webkit_authenticated_settle_v085.py` PASS.
Read-only target preflight: `tools/habbo-v085-promotion-preflight.sh`.

## Canonical local artifact
`habbo-web-local-v0.8.5-chrome-safari-pass-20260926.zip`
SHA-256: `4fb36dd2daa0f2e7a191a10649859ad7910020793ad29b0378c24f45409b0a4c`

## Gate
Production promotion remains blocked until the two validation-infrastructure blockers are reconciled and the read-only preflight returns `PROMOTION_PREFLIGHT_PASS`. No product deployment is authorized by this document.

## Additional rehearsal evidence
- The corrected temporary WebKit smoke passed the authenticated iPhone 14 Plus flow twice independently.
- A fully temporary reconciliation rehearsal was added as `tools/habbo-v085-recovery-reconcile-rehearsal.sh`.
- It rebuilds only a `/dev/shm` copy of the latest offsite archive with the two live WebKit runner files and updated manifests, then runs the same offsite store invariants with a one-archive isolated root.
- Result: PASS for external SHA/gzip, internal manifest, critical files, nested tar safety, live control-plane hash match, recovery bootstrap rehearsal and deterministic recovery fingerprint.
- No live backup, LATEST pointer, production file or systemd unit is modified by the rehearsal.

## Canonical generator dry-run on VPS1
A temporary copy of the live `/srv/habbo/ops/refresh-vps2-control-plane-kit.sh` was executed on VPS1 with an injected hard stop immediately after staging validation and before the backup lock/live promotion section.

Result:
- generated the control-plane kit from `bridge-new` using the canonical 23-path inventory;
- `vps2-control-plane-recovery-smoke.sh` on the staged kit: PASS;
- 23 files / 11 scripts / 12 units;
- hashes verified, inventory exact, syntax verified, ExecStart links resolved, bootstrap rehearsed;
- explicit dry-run stop executed before `flock`, temporary live filenames or atomic `mv` promotion.

This proves the existing canonical refresh path can reconcile the live VPS2 control plane once the corrected WebKit smoke is installed. No live recovery artifact was changed during this proof.

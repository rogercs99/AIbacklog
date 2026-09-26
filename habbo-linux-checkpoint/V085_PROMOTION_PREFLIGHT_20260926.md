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

## Blockers resolved / preflight ready
The validation-infrastructure blockers were subsequently reconciled without deploying the v0.8.5 product/frontend/runtime candidate.

Resolved sequence:
- WebKit authenticated smoke hardened: final `/me` settle uses bounded visible-body readiness rather than fragile final `networkidle`.
- WebKit's `Load request cancelled` for `/security_check` is ignored only when the same navigation already produced HTTP 200; all other request failures remain fatal.
- Real systemd WebKit smoke PASS; `WEBKIT_FAILED` cleared on VPS1.
- VPS2 recovery store semantics corrected: every retained generation must be internally complete, hashed, safe, bootstrap-rehearsable and deterministic for its own manifest; only `LATEST` must byte-match the current live control plane.
- VPS2 heartbeat parser updated to require the new explicit `semantic+bootstrap+per-generation-deterministic` + `live_match=latest-only` proof.
- VPS1 disaster recovery source smoke cleanup trap fixed and full offline clone/fsck path revalidated.
- Canonical VPS2 recovery kit regenerated and validated.
- Final promoted backup: `/srv/habbo/backups/manual-20260926T070100Z`; isolated restore PASS with 88 tables, 40 navigator styles, RogerVideo=1 and room1000=1.
- Offsite replica on VPS2: `/var/backups/habbo-vps1/manual-20260926T070100Z.tar.gz`; store smoke PASS across three retained generations.
- VPS2 control-plane heartbeat PASS, 4/4 timers healthy, failed units 0, failure latch clear.
- Runtime health marker and non-destructive disaster drill regenerated against the final backup.
- Cloudflare config live permission corrected from 0644 to required 0600; secret-permissions smoke PASS.
- `habbo-status.sh`: `OVERALL READY`.
- `habbo-v085-promotion-preflight.sh`: `PROMOTION_PREFLIGHT_PASS`, blockers=0, warnings=0.
- `/srv/habbo/ops/deployment-final-validate.sh`: PASS end to end.

Important gate: **v0.8.5 application/frontend/runtime code is still not deployed to production**. The changes above are operational validation/recovery hardening only. Any actual promotion of the v0.8.5 candidate remains a separate explicit deployment action.

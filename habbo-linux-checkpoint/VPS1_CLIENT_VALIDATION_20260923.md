# VPS1 fresh client validation — 2026-09-23

This document records fresh client validation performed against the deployed immutable FINAL-v2 on VPS1/OLD. It does not alter the canonical bundle or reopen the historical runtime investigation.

## R39 — fresh VPS1 PASS

Runtime: native Adobe Flash Player Linux x86_64 32.0.0.465.

Observed on VPS1:
- RogerVideo authenticated successfully.
- TCP 12323 was ESTABLISHED.
- room 1000 (`RogerVideo Lab`) loaded.
- Avatar was visibly rendered.
- A real floor click produced Havana packet `Received (WALK): 75 / AKRBQA` at `2026-09-23T18:56:12.915Z`.
- Before/after framebuffer comparison changed 3732 pixels.
- No public game port was opened; validation stayed loopback-only.

Evidence:
- `/srv/habbo/validation/final-evidence-20260923/r39-before.png`
- `/srv/habbo/validation/final-evidence-20260923/r39-after.png`
- `/srv/habbo/validation/final-evidence-20260923/r39-events.log`

## V31 — fresh VPS1 PASS

Runtime:
- PRoot 5.4 for filesystem/binds only; no `proot -q`.
- explicit QEMU i386 9.2.4.
- Wine32 5.11.
- hiperesp launcher.
- CRLF deployment `vars.txt`.

A fresh one-use SSO was generated for this validation and injected into the V31 launcher without persisting or exposing the value. The final clean handshake was:
- INIT_CRYPTO;
- GENERATEKEY;
- VERSIONCHECK;
- UNIQUEID;
- GET_SESSION_PARAMETERS;
- SSO;
- authenticated `Player RogerVideo`;
- GET_INFO / navigation;
- TRYFLAT;
- GOTOFLAT;
- GETROOMAD.

V31 then loaded room 1000 `RogerVideo Lab`, rendered RogerVideo, and a real floor click produced:
- Havana event: `Received (WALK): 75 / AKPBQA`;
- timestamp: `2026-09-23T20:45:23.814Z`;
- before/after framebuffer changed pixels: `33474`.

The SSO was cleared immediately after authentication and before the final evidence capture.

Evidence:
- `/srv/habbo/validation/final-evidence-20260923/v31-room-before-walk.png`
- `/srv/habbo/validation/final-evidence-20260923/v31-room-after-walk.png`
- `/srv/habbo/validation/final-evidence-20260923/v31-final-events.log`
- `/srv/habbo/validation/final-evidence-20260923/v31-final-walk.log`
- `/srv/habbo/validation/final-evidence-20260923/v31-walk-ae.txt`
- `/srv/habbo/validation/final-evidence-20260923/V31_FINAL_ACCEPTANCE.txt`
- `/srv/habbo/validation/final-evidence-20260923/SHA256SUMS`

## Post-validation hygiene

After both client validations:
- RogerVideo is offline.
- active SSO length is 0.
- `log.received.packets=false`.
- VNC/noVNC validation listeners are closed.
- Flash/Wine/QEMU/Xvfb/x11vnc/websockify validation processes are stopped.
- stale PRoot wrappers discovered during teardown were killed and the helper was hardened to remove them automatically.
- the temporary control-host SSH tunnel and noVNC browser tab were closed.
- `/srv/habbo/ops/smoke-test.sh` passes.

## Regression helper

Canonical helper: `/srv/habbo/ops/v31-final-validate.sh`.

It provides `start|ticket|check|status|cleanup`. `check` is scoped to the current session marker to prevent stale-log false positives. `cleanup` now force-stops launcher, Wine, PRoot, Xvfb, x11vnc and websockify before clearing the session and restoring packet logging.

Versioned helper: `habbo-linux-checkpoint/vps1-overlay/v31-final-validate.sh`.

## Acceptance result

Fresh VPS1 R39 gameplay: **PASS**.

Fresh VPS1 V31 gameplay: **PASS**.

Server persistence, backup/recovery and both client paths are now validated. No fresh graphical acceptance item remains pending.

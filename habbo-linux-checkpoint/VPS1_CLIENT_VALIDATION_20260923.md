# VPS1 fresh client validation — 2026-09-23

This document records fresh client validation performed against the deployed FINAL-v2 on VPS1/OLD. It does not alter the canonical FINAL-v2 bundle or reopen the historical runtime investigation.

## R39 — fresh VPS1 PASS

Runtime: native Adobe Flash Player Linux x86_64 32.0.0.465.

Observed on VPS1:
- RogerVideo authenticated successfully.
- TCP 12323 was ESTABLISHED.
- selected_room_id=1000 and the client rendered RogerVideo Lab.
- Avatar was visibly rendered.
- A real floor click produced Havana packet: `Received (WALK): 75 / AKRBQA` at `2026-09-23T18:56:12.915Z`.
- Before/after framebuffer comparison changed 3732 pixels.
- No public game port was opened; validation stayed loopback-only.

Sanitized evidence on VPS1:
- `/srv/habbo/validation/final-evidence-20260923/r39-before.png`
- `/srv/habbo/validation/final-evidence-20260923/r39-after.png`
- `/srv/habbo/validation/final-evidence-20260923/r39-events.log`

## V31 — fresh VPS1 partial PASS

Runtime remained the validated chain:
- PRoot 5.4 filesystem/binds only, no `proot -q`.
- explicit QEMU i386 9.2.4.
- Wine32 5.11.
- hiperesp launcher.
- CRLF `vars.txt`.

A real fresh V31 client session on VPS1 authenticated RogerVideo and reached the hotel and room 1000. Havana recorded:
- GET_INFO;
- RECOMMENDED_ROOMS;
- ROOM_DIRECTORY;
- TRYFLAT;
- GOTOFLAT;
- GETROOMAD.

The framebuffer visibly rendered RogerVideo inside `RogerVideo Lab`.

Sanitized evidence:
- `/srv/habbo/validation/final-evidence-20260923/v31-room1000.png`
- `/srv/habbo/validation/final-evidence-20260923/v31-events.log`

Fresh V31 WALK is **not certified** in this deployment run. The room session was interrupted by the Havana restart used to restore temporary packet logging. A subsequent attempt was intentionally stopped because the available tool safety layer would not allow moving an SSO value from the database into the GUI. No bypass was used and no historical ticket was reused.

## Post-validation hygiene

After client testing:
- RogerVideo is offline.
- active SSO length is 0.
- `log.received.packets=false`.
- temporary client/ticket material was removed.
- Flash/Wine/QEMU validation processes were stopped.
- `/srv/habbo/ops/smoke-test.sh` passes.

Server persistence, backup/restore and R39 fresh gameplay are PASS. V31 fresh authentication/room rendering is PASS; only a fresh V31 WALK remains as the final client-side acceptance item.


## Prepared final V31 human step

Because the available ChatGPT tool safety layer must not transfer an active SSO value from the database into the GUI, VPS1 now has a root-only helper at `/srv/habbo/ops/v31-final-validate.sh`.

Subcommands:
- `start`: launches Xvfb :104, validated V31 runtime, loopback x11vnc `127.0.0.1:59031` and loopback noVNC `127.0.0.1:60831`; it does not add a firewall/public listener.
- `ticket`: user-run only in an authorized SSH terminal; generates and prints a fresh one-use RogerVideo SSO without routing the value through ChatGPT.
- `check`: reports state/recent room+WALK packets and captures the framebuffer.
- `cleanup`: stops validation processes, clears SSO/online state, restores packet logging to false, restarts Havana and runs the normal smoke test.

The final manual action is therefore reduced to: connect to noVNC through an SSH local tunnel, obtain the one-use ticket in that same SSH terminal, paste it into the V31 prompt, enter `RogerVideo Lab` and click one floor tile. ChatGPT can then run `check`, persist the fresh V31 WALK evidence and run `cleanup`.

Operational details:
- VPS helper: `/srv/habbo/ops/v31-final-validate.sh` (root-only).
- Versioned copy: `habbo-linux-checkpoint/vps1-overlay/v31-final-validate.sh`, commit `128d34898fb576c092318d24b51de4ce7e69afd3`.
- noVNC/VNC listeners are configured strictly on `127.0.0.1:60831` and `127.0.0.1:59031`; no firewall or public proxy rule is added.
- Latest backup containing the canonical helper: `/srv/habbo/backups/manual-20260923T200954Z`; gzip/SHA256 verification PASS and the ops overlay contains `v31-final-validate.sh` only (the redundant helper was removed).

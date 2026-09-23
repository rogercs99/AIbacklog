# Habbo 2009 Dual Client — Linux sandbox checkpoint

Checkpoint date: 2026-09-23
Status: **DUAL CLIENT GAMEPLAY PASS**

## Hard validation result

Both historical clients have real Linux-sandbox gameplay validation against the same Havana hotel.

- **R39 / Flash:** PASS from the prior native Adobe Flash Player Linux x86_64 validation. Real Havana login, real socket on 12323, `RogerVideo` visible in `RogerVideo Lab`, tile click and visible movement. Ruffle was diagnostic only.
- **V31 / Shockwave:** PASS on 2026-09-23. Real Havana login, established socket on 12321, room 1000 loaded, avatar rendered, and two independent tile clicks produced server-side `WALK` plus visible framebuffer displacement.

## V31 runtime that passed

- PRoot 5.4 for filesystem/binds only. **Never use PRoot `-q`.**
- Explicit QEMU i386 **9.2.4**.
- Wine32 **5.11** with the initialized checkpoint prefix.
- Correct launcher: `hiperesp/Habbo-v31-Projector`.
- `vars.txt` must use **CRLF**.
- Havana v1.5.4.
- MariaDB 11.5.2 on loopback 3307.
- Static historical WWW on loopback 18080.

QEMU 7.2 is not the final V31 runtime: it reproduced Wine IPC `sendmsg: Message too long`. The stable path is QEMU 9.2.4.

## Backend / room

- Shockwave: 12321
- MUS: 12322
- Flash: 12323
- RCON: 12309
- Test user: `RogerVideo` (id 1)
- Test room: `RogerVideo Lab` (id 1000, `model_a`)
- Schema: 88 tables plus 40 `navigator_styles` rows after the official Havana migration.

## V31 proof

Successful authentication progressed through:
`INIT_CRYPTO -> GENERATEKEY -> VERSIONCHECK -> UNIQUEID -> GET_SESSION_PARAMETERS -> SSO -> RIGHTS -> LOGIN -> GET_INFO -> NAVIGATE`.

Room entry progressed through `GETFLATINFO`, `TRYFLAT`, `GOTOFLAT`, `G_USRS`, and `G_STAT`.

Movement proof 1:
`8,6 -> 7,7 -> 7,8 -> 7,9 -> 6,10 -> 6,11`.

Movement proof 2:
`7,10 -> 8,9 -> 9,8 -> 10,7 -> 11,6`.

During the proof, `RogerVideo` was online, selected room 1000, and TCP 12321 was ESTABLISHED.

## Recovery package

Persistent Library artifact:
`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-20260923.zip`

SHA-256:
`38e8175373094130e27202d65aef2be9406dbfcd08e23f3bd87ea95e40afc97f`

The restore script inside the package was executed in a clean target directory and verified:
- QEMU 9.2.4 hash
- MariaDB reconstructed archive hash
- historical WWW reconstructed archive hash

No live SSO ticket or database password is committed.
# Habbo 2009 Dual Client — Linux sandbox checkpoint

Checkpoint date: 2026-09-23
Status: **DUAL CLIENT REAL GAMEPLAY PASS WITH BINARY EVIDENCE FOR BOTH CLIENTS**

## Hard validation result

- **R39 / Flash:** freshly revalidated with native Adobe Flash Player Linux x86_64 32.0.0.465. Real Havana login, TCP 12323 ESTABLISHED, `RogerVideo` online in room 1000, avatar rendered, two fresh server-side `WALK` packets, visible framebuffer displacement and a clean 10-second movement video.
- **V31 / Shockwave:** real Havana login, TCP 12321 ESTABLISHED, room 1000 loaded, avatar rendered, and two independent tile clicks produced server-side `WALK` plus visible framebuffer displacement.

## Passing runtimes

R39:
- Native Adobe Flash Player Linux x86_64 32.0.0.465.
- Player SHA-256: `0bdd5116aa4e8dc88fb9e705c85c1f7ef4a29415ffb9b2132a3eb1aeafaae7b0`.
- Official tar SHA-256: `883f7aa23301fc80de879501157533a4acdbfee0721ed7c57676dc032fdf96c3`.
- Ruffle remains diagnostic only.

V31:
- PRoot 5.4 for filesystem/binds only; never use `-q`.
- Explicit QEMU i386 9.2.4.
- Wine32 5.11 with initialized prefix.
- hiperesp V31 launcher.
- `vars.txt` CRLF.

## Backend / room

- MariaDB: 127.0.0.1:3307
- Shockwave: 12321
- MUS: 12322
- Flash: 12323
- RCON: 12309
- User: `RogerVideo` id 1
- Room: `RogerVideo Lab` id 1000, `model_a`
- Schema: 88 tables + 40 `navigator_styles` rows.

## Preferred recovery package

Preferred v2 Library artifact:
`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-v2-20260923.zip`

SHA-256:
`f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`

The v2 ZIP itself was extracted into a clean directory and its restore script was executed successfully. It restored all eight binary evidence files plus R39/V31 runbooks, verified QEMU 9.2.4, reconstructed MariaDB and historical WWW with the canonical hashes.

The v1 package remains valid and immutable:
`38e8175373094130e27202d65aef2be9406dbfcd08e23f3bd87ea95e40afc97f`.

No live SSO ticket or database password is committed.
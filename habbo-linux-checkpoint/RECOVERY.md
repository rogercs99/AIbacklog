# Immediate recovery procedure — final

Do not restart the investigation. Gameplay validation is complete.

## 1. Rehydrate the final context

Use Library artifact:
`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-20260923.zip`

Verify SHA-256:
`38e8175373094130e27202d65aef2be9406dbfcd08e23f3bd87ea95e40afc97f`

Keep the previously saved large Library artifacts next to it and run the included `restore-habbo-final.sh` with `ASSET_DIR` pointing at that artifact directory.

## 2. Critical runtime invariants

V31:
- PRoot 5.4 is filesystem/binds only.
- Do not use PRoot `-q`.
- Use explicit QEMU i386 9.2.4.
- Use Wine32 5.11 and the initialized prefix.
- Use the hiperesp V31 launcher, not a generic Director projector.
- `vars.txt` must be CRLF.

R39:
- Final gameplay path is native Linux Adobe Flash Player x86_64.
- Do not substitute Ruffle as final gameplay evidence.

## 3. Backend

Expected loopback ports:
- MariaDB 3307
- Shockwave 12321
- MUS 12322
- Flash 12323
- RCON 12309
- historical WWW 18080

Import Havana v1.5.4 schema and the official `tools/migrations/update.1.2.sql` migration so `navigator_styles` exists.

Use fresh local credentials and generate a fresh SSO ticket for each restored run. Never commit passwords or tickets.

## 4. Smoke validation after restore

For V31, authenticate `RogerVideo`, enter room 1000 `RogerVideo Lab`, click another tile, and require both:
- real framebuffer displacement
- Havana `WALK` packet plus movement path

Known failure fingerprints:
- `c0000018`: PRoot/QEMU launch chain regressed; check for `-q`.
- `sendmsg: Message too long`: QEMU 7.2 accidentally reintroduced.
- `Where is ""?`: `vars.txt` line endings are wrong; restore CRLF.
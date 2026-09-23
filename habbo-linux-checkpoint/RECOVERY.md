# Immediate recovery procedure — final v2

Do not restart the investigation. Dual gameplay validation is complete.

## Preferred bundle

Use:
`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-v2-20260923.zip`

Verify:
`f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`

Keep the previously persisted large Library artifacts available and run the included `restore-habbo-final.sh` with `ASSET_DIR` pointing at them. The restore copies the complete dual evidence directory as well as runbooks/logs.

## V31 invariants

- PRoot 5.4 is filesystem/binds only.
- Never use PRoot `-q`.
- Explicit QEMU i386 9.2.4.
- Wine32 5.11 initialized prefix.
- hiperesp V31 launcher, not generic Director.
- `vars.txt` CRLF.
- QEMU 7.2 is known-bad for this path: `sendmsg: Message too long`.

## R39 invariants

- Final runtime is native Adobe Flash Player Linux x86_64 32.0.0.465.
- Run `fetch-r39-flashplayer.sh` to download the official Adobe/Macromedia tar and verify both archive and player hashes.
- Do not use Ruffle as final gameplay proof.
- Launch R39 `Habbo.swf` with the FlashVars shape from `Palsternakka/HabboLauncher`, host 127.0.0.1, port 12323 and a fresh local SSO ticket.

## Backend

Expected loopback ports: MariaDB 3307, Shockwave 12321, MUS 12322, Flash 12323, RCON 12309.
Apply the official Havana `tools/migrations/update.1.2.sql` migration.

Always create fresh local credentials and one-use SSO tickets after restore; never persist them.

## Validation after restore

For each client require all of:
1. real authentication;
2. ESTABLISHED socket;
3. room 1000 loaded;
4. visible avatar;
5. real tile click;
6. Havana `WALK`;
7. visible framebuffer displacement.

## Post-validation hygiene — 2026-09-23

The live sandbox was left in a reusable but credential-clean state:
- persistent Xvfb/backend infrastructure remains available;
- MariaDB listens on 127.0.0.1:3307;
- historical WWW listens on 127.0.0.1:18080;
- Havana listens on 12321/12322/12323/12309;
- no Flash client, V31 client, capture process or established gameplay socket remains;
- `RogerVideo` is `is_online=0`, retains `selected_room_id=1000`, and has an empty `sso_ticket`;
- two R39 access-log SSO query values and two Havana raw-log SSO payloads were redacted in-place;
- V31 `vars.txt` remains CRLF (14 CRLF line endings) and contains no opaque session token;
- the preferred v2 ZIP was rechecked after cleanup and still matches SHA-256 `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`, with `unzip -t` clean.

If this exact sandbox is still alive, reuse the backend and generate a fresh one-use SSO ticket rather than rebuilding it.

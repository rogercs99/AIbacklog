# Habbo web local v0.8.0 — dual-client validation 2026-09-25

Production and canonical FINAL-v2 were not modified.

## Shared backend
Both clients were validated against a clean reproducible Havana build from:
`b550f00f27788145d26723fd19e943aa63504a63`.

The prior Director `Object expected` regression was isolated to an incompatible patched `USER_OBJECTS` serialization, not Wine, SSO mode, cache or avatar data.

## V31
- PRoot 5.4: filesystem/binds only, no `-q`.
- explicit QEMU i386 9.2.4.
- Wine32 5.11 with recursive static wrapper for wine/wine-preloader/wineserver.
- SSO, TCP 12321, room 1000, visible avatar, G_STAT, real WALK: PASS.
- clean framebuffer movement: 5,053 changed pixels.
- lifecycle start/status/stop: PASS with no runtime residues after stop.

## R39
Native Adobe Flash Player standalone Linux x86_64 32.0.0.465.
- official tar SHA-256: `883f7aa23301fc80de879501157533a4acdbfee0721ed7c57676dc032fdf96c3`
- flashplayer SHA-256: `0bdd5116aa4e8dc88fb9e705c85c1f7ef4a29415ffb9b2132a3eb1aeafaae7b0`
- fresh one-use SSO: PASS.
- direct TCP 12323 from native flashplayer: ESTABLISHED.
- room 1000 `RogerVideo Lab`: PASS.
- avatar visible: PASS.
- real tile click -> Havana WALK: PASS.
- WALK: `2026-09-25T21:55:13.264`, packet `75 / AKQBQA`.
- clean 960x540 framebuffer diff: 3,769 pixels, bbox `(733,354)-(959,540)`.
- Ruffle was not used for final R39 certification.

R39 asset URLs must use explicit HTTP origin `http://127.0.0.1:18080`; the historical `external_variables.txt` bare `http://localhost/` URLs otherwise hit port 80.

## Hygiene
After validation:
- native Flash client stopped;
- R39 Xvfb stopped;
- no established gameplay socket remains;
- RogerVideo `is_online=0`;
- RogerVideo `sso_ticket` empty;
- room 1000 retained.

## Recoverable bundle
ChatGPT Library:
`/Habbo 2009 Dual Linux/habbo-web-local-v0.8.0-dual-pass-20260925.zip`

SHA-256:
`7f971feab3522ba0c82a3c6a6aa8e1dc6599ce6cd12e9652e89ab7a944151db8`

Size: 11,268,363 bytes.

The ZIP passed `unzip -t` and its internal 90-file SHA256 manifest passed after round-trip extraction.

## Next gate
Repeat the integrated Chrome matrix with the v0.8.0 backend/runtime active. Safari/WebKit remains an independent gate before any production promotion.

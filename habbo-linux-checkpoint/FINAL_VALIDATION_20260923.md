# Final gameplay validation v2 — 2026-09-23

## Verdict

Both historical clients passed the real Linux-sandbox gameplay gate and both now have binary evidence in the preferred v2 bundle.

### R39 — fresh validation

- Native Adobe Flash Player Linux x86_64 32.0.0.465.
- Player SHA-256: `0bdd5116aa4e8dc88fb9e705c85c1f7ef4a29415ffb9b2132a3eb1aeafaae7b0`.
- Official tar SHA-256: `883f7aa23301fc80de879501157533a4acdbfee0721ed7c57676dc032fdf96c3`.
- Real Havana authentication.
- TCP 12323 ESTABLISHED.
- `RogerVideo` online with `selected_room_id=1000`.
- Room `RogerVideo Lab` rendered in the real Flash framebuffer.
- Two fresh `WALK` packets observed at 14:55:15 and 14:56:43 local lab time.
- Clean before/after frames show physical avatar displacement.
- Clean game-only H.264 movement video: 960x540, 15 fps, 10.0 s.
- Frame diff: 5,569 changed pixels (1.0743%), bbox `(253,280)-(703,384)`.

### V31

- PRoot 5.4 filesystem-only + explicit QEMU i386 9.2.4 + Wine32 5.11.
- hiperesp V31 launcher, CRLF `vars.txt`.
- TCP 12321 ESTABLISHED.
- Real login, room 1000, visible avatar.
- WALK path A: `8,6 -> 7,7 -> 7,8 -> 7,9 -> 6,10 -> 6,11`.
- WALK path B: `7,10 -> 8,9 -> 9,8 -> 10,7 -> 11,6`.

## Preferred evidence bundle

Primary source: GitHub Release v1.1
`https://github.com/rogercs99/AIbacklog/releases/tag/habbo-2009-dual-linux-v1.1.0-20260923`

Release asset:
`habbo-2009-dual-linux-FINAL-v2-20260923.zip`
Asset id: `584208609`
Size: `3476825` bytes

SHA-256:
`f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`

Fallback copy:
`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-v2-20260923.zip`

R39 evidence:
- `evidence/r39-room-before-move.png`
- `evidence/r39-room-after-move.png`
- `evidence/r39-movement-pass.mp4`
- `logs/r39-proof-sanitized.log`

V31 evidence:
- `evidence/v31-login-pass.png`
- `evidence/v31-room-entered.png`
- `evidence/v31-clean-before-video.png`
- `evidence/v31-clean-after-video.png`
- `evidence/v31-movement-pass.mp4`
- `logs/v31-proof-sanitized.log`

## Restore verification

The final v2 ZIP was tested from its compressed bytes, not only from the source directory. Its manifest passed, then `restore-habbo-final.sh` restored all 8 binary evidence files and verified:
- QEMU 9.2.4: `47851b37911b1c76f1784a807cbb6592efb6166d0a27b39f7447dd0ec7c48384`
- MariaDB archive: `6fffce126dda54ecaaa3659e03caa47bf5ff6828936001176f84b6bed9637f5c`
- historical WWW: `877273abddab946849aed3d5d2416185fe175a7207a602890fd08ebe7e376ed0`

No live SSO ticket, password or private key is included.
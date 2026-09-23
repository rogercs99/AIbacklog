# R39 fresh native Linux validation — 2026-09-23

Runtime: Adobe Flash Player standalone Linux x86_64 32.0.0.465.

Flashplayer SHA-256:
`0bdd5116aa4e8dc88fb9e705c85c1f7ef4a29415ffb9b2132a3eb1aeafaae7b0`

Official tarball SHA-256:
`883f7aa23301fc80de879501157533a4acdbfee0721ed7c57676dc032fdf96c3`

Source workflow: `.github/workflows/habbo-adobe-linux-x64.yml` from `lab/habbo-flash10-20260922`.
Fresh rerun reused workflow run `35732699821`, artifact id `10757891355`.

## Fresh proof

- `RogerVideo` authenticated against Havana.
- TCP 12323 was ESTABLISHED.
- `selected_room_id=1000` and `is_online=1`.
- `RogerVideo Lab` rendered in the real native Flash framebuffer.
- Havana received two fresh `WALK` packets at 14:55:15 and 14:56:43 local lab time.
- Clean before/after framebuffer evidence shows the avatar moving across the room.
- Clean movement video: 960x540, H.264, 15 fps, 10.0 seconds.
- Before/after frame diff: 5,569 changed pixels (1.0743%), bbox `(253,280)-(703,384)`.

Binary evidence is retained in the preferred v2 Library package:
`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-v2-20260923.zip`
SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`.

Ruffle was not used for final gameplay certification.
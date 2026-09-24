# Habbo 2009 Dual Linux — Disaster Recovery Manifest

Generated: 2026-09-24
Deployment root: `/srv/habbo`
Canonical production artifact SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`

## Recovery model

Current mutable production state is recovered from `LATEST_PUBLIC_WEB_BACKUP`.
Large historical runtime/static assets are independently retained in ChatGPT Library under `/Habbo 2009 Dual Linux` and are NOT duplicated into every VPS backup.
The VPS backup does retain the canonical FINAL-v2 bundle and an offline Git bundle of Havana, so backend source and final recovery/evidence scripts do not depend on GitHub availability.

## Local immutable sources copied into promoted VPS backups

- `habbo-2009-dual-linux-FINAL-v2-20260923.zip`
  - size: 3476825 bytes
  - SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`
- `havana-source-b550f00.bundle`
  - source upstream: `https://github.com/Quackster/Havana.git`
  - commit: `b550f00f27788145d26723fd19e943aa63504a63`
  - SHA-256: `77672bee2a6b8f879aa8cb0acbac41b7bc203b4487e1464ebacbc1848564bcb5`
  - size: 4304844 bytes
- Production MariaDB image target:
  - `mariadb:11.5.2`
  - registry digest: `sha256:2d50fe0f77dac919396091e527e5e148a9de690e58f32875f113bef6506a17f5`
- Current Havana image IDs at manifest creation:
  - server: `sha256:a979eb970baa5ceb8ff3fe760e2a84c2200f1aabb764fa83e211a117b6fad8d0`
  - web: `sha256:7f360a3d3965d12c6225f88497f1db2fd09783905a5ca5dbfec42de5678064fc`

## External independent asset source — ChatGPT Library

Folder: `/Habbo 2009 Dual Linux`
Presence re-verified on 2026-09-24.

Preferred combined artifacts:
- `habbo-2009-dual-linux-CONTEXT-20260921-1911.zip` — SHA-256 `ef89248818064468dde65fca8a03b62c4b8211c542a8c2fb35631278fb82f2d1`
- `habbo-2009-dual-linux-RUNTIME-20260921.zip` — SHA-256 `d354af6186907324f7773c7b7f8e4b4b2d37c325b10906912ceb24d208539928`
- `habbo-2009-dual-linux-WINEPREFIX-20260921.tar.gz` — SHA-256 `69e284ae5ad27aa633a7e7bc4a1a2d421d5232c42e39b85747f13e7695cdfdcc`
- `backend-parts/habbo-core-small.zip` — SHA-256 `da12b1ddae3e0b04bd12c5737de3af9609cc56913f0bae9f5f26f0cffe049d02`
- Reassembled MariaDB 11.5.2 archive — SHA-256 `6fffce126dda54ecaaa3659e03caa47bf5ff6828936001176f84b6bed9637f5c`
- Reassembled `havana_www_10_09_2024.7z` — SHA-256 `877273abddab946849aed3d5d2416185fe175a7207a602890fd08ebe7e376ed0`

Library fallback chunk hashes are stored beside this manifest in:
- `habbo-library-chunks-sha256.txt`
- `habbo-runtime-prefix-parts-sha256.txt`

The Library also contains `HABBO_RESTORE_FROM_LIBRARY.sh`, `HABBO_RESTORE_FINAL_20260923.sh`, FINAL-v2 and its SHA file.

## Chunk inventory required by the historical restore chain

Backend:
- `backend-parts/habbo-core-small.zip`
- `backend-parts/habbo-mariadb-part-00.zip` ... `05.zip`

WWW:
- `www-parts/habbo-www-part-00.zip` ... `07.zip`

Runtime fallback:
- `runtime-parts/habbo-runtime-part-00.zip` ... `04.zip`
- `runtime-parts/habbo-wineprefix-part-00.zip` ... `01.zip`

## Production secrets/state retained in each promoted VPS backup

- `.env` (`0600`) with DB credentials required by Compose.
- Cloudflare tunnel config (`0600`).
- Cloudflare tunnel credential JSON (`0600`), verified to match the config TunnelID.
- Current MariaDB logical dump, restore-tested in a temporary database.
- Docker Compose, systemd units, ops scripts, public frontend overlay, R39/V31 vars and symlink state.

## Reconstruction order for a total VPS loss

1. Recover a promoted VPS backup and verify `SHA256SUMS`.
2. Restore `.env`, Cloudflare config + credential JSON and systemd/ops files with their recorded modes.
3. Restore Havana from `havana-source-b550f00.bundle` (or clone upstream and checkout exact commit `b550f00f...`).
4. Pull MariaDB using the recorded digest.
5. Obtain the historical assets from ChatGPT Library and verify the stored chunk/combined hashes.
6. Use `HABBO_RESTORE_FROM_LIBRARY.sh` / FINAL-v2 restore chain to reconstruct the historical WWW/runtime/prefix inputs.
7. Apply the current VPS backup overlays/config and import the current `havana.sql.gz`; current production DB state supersedes historical checkpoint DB contents.
8. Build/start Compose, restore systemd units, enable timers and Cloudflare tunnel.
9. Run `deployment-final-validate.sh` from VPS1 and the WebKit iPhone smoke from the control host.

## Important boundary

The current `/srv/habbo/web` (~756 MB) and `/srv/habbo/v31` (~1.3 GB) trees are intentionally not duplicated inside each local VPS backup. Their independent recovery source is the verified ChatGPT Library checkpoint above. Copying them into the same VPS filesystem would not protect against host/disk loss and would consume the remaining disk headroom.
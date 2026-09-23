# FINAL-v2 internal bundle audit — 2026-09-23

Purpose: verify the canonical bundle internally, not only as a ZIP container or Release asset.

Canonical bundle:
- `habbo-2009-dual-linux-FINAL-v2-20260923.zip`
- size: `3476825` bytes
- SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`

## Container integrity

- `unzip -t`: PASS, no errors.
- Extracted top-level bundle contains 19 files across 4 directories.
- Internal evidence manifest: `EVIDENCE_SHA256.txt`.

## Internal hash verification

Every entry listed in `EVIDENCE_SHA256.txt` passed `sha256sum -c`, including:
- all R39/V31 evidence PNG/MP4 files;
- `CURRENT_STATE.md`, `FINAL_VALIDATION.md`, `R39_VALIDATION.md`, `RECOVERY.md`;
- `fetch-r39-flashplayer.sh`;
- sanitized R39/V31 proof logs;
- restore verification log;
- `restore-habbo-final.sh`;
- embedded `runtime/qemu-i386-9.2.4`.

Selected evidence hashes remain:
- R39 movement video: `d342ae87a119a8388c9260497f2fec44c00ec8caf18b5508e3ac541b375e8911`
- R39 before frame: `37c1a902f5ee4eedb4a9b36c8a617df7468e43ef8bacb0f045778114ecde144a`
- R39 after frame: `83ba5c527b7f578ea5cd444050f6b9204d32b1b688987da195cece1719e05148`
- V31 movement video: `0e98385951573068b8e59e064a7df9ae7056bae97f4d07ac8eefcb2890f93ed2`
- QEMU i386 9.2.4: `47851b37911b1c76f1784a807cbb6592efb6166d0a27b39f7447dd0ec7c48384`

## Restore verification evidence

`logs/restore-verification.log` reports:
- embedded QEMU hash: OK;
- core-small archive hash: OK;
- MariaDB 11.5.2 reconstruction hash: OK;
- historical WWW reconstruction hash: OK;
- restore assembly: VERIFIED.

The restore requires fresh local credentials/SSO before launch; no live credential is supplied by the bundle.

## Script validation

- `restore-habbo-final.sh`: executable mode 0755, `bash -n` PASS.
- `fetch-r39-flashplayer.sh`: executable mode 0755, `bash -n` PASS.
- Fetcher network target is only the expected Adobe/Macromedia standalone-player URL:
  `https://fpdownload.macromedia.com/pub/flashplayer/updaters/32/flash_player_sa_linux.x86_64.tar.gz`
- Restore script performs local hash checks/copies/extraction and does not contain a hidden network fetch path.

## Embedded runtime validation

`runtime/qemu-i386-9.2.4`:
- ELF 64-bit x86-64 static PIE executable;
- executable mode 0755;
- runtime output: `qemu-i386 version 9.2.4`.

## Multimedia semantic validation

R39 movement video:
- codec: H.264
- resolution: 960x540
- rate: 15 fps
- duration: 10.0 s
- file size inside bundle: 189380 bytes

V31 movement video:
- codec: H.264
- resolution: 1280x720
- rate: 15 fps
- duration: 16.0 s
- file size inside bundle: 245937 bytes

All six PNG evidence files passed image decoding/verification:
- R39 frames: 960x540 RGB
- V31 frames/screenshots: 1280x720 RGB

## Sensitive-content scan

A text scan across bundle Markdown, logs, shell scripts and text manifests found no matches for:
- PEM/OpenSSH private-key headers;
- GitHub PAT formats;
- OpenAI-style API key formats;
- Bearer-token patterns;
- populated `sso_ticket` assignments;
- obvious plaintext password assignments.

This complements, but does not replace, the existing sanitized-log review.

## Result

**PASS.** The canonical FINAL-v2 bundle is internally hash-consistent, syntactically restorable, contains a valid QEMU 9.2.4 runtime, contains decodable R39/V31 multimedia evidence, and shows no obvious residual credential material under the audit patterns above.

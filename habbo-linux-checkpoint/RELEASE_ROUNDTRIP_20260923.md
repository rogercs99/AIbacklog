# GitHub Release round-trip verification — 2026-09-23

Purpose: prove that the published GitHub Release v1.1 is independently downloadable and internally self-consistent after publication.

Release:
- Tag: `habbo-2009-dual-linux-v1.1.0-20260923`
- Release id: `394785116`

Assets verified from the Release itself:
- `habbo-2009-dual-linux-FINAL-v2-20260923.zip`
  - size: `3476825` bytes
  - SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`
- `HABBO_FINAL_V2_SHA256.txt`
  - size: `427` bytes
  - SHA-256: `9a16bdb999471ef6577aea813f9e049c858cff70892d642ecea7834c7c0b6b48`

GitHub Actions round-trip run:
- Workflow run: `35894941442`
- Job: `verify`
- Conclusion: `success`

Checks performed after downloading both assets from the Release:
1. ZIP size exactly `3476825` bytes.
2. ZIP SHA-256 exactly `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`.
3. Manifest size exactly `427` bytes.
4. Manifest SHA-256 exactly `9a16bdb999471ef6577aea813f9e049c858cff70892d642ecea7834c7c0b6b48`.
5. Manifest names `habbo-2009-dual-linux-FINAL-v2-20260923.zip`.
6. Manifest declares the same canonical ZIP SHA-256.
7. Manifest declares the same canonical ZIP size.
8. `unzip -t` on the downloaded ZIP passes.

A direct VPS round-trip of the ZIP had already succeeded. A later combined ZIP+manifest VPS probe encountered a transient outbound GitHub connection stall; that probe was terminated and cleaned without changing any release asset. The GitHub Actions verification above is the authoritative pair-level round-trip proof.

Temporary verification branch `tmp/habbo-release-roundtrip-20260923` was deleted after the successful run. No temporary transfer asset was retained.

Result: **PASS**. The GitHub Release is independently downloadable and the ZIP + checksum manifest agree with each other and with the canonical FINAL-v2 identity.

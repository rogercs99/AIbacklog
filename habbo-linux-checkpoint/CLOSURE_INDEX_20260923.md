# Habbo 2009 Dual Linux — closure index — 2026-09-23

Status: **FINAL / DUAL CLIENT REAL GAMEPLAY PASS**

This is the canonical navigation entry point for the completed Habbo 2009 Dual Linux milestone.

## Primary recovery source

GitHub Release v1.1:
`https://github.com/rogercs99/AIbacklog/releases/tag/habbo-2009-dual-linux-v1.1.0-20260923`

Canonical bundle:
- file: `habbo-2009-dual-linux-FINAL-v2-20260923.zip`
- release asset id: `584208609`
- size: `3476825` bytes
- SHA-256: `f80bbefc5a486fd0f9cce058a39462ef3925c563253dc2f69ebe647f6a6630ec`

Fallback copy:
`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-v2-20260923.zip`

Accept a fallback copy only if size and SHA-256 match the canonical identity above.

## Release verification assets

Checksum manifest:
- `HABBO_FINAL_V2_SHA256.txt`
- asset id: `584097161`
- size: `427` bytes
- SHA-256: `9a16bdb999471ef6577aea813f9e049c858cff70892d642ecea7834c7c0b6b48`

Machine-readable provenance:
- `FINAL_V2_PROVENANCE_20260923.json`
- asset id: `584271481`
- size: `1968` bytes
- SHA-256: `d5fc94a7266be1f794c29d2872e0d0e1694a643ca4c6ca39cd6bbed9e1c3cd8d`

## Proof chain

1. R39 real gameplay PASS.
2. V31 real gameplay PASS.
3. FINAL-v2 clean restore PASS.
4. FINAL-v2 internal manifest hashes PASS.
5. R39/V31 media decode/probe PASS.
6. Embedded QEMU 9.2.4 runtime PASS.
7. Sensitive-pattern scan PASS.
8. GitHub Release ZIP upload after 19-chunk cryptographic reconstruction PASS.
9. Release ZIP + checksum round-trip PASS.
10. Provenance JSON publication + round-trip PASS.

## Durable evidence documents

- `CURRENT_STATE.md` — current operational checkpoint.
- `RECOVERY.md` — restore and recovery procedure.
- `FINAL_VALIDATION_20260923.md` — R39/V31 gameplay validation.
- `R39_VALIDATION_20260923.md` — detailed R39 validation.
- `RELEASE_20260923.md` — release manifest and asset identities.
- `RELEASE_ROUNDTRIP_20260923.md` — post-publication ZIP/checksum download verification.
- `BUNDLE_INTERNAL_AUDIT_20260923.md` — internal hash/runtime/media/security audit.
- `FINAL_V2_PROVENANCE_20260923.json` — machine-readable provenance.
- `EVIDENCE_SHA256_20260923.txt` — evidence hashes.
- `RESTORE_FINAL_20260923.sh` — restore assembler.
- `FETCH_R39_FLASHPLAYER_20260923.sh` — verified R39 runtime fetcher.
- `V31_PROOF_SANITIZED_20260923.log` — sanitized V31 proof log.
- `BRANCH_AUDIT_20260923.md` — branch retention/deletion rationale.

## Important validation runs

- R39 native Adobe workflow: `35732699821`
- checksum-manifest publication: `35885192804`
- canonical FINAL-v2 ZIP publication: `35892499049`
- release ZIP/checksum round-trip: `35894941442`
- provenance publication + round-trip: `35896374327`

## Git state

Stable branch:
`project/habbo-2009-dual-linux`

Release snapshot:
`release/habbo-2009-dual-linux-20260923`

Release tag:
`habbo-2009-dual-linux-v1.1.0-20260923`

The stable and release snapshot branches must remain synchronized after documentation-only closure updates. Do not modify `main` for this project.

## Runtime invariants

R39:
- native Adobe Flash Player Linux x86_64 32.0.0.465;
- player SHA-256 `0bdd5116aa4e8dc88fb9e705c85c1f7ef4a29415ffb9b2132a3eb1aeafaae7b0`;
- official tar SHA-256 `883f7aa23301fc80de879501157533a4acdbfee0721ed7c57676dc032fdf96c3`;
- Ruffle is diagnostic only.

V31:
- PRoot 5.4 filesystem/binds only, never `-q`;
- explicit QEMU i386 9.2.4;
- Wine32 5.11;
- hiperesp V31 launcher;
- CRLF `vars.txt`.

## Backend invariants

- MariaDB: `127.0.0.1:3307`
- Shockwave: `12321`
- MUS: `12322`
- Flash: `12323`
- RCON: `12309`
- user: `RogerVideo` id 1
- room: `RogerVideo Lab` id 1000, `model_a`

After validation keep the sandbox credential-clean:
- `RogerVideo.is_online=0`;
- empty `sso_ticket`;
- no gameplay client/socket left alive;
- generate fresh one-use SSO credentials for future runtime tests.

## Knowledge backup

The external knowledge backup branch is:
`backup/mi-vps-knowledge/habbo-root-bridge-upload-fix-20260923`

Use the newest verified remote SHA recorded in the VPS knowledge/entry point.

## Rule for future work

Do not reopen the completed R39/V31 investigation unless new evidence shows a regression. Treat any new gameplay feature, client variant, server migration, or packaging change as a new milestone while preserving this v1.1 release and FINAL-v2 bundle unchanged.

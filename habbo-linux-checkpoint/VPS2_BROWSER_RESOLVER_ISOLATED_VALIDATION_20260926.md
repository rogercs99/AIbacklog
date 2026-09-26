# VPS2 Chromium resolver — isolated validation — 2026-09-26

## Why this note exists
A concurrent workspace change replaces the hardcoded Chromium revision `chromium_headless_shell-1181` in `habbo-vps2-control-plane-bootstrap.sh` with a resolver that accepts an executable from either:
- `$PLAYWRIGHT_BROWSERS_PATH/chromium_headless_shell-*/chrome-linux/headless_shell`
- `$PLAYWRIGHT_BROWSERS_PATH/chromium-*/chrome-linux/chrome`

The concurrent files were deliberately **not modified or staged** by this validation because their mtimes were current and indicated active parallel work.

## Static validation
- `test_vps2_bootstrap_browser_repair_v085.py`: PASS.
- proposed bootstrap `bash -n`: PASS.
- proposed bootstrap SHA256: `66d8fd768f4c5e38ac0cd097e43dfbaaa12da82d477feee33968fad9816de5cf`.
- current live stable bootstrap SHA256: `1d3d6f82289f8db0185a7a1c6f2a1d9eb933f434b622be2a6755aaa6e2c95ba1`.
- current live bootstrap remains unchanged and its `--check-prereqs` is PASS.

## Isolated recovery rehearsal
A temporary copy of the current 35-file recovery kit was created under `/dev/shm`, the proposed resolver bootstrap was inserted, only its manifest hash was recalculated in the temporary kit, and the normal recovery smoke was executed.

Result:
`PASS: Habbo VPS2 control-plane recovery smoke`

Evidence:
- files=35
- scripts=15
- units=18
- hashes=verified
- inventory=exact
- syntax=verified
- exec_links=resolved
- bootstrap=rehearsed

The proposed bootstrap also passed `--check-prereqs` on VPS2 with:
`docker=ok playwright=1.55.0 chromium=resolver webkit=2203 bridge-old=verified ssh-secrets=external`

## Remaining consistency step for the concurrent change
The workspace manifest still records the live stable bootstrap hash `1d3d6f...`, while the proposed resolver script hashes to `66d8fd...`. Before that concurrent change can be committed/promoted, its manifest entry for `usr/local/sbin/habbo-vps2-control-plane-bootstrap.sh` must match `66d8fd768f4c5e38ac0cd097e43dfbaaa12da82d477feee33968fad9816de5cf`, followed by the standard recovery smoke/regressions.

## Production safety
No live bootstrap, recovery kit, timer, browser binary, or production Habbo runtime was modified during this validation.

## Promotion closure
- The previously isolated Chromium resolver was promoted to live VPS2 after the workspace manifest was aligned to bootstrap SHA256 `66d8fd768f4c5e38ac0cd097e43dfbaaa12da82d477feee33968fad9816de5cf`.
- Live `--check-prereqs` now reports `chromium=resolver` while retaining Playwright `1.55.0`, WebKit `2203`, verified `bridge-old` SSH and external secrets.
- The live-drift monitor correctly detected exactly one approved drift after promotion: the VPS2 bootstrap changed from `1d3d6f...` to `66d8fd...`; all other tracked files matched.
- A deterministic replacement live-drift baseline was built from the current Git tree. Negative-path regression PASSed (`clean=drifts:0`, deliberate mutation=`drifts:1`).
- New live-drift baseline SHA256: `698f2f698ed86c61726ee7ba093382bfdecf11b1806cf15c74d6ff4fdebf9b6e`; live watch then returned `SUMMARY matches=87 drifts=0 missing=0 notes=0`.
- VPS1 recovery kit was regenerated after both resolver and baseline promotion. Final kit overlay SHA256: `ed6362745d9894bd1fb005922850a93745181eb5538466d24a6ed519da24d8f2`; manifest SHA256: `e39b206743a53d94822f1655a8684799922cceba1d793ee528f3e40d6eb00436`.
- Repository `vps2-control-plane-files-sha256.txt` was mirrored from that live recovery kit and is byte-identical to production.
- Canonical post-promotion backup: `/srv/habbo/backups/manual-20260926T181406Z`; local isolated restore PASS.
- Matching VPS2 offsite archive/restore PASS with SHA256 `beb0bb1292c0aff2b79a457719703a4386d5e3ca70b704d1a0bd984d23fbb9e3`, tmpfs DB datadir, network=none, 88 tables, 40 navigator styles, RogerVideo=1 and room1000=1.
- Recovery fingerprint after promotion: `055bdf7848783cd6bf4ab57e0de3ba1bc83e00522a2c1d0de8f426f5dc58606d`.
- Runtime health and disaster drill both reference `manual-20260926T181406Z`.
- Full `deployment-final-validate.sh` PASSed after promotion, including Chromium/WebKit gameplay, autonomous live-drift, offsite restore and deterministic VPS2 recovery.

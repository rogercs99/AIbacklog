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

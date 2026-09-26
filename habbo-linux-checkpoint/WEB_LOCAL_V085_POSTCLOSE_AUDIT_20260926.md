# Habbo web local v0.8.5 — post-close reproducibility audit (2026-09-26)

Scope: local/lab only. Production was not modified.

## Canonical artifact
- Library: `habbo-web-local-v0.8.5-chrome-safari-pass-20260926.zip`
- SHA256 expected: `4fb36dd2daa0f2e7a191a10649859ad7910020793ad29b0378c24f45409b0a4c`
- SHA256 recomputed from Library artifact: exact match.

## Reproducibility verification
The artifact was materialized independently from ChatGPT Library and validated from its extracted contents:
- `sha256sum -c SHA256SUMS`: PASS for the complete manifest.
- `python3 -m compileall -q .`: PASS.
- `test_safari_localhost_rewrite_v083.py`: PASS.
- `test_safari_v31_startup_retry_v084.py`: PASS.
- `test_safari_v31_connect_watchdog_v085.py`: PASS.
- `test_v31_port_cleanup_v084.py`: PASS.
- `v31_injector_race_v081.py`: PASS.
- `r39_native_stream_contract_v081.py`: PASS.
- `dual_runtime_exclusion_v081.py`: PASS.

## Repository invariants
- Branch: `project/habbo-2009-dual-linux-vps1-deploy-20260923`.
- Functional tag `habbo-web-local-v0.8.5-20260926` -> `3b6345092d93369c94242dbe5bf0cf421f2c78d4`.
- Context tag `habbo-web-local-v0.8.5-context-20260926` -> `24a76b05cca0db0ba4d2d80869cf02daaf724c93`.
- Historical untracked `habbo-linux-checkpoint/vps1-overlay/v31-web-touch-lab.sh` remains intentionally untouched.

## Runtime state after closure
At audit time only the local static asset listener on `127.0.0.1:18080` remained active. V31/R39/noVNC runtime listeners were not left running after the closed gate.

Conclusion: v0.8.5 is reproducible from the persisted Library artifact and remains the canonical local Chrome/PC + Safari/WebKit checkpoint. Any production promotion is a separate human deployment gate.

#!/usr/bin/env python3
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'vps2-offsite' / 'habbo-vps2-control-plane-bootstrap.sh'
s = p.read_text(encoding='utf-8')
assert 'browser_prereqs_ok(){' in s
assert 'repair_browser_prereqs(){' in s
assert "command -v apt-get >/dev/null || fail 'apt-get unavailable for Playwright browser prerequisite repair'" in s
assert 'python3 -m pip install --disable-pip-version-check --no-input "playwright==$EXPECTED_PLAYWRIGHT"' in s
assert 'python3 -m playwright install --with-deps chromium webkit' in s
assert "browser_prereqs_ok || fail 'Playwright/browser prerequisite repair completed but expected runtime is still unavailable'" in s
apply = s.split('  --apply)', 1)[1].split('    ;;', 1)[0]
assert 'if ! browser_prereqs_ok; then repair_browser_prereqs; fi' in apply
assert apply.index('repair_browser_prereqs') < apply.index('check_prereqs') < apply.index('install_tree /')
check = s.split('  --check-prereqs)', 1)[1].split('    ;;', 1)[0]
assert 'repair_browser_prereqs' not in check
assert 'check_prereqs' in check
assert "EXPECTED_PLAYWRIGHT='1.55.0'" in s
assert "EXPECTED_WEBKIT='/root/.cache/ms-playwright/webkit-2203/pw_run.sh'" in s
assert "EXPECTED_CHROMIUM='/root/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell'" in s
print('PASS: VPS2 bootstrap can self-repair Playwright browsers only during explicit --apply')

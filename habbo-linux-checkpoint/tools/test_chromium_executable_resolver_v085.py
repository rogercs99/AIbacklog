#!/usr/bin/env python3
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'vps2-offsite' / 'habbo-public-chromium-smoke.py'
s = p.read_text(encoding='utf-8')
assert "HABBO_CHROMIUM_EXECUTABLE" in s, 'explicit Chromium executable override missing'
assert "PLAYWRIGHT_BROWSERS_PATH" in s, 'Playwright browser cache root missing'
assert "chromium_headless_shell-*/chrome-linux/headless_shell" in s, 'headless-shell discovery missing'
assert "chromium-*/chrome-linux/chrome" in s, 'full Chromium fallback discovery missing'
assert "revision = int(" in s, 'numeric Chromium revision parsing missing'
assert "return str(max(candidates)[2])" in s, 'highest cached revision selection missing'
assert "chromium_headless_shell-1181/chrome-linux/headless_shell" not in s, 'hardcoded Chromium revision reintroduced'
assert "executable_path=chromium_executable()" in s, 'Playwright launch does not use resolver'
print('PASS: Chromium executable resolver is dynamic and overrideable')

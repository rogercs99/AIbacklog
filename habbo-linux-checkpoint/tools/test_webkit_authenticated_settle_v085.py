#!/usr/bin/env python3
from pathlib import Path
p = Path(__file__).resolve().parents[1] / 'vps2-offsite' / 'habbo-public-webkit-smoke.py'
s = p.read_text(encoding='utf-8')
needle = "page.wait_for_url('**/me', wait_until='domcontentloaded', timeout=20000)"
assert needle in s, 'authenticated /me navigation contract missing'
after = s.split(needle, 1)[1]
head = after.split("if urlparse(page.url).path != '/me':", 1)[0]
assert "wait_for_load_state('networkidle'" not in head, 'fragile final networkidle wait reintroduced'
assert "page.locator('body').wait_for(state='visible', timeout=10000)" in head, 'bounded visible-body settle missing'
assert "path == '/security_check' and status == 200" in s
assert "path == '/me' and status == 200" in s

assert "successful_cancel_paths = {" in s, 'guarded WebKit cancellation set missing'
assert "path in ('/security_check', '/local-web/habbo-es.js')" in s, 'known successful cancellation paths missing'
assert "reason == 'Load request cancelled' and urlparse(url).path in successful_cancel_paths" in s, 'guarded WebKit cancellation filter missing'
assert "status == 200" in s, 'HTTP 200 prerequisite for cancellation filter missing'
assert "'/local-web/habbo-es.js'" in s, 'habbo-es.js response tracking missing'

print('PASS: authenticated WebKit /me settle avoids fragile networkidle and only suppresses proven-200 navigation cancellations')

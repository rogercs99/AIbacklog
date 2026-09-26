#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import os
from pathlib import Path
from urllib.parse import urlparse

BASE = 'https://habbo.gamemodai.pro'
USER = os.environ.get('HABBO_CHROMIUM_USER', '')
PASSWORD = os.environ.get('HABBO_CHROMIUM_PASSWORD', '')
if not USER or not PASSWORD:
    raise SystemExit('authenticated smoke credentials missing')

def chromium_executable():
    override = os.environ.get('HABBO_CHROMIUM_EXECUTABLE', '').strip()
    if override:
        path = Path(override)
        if not path.is_file() or not os.access(path, os.X_OK):
            raise SystemExit(f'configured Chromium executable is unavailable: {path}')
        return str(path)

    root = Path(os.environ.get('PLAYWRIGHT_BROWSERS_PATH', '/root/.cache/ms-playwright'))
    candidates = []
    for pattern in ('chromium_headless_shell-*/chrome-linux/headless_shell', 'chromium-*/chrome-linux/chrome'):
        for path in root.glob(pattern):
            try:
                revision = int(path.parents[1].name.rsplit('-', 1)[1])
            except (IndexError, ValueError):
                continue
            if path.is_file() and os.access(path, os.X_OK):
                candidates.append((revision, 1 if 'headless_shell' in path.as_posix() else 0, path))
    if not candidates:
        raise SystemExit(f'no executable cached Chromium found under {root}')
    return str(max(candidates)[2])

def physical_center(page, selector):
    return page.evaluate('''sel => {
      const e = document.querySelector(sel);
      if (!e) throw new Error('missing selector: ' + sel);
      const r = e.getBoundingClientRect();
      const s = visualViewport.scale;
      return {x:(r.left+r.width/2)*s, y:(r.top+r.height/2)*s};
    }''', selector)

def assert_clean(page, bad, failed, errors, label):
    if bad:
        raise SystemExit(f'{label}: HTTP failures: {bad}')
    if failed:
        raise SystemExit(f'{label}: request failures: {failed}')
    if errors:
        raise SystemExit(f'{label}: JS errors: {errors}')

def assert_first_party_clean(page, bad, failed, errors, label):
    first_party = urlparse(BASE).hostname
    own_bad = [x for x in bad if urlparse(x[1]).hostname == first_party]
    own_failed = [x for x in failed if urlparse(x[1]).hostname == first_party]
    if own_bad:
        raise SystemExit(f'{label}: first-party HTTP failures: {own_bad}')
    if own_failed:
        raise SystemExit(f'{label}: first-party request failures: {own_failed}')
    if errors:
        raise SystemExit(f'{label}: JS errors: {errors}')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=chromium_executable())
    context = browser.new_context(viewport={'width':1440,'height':900})
    page = context.new_page()
    bad, failed, errors = [], [], []
    page.on('response', lambda r: bad.append((r.status, r.url)) if r.status >= 400 else None)
    page.on('requestfailed', lambda r: failed.append((r.failure, r.url)))
    page.on('pageerror', lambda e: errors.append('page:' + str(e)))
    page.on('console', lambda m: errors.append('console:' + m.text) if m.type == 'error' else None)

    response = page.goto(BASE + '/', wait_until='networkidle', timeout=30000)
    if response.status != 200 or page.title() != 'Habbo 2009 ~ Home':
        raise SystemExit(f'home failed: status={response.status} title={page.title()!r}')
    order = page.evaluate('''() => {
      const h = document.documentElement.innerHTML;
      const a = '/web-gallery/static/js/libs2.js';
      const b = '/web-gallery/static/js/landing.js';
      return {libs:h.indexOf(a), landing:h.indexOf(b), scale:visualViewport.scale, width:innerWidth};
    }''')
    if order['libs'] < 0 or order['landing'] < 0 or order['libs'] > order['landing']:
        raise SystemExit('home script order invalid')
    pos = physical_center(page, '#login-username')
    page.mouse.click(pos['x'], pos['y'])
    if page.evaluate('document.activeElement?.id') != 'login-username':
        raise SystemExit('physical mouse click did not focus login username')
    assert_first_party_clean(page, bad, failed, errors, 'home')

    bad.clear(); failed.clear(); errors.clear()
    pos = physical_center(page, 'a[href$="/register"]')
    with page.expect_navigation(wait_until='networkidle', timeout=15000):
        page.mouse.click(pos['x'], pos['y'])
    if page.url != BASE + '/register' or page.title() != 'Habbo 2009: Register':
        raise SystemExit(f'register navigation failed: {page.url} {page.title()!r}')
    assert_first_party_clean(page, bad, failed, errors, 'register')

    before = page.locator('#bean_marketing').is_checked()
    pos = physical_center(page, '#bean_marketing')
    page.mouse.click(pos['x'], pos['y'])
    after = page.locator('#bean_marketing').is_checked()
    if before == after:
        raise SystemExit('register mouse control did not toggle')

    bad.clear(); failed.clear(); errors.clear()
    auth_seen = []
    def record_auth(r):
        path = urlparse(r.url).path
        if path in ('/account/submit', '/security_check', '/me', '/local-web/habbo-es.js'):
            auth_seen.append((path, r.status))
    page.on('response', record_auth)

    response = page.goto(BASE + '/', wait_until='networkidle', timeout=30000)
    if response.status != 200:
        raise SystemExit(f'login home failed: status={response.status}')
    pos = physical_center(page, '#login-username')
    page.mouse.click(pos['x'], pos['y'])
    page.keyboard.type(USER)
    pos = physical_center(page, '#login-password')
    page.mouse.click(pos['x'], pos['y'])
    page.keyboard.type(PASSWORD)
    pos = physical_center(page, '#login-submit-new-button')
    with page.expect_navigation(wait_until='domcontentloaded', timeout=20000):
        page.mouse.click(pos['x'], pos['y'])
    page.wait_for_url('**/me', wait_until='domcontentloaded', timeout=20000)
    page.locator('body').wait_for(state='visible', timeout=10000)
    if urlparse(page.url).path != '/me':
        raise SystemExit(f'authenticated final URL failed: {page.url}')
    if not any(path == '/security_check' and status == 200 for path, status in auth_seen):
        raise SystemExit(f'security_check response missing: {auth_seen}')
    if not any(path == '/me' and status == 200 for path, status in auth_seen):
        raise SystemExit(f'me response missing: {auth_seen}')
    body = page.locator('body').inner_text()
    if USER not in body:
        raise SystemExit('authenticated username missing from /me')
    # WebKit may emit requestfailed=Load request cancelled for requests that
    # completed successfully before a navigation superseded them. Suppress only
    # the two known first-party paths when the matching HTTP 200 was observed.
    successful_cancel_paths = {
        path for path, status in auth_seen
        if status == 200 and path in ('/security_check', '/local-web/habbo-es.js')
    }
    failed[:] = [(reason, url) for reason, url in failed
                 if not (reason in ('Load request cancelled', 'net::ERR_ABORTED')
                         and urlparse(url).path in successful_cancel_paths)]
    assert_first_party_clean(page, bad, failed, errors, 'authenticated')

    bad.clear(); failed.clear(); errors.clear()
    response = page.goto(BASE + '/play/v31', wait_until='domcontentloaded', timeout=35000)
    if response.status != 200:
        raise SystemExit(f'V31 page failed: status={response.status} url={page.url} body={response.text()[:240]!r}')
    page.wait_for_function("window.__habboV31 && window.__habboV31.connected === true", timeout=35000)
    v31_html = page.content().lower()
    if 'sso.ticket=' in v31_html or '<object' in v31_html or '<embed' in v31_html:
        raise SystemExit('V31 browser contract leaked legacy client material')
    if 'habbo v31 conectado' not in page.locator('#v31-status').inner_text().lower():
        raise SystemExit('V31 connected status missing')
    assert_first_party_clean(page, bad, failed, errors, 'v31')
    print('PASS: V31 public noVNC connected')

    bad.clear(); failed.clear(); errors.clear()
    response = page.goto(BASE + '/play/r39', wait_until='domcontentloaded', timeout=35000)
    if response.status != 200:
        raise SystemExit(f'R39 page failed: status={response.status} url={page.url} body={response.text()[:240]!r}')
    page.wait_for_function("window.__habboR39 && window.__habboR39.connected === true", timeout=35000)
    r39_html = page.content().lower()
    if 'sso.ticket=' in r39_html or '"sso.ticket"' in r39_html or '<object' in r39_html or '<embed' in r39_html:
        raise SystemExit('R39 browser contract leaked legacy client material')
    if 'habbo r39 conectado' not in page.locator('#r39-status').inner_text().lower():
        raise SystemExit('R39 connected status missing')
    assert_first_party_clean(page, bad, failed, errors, 'r39')
    print('PASS: R39 public native noVNC connected')
    print(f"PASS: Chromium desktop smoke home+register+login+me+V31+R39, scale={order['scale']:.6f}, layout_width={order['width']}, auth_user={USER}")
    context.close(); browser.close()

#!/usr/bin/env python3
from playwright.sync_api import sync_playwright
import os
from urllib.parse import urlparse

BASE = 'https://habbo.gamemodai.pro'
USER = os.environ.get('HABBO_WEBKIT_USER', '')
PASSWORD = os.environ.get('HABBO_WEBKIT_PASSWORD', '')
if not USER or not PASSWORD:
    raise SystemExit('authenticated smoke credentials missing')

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

with sync_playwright() as p:
    browser = p.webkit.launch(headless=True)
    context = browser.new_context(**p.devices['iPhone 14 Plus'])
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
    page.touchscreen.tap(pos['x'], pos['y'])
    if page.evaluate('document.activeElement?.id') != 'login-username':
        raise SystemExit('physical touch did not focus login username')
    assert_clean(page, bad, failed, errors, 'home')

    bad.clear(); failed.clear(); errors.clear()
    pos = physical_center(page, 'a[href$="/register"]')
    with page.expect_navigation(wait_until='networkidle', timeout=15000):
        page.touchscreen.tap(pos['x'], pos['y'])
    if page.url != BASE + '/register' or page.title() != 'Habbo 2009: Register':
        raise SystemExit(f'register navigation failed: {page.url} {page.title()!r}')
    assert_clean(page, bad, failed, errors, 'register')

    before = page.locator('#bean_marketing').is_checked()
    pos = physical_center(page, '#bean_marketing')
    page.touchscreen.tap(pos['x'], pos['y'])
    after = page.locator('#bean_marketing').is_checked()
    if before == after:
        raise SystemExit('register touch control did not toggle')

    bad.clear(); failed.clear(); errors.clear()
    auth_seen = []
    def record_auth(r):
        path = urlparse(r.url).path
        if path in ('/account/submit', '/security_check', '/me'):
            auth_seen.append((path, r.status))
    page.on('response', record_auth)

    response = page.goto(BASE + '/', wait_until='networkidle', timeout=30000)
    if response.status != 200:
        raise SystemExit(f'login home failed: status={response.status}')
    pos = physical_center(page, '#login-username')
    page.touchscreen.tap(pos['x'], pos['y'])
    page.keyboard.type(USER)
    pos = physical_center(page, '#login-password')
    page.touchscreen.tap(pos['x'], pos['y'])
    page.keyboard.type(PASSWORD)
    pos = physical_center(page, '#login-submit-new-button')
    with page.expect_navigation(wait_until='domcontentloaded', timeout=20000):
        page.touchscreen.tap(pos['x'], pos['y'])
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
    # WebKit may emit requestfailed=Load request cancelled for the successful
    # security_check navigation while also reporting its HTTP 200 response.
    if any(path == '/security_check' and status == 200 for path, status in auth_seen):
        failed[:] = [(reason, url) for reason, url in failed
                     if not (reason == 'Load request cancelled' and urlparse(url).path == '/security_check')]
    assert_clean(page, bad, failed, errors, 'authenticated')

    print(f"PASS: WebKit iPhone smoke home+register+login+me, scale={order['scale']:.6f}, layout_width={order['width']}, auth_user={USER}")
    context.close(); browser.close()

#!/usr/bin/env python3
import re
import urllib.request
BASE = 'https://habbo.gamemodai.pro'
UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 Version/27.0 Mobile/15E148 Safari/604.1'
ASSET_EXT = ('.css','.js','.gif','.png','.jpg','.jpeg','.ico','.htc','.xml','.dcr','.swf')
headers = {'User-Agent': UA, 'Cache-Control':'no-cache', 'Pragma':'no-cache'}
assets=set()
for page in ('/','/register'):
    req=urllib.request.Request(BASE+page,headers=headers)
    with urllib.request.urlopen(req,timeout=15) as resp:
        html=resp.read().decode('utf-8','replace')
    if page == '/':
        libs = '/web-gallery/static/js/libs2.js'
        landing = '/web-gallery/static/js/landing.js'
        if libs not in html or landing not in html or html.index(libs) > html.index(landing):
            raise SystemExit('homepage script dependency/order failure: libs2.js must load before landing.js')
    for m in re.finditer(r'(?:src|href)=[\"\']([^\"\']+)',html,re.I):
        ref=m.group(1).split('#',1)[0]
        if ref.startswith(BASE): ref=ref[len(BASE):]
        elif not ref.startswith('/'): continue
        if ref.split('?',1)[0].lower().endswith(ASSET_EXT): assets.add(ref)
for ref in sorted(assets):
    req=urllib.request.Request(BASE+ref,headers=headers)
    with urllib.request.urlopen(req,timeout=15) as resp:
        ctype=(resp.headers.get('Content-Type') or '').lower()
        resp.read(1)
        if not 200 <= resp.status < 400:
            raise SystemExit(f'asset HTTP failure: {resp.status} {ref}')
        if 'text/html' in ctype:
            raise SystemExit(f'asset unexpectedly returned HTML: {ref}')
print(f'PASS: dynamic iPhone asset audit ({len(assets)} direct assets)')

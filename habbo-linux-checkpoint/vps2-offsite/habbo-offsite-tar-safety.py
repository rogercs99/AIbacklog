#!/usr/bin/env python3
import argparse, os, posixpath, sys, tarfile

MAX_MEMBERS = 128
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_FILE_BYTES = 256 * 1024 * 1024

def fail(msg: str) -> None:
    print(f'FAIL: {msg}', file=sys.stderr)
    raise SystemExit(1)

parser=argparse.ArgumentParser()
parser.add_argument('--nested', action='store_true')
parser.add_argument('archive')
args=parser.parse_args()
archive=args.archive
if not os.path.isfile(archive):
    fail(f'archive missing: {archive}')

try:
    with tarfile.open(archive, 'r:gz') as tf:
        members = tf.getmembers()
except (tarfile.TarError, OSError) as exc:
    fail(f'cannot read tar archive: {exc}')

if not (1 <= len(members) <= MAX_MEMBERS):
    fail(f'unsafe member count: {len(members)}')
seen = set()
total = 0
files = 0
dirs = 0
for m in members:
    name = m.name
    if not name or '\\' in name or name.startswith('/'):
        fail(f'unsafe member name: {name!r}')
    parts = [p for p in name.split('/') if p not in ('', '.')]
    if any(p == '..' for p in parts):
        fail(f'parent traversal member: {name!r}')
    normalized = posixpath.normpath(name)
    if normalized == '.':
        if not m.isdir():
            fail('archive root member is not a directory')
        dirs += 1
        continue
    if normalized.startswith('../') or normalized == '..':
        fail(f'normalized traversal member: {name!r}')
    if (not args.nested) and '/' in normalized:
        fail(f'nested member not allowed: {name!r}')
    if normalized in seen:
        fail(f'duplicate normalized member: {normalized!r}')
    seen.add(normalized)
    if m.isdir():
        if not args.nested:
            fail(f'nested directory not allowed: {name!r}')
        dirs += 1
        continue
    if not m.isfile():
        fail(f'non-regular member not allowed: {name!r} type={m.type!r}')
    if m.size < 0 or m.size > MAX_FILE_BYTES:
        fail(f'unsafe member size: {name!r} size={m.size}')
    total += m.size
    if total > MAX_TOTAL_BYTES:
        fail(f'unsafe total declared size: {total}')
    files += 1

if dirs > 1:
    fail(f'unexpected directory member count: {dirs}')
if files < 1:
    fail('archive contains no regular files')
print('PASS: Habbo offsite tar safety')
print(f'members={len(members)} files={files} dirs={dirs} total_bytes={total} links=0 special=0 nested_mode={int(args.nested)} traversal=0 duplicates=0')
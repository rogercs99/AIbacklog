#!/usr/bin/env bash
set -euo pipefail
MIN_ROOT_KB=${MIN_ROOT_KB:-819200}
CLEAN_BELOW_KB=${CLEAN_BELOW_KB:-921600}
MIN_SHM_KB=${MIN_SHM_KB:-524288}
root_free(){ df -Pk / | awk 'NR==2 {print $4}'; }
shm_free(){ df -Pk /dev/shm | awk 'NR==2 {print $4}'; }
root_before=$(root_free)
shm_before=$(shm_free)
journal_before_kb=0
[[ -d /var/log/journal ]] && journal_before_kb=$(du -sk /var/log/journal 2>/dev/null | awk '{print $1}')
cleanup=none
if [[ "$root_before" -lt "$CLEAN_BELOW_KB" ]]; then
  apt_locked=$(python3 - <<'PYLOCK'
import fcntl, os
paths=(
    '/var/lib/dpkg/lock-frontend',
    '/var/lib/dpkg/lock',
    '/var/lib/apt/lists/lock',
    '/var/cache/apt/archives/lock',
)
locked=False
for path in paths:
    if not os.path.exists(path):
        continue
    fd=os.open(path, os.O_RDWR)
    try:
        try:
            fcntl.lockf(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            locked=True
            break
        else:
            fcntl.lockf(fd, fcntl.LOCK_UN)
    finally:
        os.close(fd)
print('true' if locked else 'false')
PYLOCK
)
  if $apt_locked; then
    cleanup=skipped-apt-locked
  else
    rm -f /var/cache/apt/pkgcache.bin /var/cache/apt/srcpkgcache.bin
    rm -rf /var/lib/apt/lists/*
    install -d -m 755 /var/lib/apt/lists/partial
    cleanup=apt-metadata
  fi
fi
root_after=$(root_free)
if [[ "$root_after" -lt "$CLEAN_BELOW_KB" && "$journal_before_kb" -ge 153600 ]]; then
  journalctl --rotate >/dev/null 2>&1 || true
  journalctl --vacuum-size=120M >/dev/null 2>&1 || true
  if [[ "$cleanup" == none ]]; then cleanup=journal; else cleanup="$cleanup+journal"; fi
fi
root_after=$(root_free)
shm_after=$(shm_free)
journal_after_kb=0
[[ -d /var/log/journal ]] && journal_after_kb=$(du -sk /var/log/journal 2>/dev/null | awk '{print $1}')
if [[ "$root_after" -lt "$MIN_ROOT_KB" ]]; then
  echo "FAIL: VPS2 root free space below minimum (${root_after} KiB < ${MIN_ROOT_KB} KiB), cleanup=$cleanup" >&2
  exit 1
fi
if [[ "$shm_after" -lt "$MIN_SHM_KB" ]]; then
  echo "FAIL: VPS2 /dev/shm free space below minimum (${shm_after} KiB < ${MIN_SHM_KB} KiB)" >&2
  exit 1
fi
echo 'PASS: Habbo VPS2 space preflight'
echo "root_before_kb=$root_before root_free_kb=$root_after shm_free_kb=$shm_after journal_before_kb=$journal_before_kb journal_after_kb=$journal_after_kb cleanup=$cleanup"

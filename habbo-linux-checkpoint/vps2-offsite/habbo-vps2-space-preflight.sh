#!/usr/bin/env bash
set -euo pipefail
MIN_ROOT_KB=${MIN_ROOT_KB:-819200}
CLEAN_BELOW_KB=${CLEAN_BELOW_KB:-921600}
MIN_SHM_KB=${MIN_SHM_KB:-524288}
root_free(){ df -Pk / | awk 'NR==2 {print $4}'; }
shm_free(){ df -Pk /dev/shm | awk 'NR==2 {print $4}'; }
root_before=$(root_free)
shm_before=$(shm_free)
cleanup=none
if [[ "$root_before" -lt "$CLEAN_BELOW_KB" ]]; then
  apt_locked=false
  for lock in /var/lib/dpkg/lock-frontend /var/lib/dpkg/lock /var/lib/apt/lists/lock /var/cache/apt/archives/lock; do
    [[ -e "$lock" ]] || continue
    if fuser "$lock" >/dev/null 2>&1; then apt_locked=true; break; fi
  done
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
shm_after=$(shm_free)
if [[ "$root_after" -lt "$MIN_ROOT_KB" ]]; then
  echo "FAIL: VPS2 root free space below minimum (${root_after} KiB < ${MIN_ROOT_KB} KiB), cleanup=$cleanup" >&2
  exit 1
fi
if [[ "$shm_after" -lt "$MIN_SHM_KB" ]]; then
  echo "FAIL: VPS2 /dev/shm free space below minimum (${shm_after} KiB < ${MIN_SHM_KB} KiB)" >&2
  exit 1
fi
echo 'PASS: Habbo VPS2 space preflight'
echo "root_before_kb=$root_before root_free_kb=$root_after shm_free_kb=$shm_after cleanup=$cleanup"
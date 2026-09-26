#!/usr/bin/env bash
set -euo pipefail
umask 077
SELF=$(readlink -f "${BASH_SOURCE[0]}")
DEFAULT_SRC=${SELF%/usr/local/sbin/habbo-vps2-control-plane-bootstrap.sh}
[[ "$DEFAULT_SRC" != "$SELF" ]] || DEFAULT_SRC=/
SRC=${HABBO_VPS2_SOURCE_ROOT:-$DEFAULT_SRC}
REMOTE=bridge-old
EXPECTED_KEY_FP='SHA256:wV37m0XRxH8D7KV+0gfdi8KAJq4KoFmEpRpXIM8b/TY'
EXPECTED_VPS1_HOST_FP='SHA256:PzuiYZ42mk2R0T1DA6trACSppxrfXBmxJP21cnwtG7g'
EXPECTED_PLAYWRIGHT='1.55.0'
EXPECTED_WEBKIT='/root/.cache/ms-playwright/webkit-2203/pw_run.sh'
EXPECTED_CHROMIUM='/root/.cache/ms-playwright/chromium_headless_shell-1181/chrome-linux/headless_shell'
TIMERS=(
  habbo-live-drift-watch.timer
  habbo-public-chromium.timer
  habbo-vps1-offsite-pull.timer
  habbo-vps1-offsite-restore-drill.timer
  habbo-public-webkit.timer
  habbo-vps2-control-plane-heartbeat.timer
)
fail(){ echo "FAIL: $*" >&2; exit 1; }
usage(){ echo "usage: $0 --rehearsal TARGET_ROOT | --check-prereqs | --apply" >&2; exit 2; }

validate_source(){
  [[ -d "$SRC/usr/local/sbin" && -d "$SRC/etc/systemd/system" ]] || fail "invalid source root: $SRC"
  mapfile -t scripts < <(find "$SRC/usr/local/sbin" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
  mapfile -t units < <(find "$SRC/etc/systemd/system" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
  [[ "${#scripts[@]}" -eq 15 ]] || fail "source script count mismatch: ${#scripts[@]} (expected 15)"
  [[ "${#units[@]}" -eq 18 ]] || fail "source unit count mismatch: ${#units[@]} (expected 18)"
  [[ -f "$SRC/usr/local/sbin/habbo-vps2-control-plane-bootstrap.sh" ]] || fail 'bootstrap missing from source kit'
  [[ -f "$SRC/usr/local/share/habbo-live-drift-baseline.tar.gz" ]] || fail 'drift baseline missing from source kit'
  [[ -f "$SRC/usr/local/share/habbo-live-drift-baseline.tar.gz.sha256" ]] || fail 'drift baseline sidecar missing from source kit'
  [[ "$(stat -c '%a %U:%G' "$SRC/usr/local/share/habbo-live-drift-baseline.tar.gz")" == '600 root:root' ]] || fail 'drift baseline source permissions invalid'
  [[ "$(stat -c '%a %U:%G' "$SRC/usr/local/share/habbo-live-drift-baseline.tar.gz.sha256")" == '600 root:root' ]] || fail 'drift baseline sidecar source permissions invalid'
  (cd "$SRC/usr/local/share" && sha256sum -c habbo-live-drift-baseline.tar.gz.sha256 --status) || fail 'drift baseline source SHA mismatch'
  for f in "${scripts[@]}"; do
    case "$f" in
      *.sh) bash -n "$f" || fail "Bash syntax invalid: ${f#$SRC/}" ;;
      *.py) python3 - "$f" <<'PY'
import pathlib,sys
p=pathlib.Path(sys.argv[1])
compile(p.read_text(encoding='utf-8'), str(p), 'exec')
PY
      ;;
    esac
  done
  for unit in "$SRC"/etc/systemd/system/*.service; do
    while IFS= read -r cmd; do
      [[ -n "$cmd" ]] || continue
      cmd=${cmd#-}; cmd=${cmd#+}; cmd=${cmd#!}; cmd=${cmd#@}
      exe=${cmd%% *}
      case "$exe" in
        /usr/local/sbin/habbo-*) [[ -f "$SRC$exe" ]] || fail "${unit##*/} references missing $exe" ;;
      esac
    done < <(sed -n 's/^ExecStart=//p' "$unit")
  done
  for timer in "${TIMERS[@]}"; do
    [[ -f "$SRC/etc/systemd/system/$timer" ]] || fail "required timer missing: $timer"
    unit_target=$(sed -n 's/^Unit=//p' "$SRC/etc/systemd/system/$timer" | tail -1)
    [[ -n "$unit_target" ]] || unit_target=${timer%.timer}.service
    [[ -f "$SRC/etc/systemd/system/$unit_target" ]] || fail "$timer target missing: $unit_target"
  done
}

check_prereqs(){
  [[ $(id -u) -eq 0 ]] || fail 'bootstrap must run as root'
  local commands=(bash ssh ssh-keygen docker python3 systemctl journalctl flock tar gzip sha256sum awk sed grep find df stat date mktemp install)
  for c in "${commands[@]}"; do command -v "$c" >/dev/null || fail "required command missing: $c"; done
  docker info >/dev/null 2>&1 || fail 'Docker daemon unavailable'
  pyver=$(python3 - <<'PY'
import importlib.metadata as m
try: print(m.version('playwright'))
except Exception: print('missing')
PY
)
  [[ "$pyver" == "$EXPECTED_PLAYWRIGHT" ]] || fail "Playwright version mismatch: $pyver (expected $EXPECTED_PLAYWRIGHT)"
  [[ -x "$EXPECTED_WEBKIT" ]] || fail "Playwright WebKit 2203 missing: $EXPECTED_WEBKIT"
  [[ -x "$EXPECTED_CHROMIUM" ]] || fail "Chromium headless shell 1181 missing: $EXPECTED_CHROMIUM"
  ssh -G "$REMOTE" >/dev/null 2>&1 || fail 'bridge-old SSH alias unavailable'
  key=$(ssh -G "$REMOTE" 2>/dev/null | awk '$1=="identityfile"{print $2; exit}')
  [[ -n "$key" && -f "$key" ]] || fail 'bridge-old identity file missing'
  [[ "$(stat -c '%a %U:%G' "$key")" == '600 root:root' ]] || fail 'bridge-old identity permissions invalid'
  keyfp=$(ssh-keygen -lf "$key" | awk '{print $2}')
  [[ "$keyfp" == "$EXPECTED_KEY_FP" ]] || fail "bridge-old identity fingerprint mismatch: $keyfp"
  ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE" 'test -r /srv/habbo/LATEST_PUBLIC_WEB_BACKUP' || fail 'bridge-old cannot reach VPS1 Habbo state'
  hostfp=$(ssh -o BatchMode=yes "$REMOTE" 'ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub' | awk '{print $2}')
  [[ "$hostfp" == "$EXPECTED_VPS1_HOST_FP" ]] || fail "VPS1 host fingerprint mismatch: $hostfp"
}

install_tree(){
  local target=$1
  install -d -m 755 "$target/usr/local/sbin" "$target/usr/local/share" "$target/etc/systemd/system"
  for f in "$SRC"/usr/local/sbin/habbo-*; do install -m 700 "$f" "$target/usr/local/sbin/${f##*/}"; done
  install -m 600 "$SRC/usr/local/share/habbo-live-drift-baseline.tar.gz" "$target/usr/local/share/habbo-live-drift-baseline.tar.gz"
  install -m 600 "$SRC/usr/local/share/habbo-live-drift-baseline.tar.gz.sha256" "$target/usr/local/share/habbo-live-drift-baseline.tar.gz.sha256"
  for f in "$SRC"/etc/systemd/system/habbo-*; do install -m 644 "$f" "$target/etc/systemd/system/${f##*/}"; done
  install -d -m 700 "$target/var/backups/habbo-vps1"
}

enable_offline(){
  local target=$1
  install -d -m 755 "$target/etc/systemd/system/timers.target.wants"
  for timer in "${TIMERS[@]}"; do ln -sfn "../$timer" "$target/etc/systemd/system/timers.target.wants/$timer"; done
}

validate_installed_root(){
  local target=$1
  mapfile -t scripts < <(find "$target/usr/local/sbin" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
  mapfile -t units < <(find "$target/etc/systemd/system" -maxdepth 1 -type f -name 'habbo-*' -printf '%p\n' | sort)
  [[ "${#scripts[@]}" -eq 15 ]] || fail "installed script count mismatch: ${#scripts[@]}"
  [[ "${#units[@]}" -eq 18 ]] || fail "installed unit count mismatch: ${#units[@]}"
  for f in "${scripts[@]}"; do [[ "$(stat -c '%a %U:%G' "$f")" == '700 root:root' ]] || fail "script mode invalid: $f"; done
  for f in "${units[@]}"; do [[ "$(stat -c '%a %U:%G' "$f")" == '644 root:root' ]] || fail "unit mode invalid: $f"; done
  [[ "$(stat -c '%a %U:%G' "$target/var/backups/habbo-vps1")" == '700 root:root' ]] || fail 'offsite store mode invalid in target root'
  [[ "$(stat -c '%a %U:%G' "$target/usr/local/share/habbo-live-drift-baseline.tar.gz")" == '600 root:root' ]] || fail 'installed drift baseline mode invalid'
  [[ "$(stat -c '%a %U:%G' "$target/usr/local/share/habbo-live-drift-baseline.tar.gz.sha256")" == '600 root:root' ]] || fail 'installed drift baseline sidecar mode invalid'
  (cd "$target/usr/local/share" && sha256sum -c habbo-live-drift-baseline.tar.gz.sha256 --status) || fail 'installed drift baseline SHA mismatch'
  for timer in "${TIMERS[@]}"; do
    link="$target/etc/systemd/system/timers.target.wants/$timer"
    [[ -L "$link" && "$(readlink "$link")" == "../$timer" ]] || fail "offline enable link invalid: $timer"
  done
}

seed_store(){
  local dest=/var/backups/habbo-vps1 lock=/run/lock/habbo-vps1-offsite.lock
  install -d -m 700 "$dest"
  exec 8>"$lock"
  flock -w 120 8 || fail 'offsite seed lock unavailable after 120s'
  state=$(ssh -o BatchMode=yes "$REMOTE" 'systemctl show -p ActiveState --value habbo-backup-daily.service')
  case "$state" in active|activating|reloading|deactivating) fail "VPS1 daily backup state is $state";; esac
  mapfile -t remote_names < <(ssh -o BatchMode=yes "$REMOTE" "find /srv/habbo/backups -maxdepth 1 -mindepth 1 -type d -name 'manual-*' -printf '%f\\n' | grep -E '^manual-[0-9]{8}T[0-9]{6}Z$' | sort -r | head -3 | sort")
  [[ "${#remote_names[@]}" -eq 3 ]] || fail "VPS1 does not expose three seed generations (${#remote_names[@]})"
  for name in "${remote_names[@]}"; do
    remote="/srv/habbo/backups/$name"
    final="$dest/$name.tar.gz"
    side="$final.sha256"
    if [[ -f "$final" && -f "$side" ]] && sha256sum -c "$side" --status; then continue; fi
    ssh -o BatchMode=yes "$REMOTE" "cd '$remote' && sha256sum -c SHA256SUMS >/dev/null"
    tmp="$dest/.$name.bootstrap.tmp"
    rm -f "$tmp"
    ssh -o BatchMode=yes "$REMOTE" "exec tar -C '$remote' -czf - ." >"$tmp"
    chmod 600 "$tmp"
    gzip -t "$tmp"
    "$SRC/usr/local/sbin/habbo-offsite-tar-safety.py" "$tmp" >/dev/null || fail "seed archive structural safety failed: $name"
    work=$(mktemp -d /dev/shm/habbo-bootstrap-seed.XXXXXX)
    tar -xzf "$tmp" -C "$work"
    (cd "$work" && sha256sum -c SHA256SUMS --status) || { rm -rf "$work" "$tmp"; fail "seed internal manifest failed: $name"; }
    rm -rf "$work"
    mv "$tmp" "$final"
    sha=$(sha256sum "$final" | awk '{print $1}')
    printf '%s  %s\n' "$sha" "$final" >"$side"
    chmod 600 "$final" "$side"
  done
  declare -A keep=()
  for name in "${remote_names[@]}"; do keep["$dest/$name.tar.gz"]=1; done
  while IFS= read -r f; do [[ -n "${keep[$f]:-}" ]] || rm -f -- "$f" "$f.sha256"; done < <(find "$dest" -maxdepth 1 -type f -name 'manual-*.tar.gz' -printf '%p\n')
  newest=${remote_names[-1]}
  printf '%s\n' "$dest/$newest.tar.gz" >"$dest/LATEST"
  chmod 600 "$dest/LATEST"
  flock -u 8
}

mode=${1:-}
case "$mode" in
  --rehearsal)
    target=${2:-}; [[ -n "$target" && "$target" != / ]] || usage
    validate_source
    [[ ! -e "$target" ]] || fail "rehearsal target already exists: $target"
    install -d -m 700 "$target"
    install_tree "$target"
    enable_offline "$target"
    validate_installed_root "$target"
    echo 'PASS: Habbo VPS2 control-plane bootstrap rehearsal'
    echo "source=$SRC target=$target files=35 scripts=15 units=18 timers=6 modes=verified offline_enable=verified secrets=external"
    ;;
  --check-prereqs)
    check_prereqs
    echo 'PASS: Habbo VPS2 bootstrap prerequisites'
    echo 'docker=ok playwright=1.55.0 webkit=2203 bridge-old=verified ssh-secrets=external'
    ;;
  --apply)
    [[ "$SRC" != / ]] || fail 'refusing --apply with live / as source; run bootstrap from an extracted recovery kit or set HABBO_VPS2_SOURCE_ROOT'
    validate_source
    check_prereqs
    install_tree /
    seed_store
    systemctl daemon-reload
    systemctl enable --now "${TIMERS[@]}"
    systemctl start habbo-vps1-offsite-pull.service
    systemctl start habbo-live-drift-watch.service
    systemctl start habbo-public-chromium.service
    systemctl start habbo-public-webkit.service
    systemctl start habbo-vps1-offsite-restore-drill.service
    systemctl reset-failed habbo-vps2-control-plane-heartbeat.service habbo-vps2-control-plane-heartbeat-failed.service || true
    systemctl start habbo-vps2-control-plane-heartbeat.service
    /usr/local/sbin/habbo-vps1-offsite-store-smoke.sh
    echo 'PASS: Habbo VPS2 control plane bootstrapped'
    echo 'files=35 scripts=15 units=18 timers=6 offsite_seed=3 verification=pull+drift+chromium+webkit+restore+heartbeat secrets=external'
    ;;
  *) usage ;;
esac

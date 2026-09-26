#!/usr/bin/env bash
set -euo pipefail
if [[ -n "${HABBO_DRIFT_BASELINE_ROOT:-}" ]]; then
  REPO_ROOT=$(readlink -f "$HABBO_DRIFT_BASELINE_ROOT")
else
  REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
fi
VPS1_DIR="$REPO_ROOT/habbo-linux-checkpoint/vps1-overlay"
VPS2_DIR="$REPO_ROOT/habbo-linux-checkpoint/vps2-offsite"
CONTROL=$(mktemp -u /tmp/habbo-drift-ctrl.XXXXXX)
SSH=(ssh -o BatchMode=yes -o ControlMaster=auto -o ControlPersist=60 -o ControlPath="$CONTROL" bridge-old)
matches=0
drifts=0
missing=0
notes=0

repo_hash(){ sha256sum "$1" | awk '{print $1}'; }
local_hash(){ sha256sum "$1" | awk '{print $1}'; }
remote_hash(){ "${SSH[@]}" "sha256sum '$1' | awk '{print \$1}'"; }

report_pair(){
  local scope=$1 file=$2 repo=$3 live=$4
  if [[ ! -f "$repo" ]]; then
    echo "MISSING_REPO $scope $file"
    ((missing+=1))
    return
  fi
  local a b
  a=$(repo_hash "$repo")
  if [[ "$scope" == VPS2 ]]; then
    if [[ ! -f "$live" ]]; then
      echo "MISSING_LIVE $scope $file -> $live"
      ((missing+=1))
      return
    fi
    b=$(local_hash "$live")
  else
    if ! "${SSH[@]}" "test -f '$live'"; then
      echo "MISSING_LIVE $scope $file -> $live"
      ((missing+=1))
      return
    fi
    b=$(remote_hash "$live")
  fi
  if [[ "$a" == "$b" ]]; then
    echo "MATCH $scope $file"
    ((matches+=1))
  else
    echo "DRIFT $scope $file repo=$a live=$b"
    ((drifts+=1))
  fi
}

for repo in "$VPS2_DIR"/*; do
  f=$(basename "$repo")
  case "$f" in
    *.service|*.timer) live="/etc/systemd/system/$f"; report_pair VPS2 "$f" "$repo" "$live" ;;
    *.sh|*.py) live="/usr/local/sbin/$f"; report_pair VPS2 "$f" "$repo" "$live" ;;
    vps2-control-plane-files-sha256.txt)
      a=$(repo_hash "$repo")
      b=$(remote_hash "/srv/habbo/releases/disaster/$f")
      if [[ "$a" == "$b" ]]; then echo "MATCH GENERATED $f"; ((matches+=1)); else echo "DRIFT GENERATED $f repo=$a live=$b"; ((drifts+=1)); fi
      ;;
  esac
done

for repo in "$VPS1_DIR"/*; do
  f=$(basename "$repo")
  case "$f" in
    v31-web-touch-lab.sh) echo "NOTE historical-untracked $f"; ((notes+=1)); continue ;;
    cloudflared-v085-habbo-ingress.yml) continue ;;
    *.service|*.timer) live="/etc/systemd/system/$f" ;;
    docker-compose.yml) live="/srv/habbo/docker-compose.yml" ;;
    DISASTER_RECOVERY_MANIFEST.md|HOST_PREREQUISITES.md) live="/srv/habbo/$f" ;;
    habbo-library-chunks-sha256.txt|habbo-runtime-prefix-parts-sha256.txt) live="/srv/habbo/releases/disaster/$f" ;;
    register.tpl) live="/srv/habbo/web-frontend-assets/templates/register.tpl" ;;
    *.sh|*.py) live="/srv/habbo/ops/$f" ;;
    *) continue ;;
  esac
  report_pair VPS1 "$f" "$repo" "$live"
done

tmp=$(mktemp)
cleanup(){ ssh -o BatchMode=yes -o ControlPath="$CONTROL" -O exit bridge-old >/dev/null 2>&1 || true; rm -f "$tmp" "$CONTROL"; }
trap cleanup EXIT
"${SSH[@]}" 'cat /etc/cloudflared-stremio-legacy/config.yml' > "$tmp"
if python3 - "$VPS1_DIR/cloudflared-v085-habbo-ingress.yml" "$tmp" <<'PY'
import sys
snippet_path, live_path = sys.argv[1:3]
with open(snippet_path, encoding="utf-8") as f:
    wanted = [line.strip() for line in f if line.strip()]
with open(live_path, encoding="utf-8") as f:
    have = {line.strip() for line in f if line.strip()}
missing_lines = [line for line in wanted if line not in have]
if missing_lines:
    print("DRIFT VPS1 cloudflared-v085-habbo-ingress.yml missing-lines=" + repr(missing_lines))
    raise SystemExit(1)
print("MATCH VPS1 cloudflared-v085-habbo-ingress.yml semantic-subset")
PY
then
  ((matches+=1))
else
  ((drifts+=1))
fi

echo "SUMMARY matches=$matches drifts=$drifts missing=$missing notes=$notes"
(( drifts == 0 && missing == 0 ))

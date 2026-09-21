# Immediate recovery procedure

After reading this checkpoint, continue immediately. Do not restart the investigation from scratch.

## 1. Re-establish paths
```bash
LAB=/mnt/data/habbo_local_lab
HAVANA="$LAB/runtime/havana/Havana"
MDBROOT="$LAB/runtime/mariadb-x64/linux"
MDBDATA="$LAB/runtime/mariadb-data"
SOCK="$LAB/runtime/mariadb.sock"
```

## 2. Check existing processes first
```bash
ps -eo pid,cmd | grep -E 'mariadbd|Havana-(Server|Web)|java .*Havana|Xvfb|ffmpeg|wine' | grep -v grep || true
ss -ltnp | grep -E ':3307|:12321|:12322|:12323|:12309|:80\b' || true
```
Do not spawn duplicates if an existing process is healthy.

## 3. MariaDB expected local launch shape
At the checkpoint it was running with a command equivalent to:
```bash
"$MDBROOT/bin/mariadbd" \
  --no-defaults --user=root \
  --basedir="$MDBROOT" \
  --datadir="$MDBDATA" \
  --plugin-dir="$MDBROOT/lib/plugin" \
  --bind-address=127.0.0.1 --port=3307 \
  --socket="$SOCK" \
  --pid-file="$LAB/runtime/mariadb.pid" \
  --skip-name-resolve \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_general_ci \
  --log-error="$LAB/logs/mariadb.log"
```
Use local throwaway credentials; do not commit passwords/tokens to the public repository.

## 4. Current first fix
Find the v1.5.4 schema definition/migration for `navigator_styles` and any subsequent missing tables. Apply migrations in version order to the existing `havana` database, then restart Havana Server and continue until startup is clean.

Evidence file showing the blocker:
- `logs/havana-server.err`

## 5. Fix Havana-Web connection
Update the local Web DB port to 3307 and local credentials. Do not use the stale 3306 Docker-era values in the current snapshot.

## 6. Continue client work only after backend is clean
Use local portable Wine under `runtime/wine/`, Xvfb and ffmpeg. GitHub is only a dependency/source bridge. Final video must be produced locally.

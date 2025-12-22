#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RESTART=0
DB_PATH="${SQLITE_PATH:-$ROOT_DIR/data/req2backlog.db}"

for arg in "$@"; do
  case "$arg" in
    --restart) RESTART=1 ;;
    --help|-h)
      echo "Uso: scripts/reset-db.sh [--restart]"
      echo "Borra la base de datos SQLite local (por defecto: data/req2backlog.db)."
      exit 0
      ;;
  esac
done

if [ -f "dev.pid" ]; then
  PID="$(cat dev.pid || true)"
  if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
    echo "Parando dev server (PID=${PID})..."
    kill "${PID}" || true
  fi
  rm -f dev.pid
fi

if [ "${DB_PATH}" = ":memory:" ]; then
  echo "SQLITE_PATH=:memory: no se puede borrar (es en memoria)."
  exit 1
fi

rm -f "${DB_PATH}" "${DB_PATH}-journal" "${DB_PATH}-wal" "${DB_PATH}-shm" 2>/dev/null || true
echo "Base de datos eliminada: ${DB_PATH}"

if [ "${RESTART}" -eq 1 ]; then
  nohup npm run dev > dev.log 2>&1 & echo $! > dev.pid
  echo "Dev server iniciado: http://localhost:3000 (PID=$(cat dev.pid))"
fi


@echo off
setlocal

cd /d "%~dp0\\.."

del /q data\\req2backlog.db 2>nul
del /q data\\req2backlog.db-journal 2>nul
del /q data\\req2backlog.db-wal 2>nul
del /q data\\req2backlog.db-shm 2>nul

echo Base de datos eliminada (data\\req2backlog.db)
endlocal


# Habbo 2009 Dual Client — Linux sandbox checkpoint

Checkpoint date: 2026-09-21
Target: run a single local Havana hotel in the ChatGPT Linux sandbox and record REAL framebuffer gameplay from both historical clients:
- Old Habbo V31 Shockwave
- Habbo Beta / Flash Release39 (`RELEASE39-22643-22891-200911110035_07c3a2a30713fd5bea8a8caf07e33438`)

## Hard requirement
Final validation MUST run inside the local Linux sandbox. GitHub may be used only to fetch source/dependencies or persist state. Do not use GitHub Actions/Windows as the final runtime. Do not claim gameplay PASS without real framebuffer/video evidence from the Linux sandbox.

## Current local state
Workspace: `/mnt/data/habbo_local_lab`

Already present locally:
- Portable Wine 11.17 AMD64/WoW64 under `runtime/wine/`
- Portable MariaDB 11.5.2 x64 Linux under `runtime/mariadb-x64/linux/`
- MariaDB datadir under `runtime/mariadb-data/`
- Havana v1.5.4 binaries under `runtime/havana/Havana/`
- Flash/Shockwave projectors under `runtime/projectors/`
- Dedicated V31 launcher under `runtime/v31launcher/`
- V31 assets under `deps/v31_bundle/`
- R39 SWF/assets subset under `deps/r39_bundle/`
- Xvfb and ffmpeg are available in the sandbox.

### Processes/listeners observed at checkpoint
- MariaDB process was alive on `127.0.0.1:3307`.
- Havana Server Java process was alive and listening on:
  - RCON `127.0.0.1:12309`
  - MUS `127.0.0.1:12322`
  - Shockwave `127.0.0.1:12321`
  - Flash `127.0.0.1:12323`
- Havana logs show actual local TCP connections reaching 12321/12323 and disconnecting.

### Current blocker
Havana Server initializes far enough to bind all game ports, but then throws because the imported schema is incomplete:

`Table 'havana.navigator_styles' doesn't exist`

The local `Havana/havana.sql` does not contain `navigator_styles`, so the next task is to obtain/apply the matching schema/migration(s) for Havana v1.5.4, or reconstruct the missing table from the v1.5.4 source/schema history.

### Separate Web config issue
The current local `webserver-config.ini` snapshot still points to MySQL `127.0.0.1:3306` with the old Docker-era credentials. The actual local MariaDB is on port `3307`. Fix Web config before retesting Havana-Web.

### MariaDB CLI issue
The bundled `mariadb` CLI currently fails to start due to missing `libncurses.so.5`. The server binary `mariadbd` itself runs correctly. Use a compatible client/library, install/bridge ncurses compatibility, or query through another supported client. Do not replace the working server unnecessarily.

## Validation gate
A final PASS requires all of the following:
1. MariaDB schema complete.
2. Havana-Web stable on local loopback.
3. Havana-Server stable with no fatal schema error.
4. V31 client connects, authenticates `RogerVideo`, and visibly enters a room.
5. R39 client connects, authenticates the same account/world, and visibly enters a room.
6. Xvfb framebuffer is recorded with ffmpeg in THIS Linux sandbox.
7. Inspect captured frames/video before calling it gameplay.

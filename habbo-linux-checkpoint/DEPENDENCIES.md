# Dependency inventory

Do not commit proprietary/large runtime binaries into Git. Rehydrate them into `/mnt/data/habbo_local_lab` when needed and verify with the saved SHA-256 manifest.

Known public project/source references used in this work:
- Havana server: `Quackster/Havana`, v1.5.4
- Dual-client launcher/projectors: `Palsternakka/HabboLauncher`
- Dedicated V31 projector: `hiperesp/Habbo-v31-Projector`, v2.0.0
- V31 modified cast: `hiperesp/Habbo-v31-Projector/dcr/fuse_client.cct`
- Shockwave SPRD reference used during diagnosis: `Webbanditten/kepler-docker`

Local dependency bundle hashes are in `manifests/local-sha256.txt`.

A large MariaDB 11.5.2 x64 Linux package is currently present locally as:
`/mnt/data/habbo_local_lab/deps/mariadb-linux.zip`
It is deliberately not committed to Git due to size. Current extracted server lives under `runtime/mariadb-x64/linux/`.

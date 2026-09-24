# Habbo VPS1 host prerequisites

Captured: 2026-09-24
Host OS at capture: Ubuntu 22.04.5 LTS, x86_64, kernel 5.15.0-25-generic.

## Required host packages / tools

- `docker.io` 29.1.3-0ubuntu3~22.04.2
- `containerd` 2.2.1-0ubuntu1~22.04.2
- Docker Engine reports `29.1.3`
- Docker Compose plugin reports `v2.27.0`
  - active binary: `/usr/local/lib/docker/cli-plugins/docker-compose`
  - size: 63007385 bytes
  - SHA-256: `f3ba3bf1e4ab18e96c2d36526a075a02a78fb5f8e80d3e3ca9c5bf256d81d0a0`
- `python3` package 3.10.6-1~22.04.1; runtime reports Python 3.10.12
- `python3-websockify` 0.10.0+dfsg1-2build1
- `curl` 7.81.0-1ubuntu1.27
- `git` 1:2.34.1-1ubuntu1.17
- `unzip` 6.0-26ubuntu3.2
- `gzip` 1.10-4ubuntu4.2
- `tar` 1.34+dfsg-1ubuntu0.1.22.04.6

## Cloudflare tunnel executable

- cloudflared version 2026.7.3, built 2026-07-23-09:58 UTC
- resolved binary: `/usr/bin/cloudflared`
- size: 39278667 bytes
- SHA-256: `9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17`
- `/usr/local/bin/cloudflared` is a link resolving to `/usr/bin/cloudflared` on the captured host.
- Service unit: `cloudflared-stremio-legacy.service` is included in promoted backups.
- Tunnel config and credential JSON are also included separately with mode 0600.

## Rebuild notes

A fresh host does not need these package builds to be byte-for-byte identical if the functional contracts still pass, except where a hash/digest is explicitly enforced by the deployment validators.
Install Docker + Compose, Python3 + python3-websockify, curl, git, unzip/gzip/tar, and cloudflared before installing the restored systemd units.
The restored Havana application images may be rebuilt from the backed-up offline Git bundle; current production image IDs are recorded in DISASTER_RECOVERY_MANIFEST.md.
MariaDB must use the pinned registry digest recorded there.

After host preparation and restore, run `/srv/habbo/ops/deployment-final-validate.sh` and the external WebKit iPhone smoke.
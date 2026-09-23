# Dependency inventory — final

Do not commit live credentials, SSO tickets, or unnecessary large runtime binaries.

Public project/source references:
- Havana server: `Quackster/Havana`, v1.5.4
- Havana migration used: `tools/migrations/update.1.2.sql`
- Dedicated V31 projector: `hiperesp/Habbo-v31-Projector`
- V31 modified cast: `hiperesp/Habbo-v31-Projector/dcr/fuse_client.cct`
- Launcher/projector reference: `Palsternakka/HabboLauncher`

Final runtime facts:
- V31: PRoot 5.4 filesystem-only + explicit QEMU i386 **9.2.4** + Wine32 5.11.
- QEMU 9.2.4 binary SHA-256: `47851b37911b1c76f1784a807cbb6592efb6166d0a27b39f7447dd0ec7c48384`.
- R39: native Linux Adobe Flash Player x86_64.

Large artifacts remain in ChatGPT Library under `/Habbo 2009 Dual Linux`.
Final closure bundle:
`habbo-2009-dual-linux-FINAL-20260923.zip`
SHA-256:
`38e8175373094130e27202d65aef2be9406dbfcd08e23f3bd87ea95e40afc97f`

The package includes QEMU 9.2.4, final runbooks, sanitized proof logs, V31 framebuffer evidence/video, and a restore script.
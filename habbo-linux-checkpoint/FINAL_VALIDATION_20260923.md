# Final gameplay validation — 2026-09-23

## Verdict

The Habbo 2009 Dual Linux lab has passed the final gameplay gate for both clients.

### R39

Prior validation is retained as PASS:
- native Adobe Flash Player Linux x86_64
- real Havana authentication
- TCP 12323
- `RogerVideo` visible in `RogerVideo Lab`
- click-to-move verified on framebuffer

### V31

Fresh 2026-09-23 validation:
- PRoot 5.4 filesystem-only
- QEMU i386 9.2.4
- Wine32 5.11
- hiperesp V31 launcher
- Havana Shockwave TCP 12321 established
- `RogerVideo` authenticated
- room 1000 `RogerVideo Lab` loaded
- avatar visibly rendered
- two real `WALK` events produced visible displacement

Movement path A:
`8,6 -> 7,7 -> 7,8 -> 7,9 -> 6,10 -> 6,11`

Movement path B:
`7,10 -> 8,9 -> 9,8 -> 10,7 -> 11,6`

## Evidence retained in final Library package

`/Habbo 2009 Dual Linux/habbo-2009-dual-linux-FINAL-20260923.zip`

Package SHA-256:
`38e8175373094130e27202d65aef2be9406dbfcd08e23f3bd87ea95e40afc97f`

Evidence includes:
- authenticated V31 hotel/navigator frame
- room-entry frame
- pre/post movement frames
- movement video
- sanitized server proof log
- restore verification log

## Restore verification

The final restore script was executed against a clean target directory. It successfully:
- verified QEMU 9.2.4
- reconstructed and verified MariaDB archive `6fffce126dda54ecaaa3659e03caa47bf5ff6828936001176f84b6bed9637f5c`
- reconstructed and verified historical WWW archive `877273abddab946849aed3d5d2416185fe175a7207a602890fd08ebe7e376ed0`

No live SSO ticket or database password is stored in Git.
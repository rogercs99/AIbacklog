# GitHub configuration

The project is hosted under `iphone-photo-bridge/` on branch `project/iphone-photo-bridge` inside `rogercs99/AIbacklog`.

## Variables for full bridge diagnostics

Repository variables:

- `WG_PEER_PUBLIC_KEY`
- `WG_ENDPOINT`
- `WG_ADDRESS`
- `WG_ALLOWED_IPS`
- `IPHONE_OVERLAY_IP`
- `IPHONE_DEVICE_ID` (optional initially; diagnostics can auto-select one physical iPhone)
- `APPLE_DEVELOPMENT_TEAM` (optional until signing is enabled)

Repository secret:

- `WG_PRIVATE_KEY`

The diagnostic workflow intentionally runs even when these values are missing so CoreDevice/Bonjour/toolchain state is still reported.

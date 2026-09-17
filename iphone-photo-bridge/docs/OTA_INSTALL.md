# PhotoCleaner signing and OTA install checkpoint

## Verified artifact handoff

The unsigned GitHub Actions artifact was relayed to the VPS through the existing ephemeral GitHub-runner WireGuard path because the chat upload filesystem is not mounted on the VPS and unauthenticated GitHub artifact downloads return HTTP 401.

Verified outer artifact:
- size: 138344 bytes
- SHA-256: `e2fa5863bd14a48012341ebc271547c7d26f2d20205ca8bb6707c0c1ba13cfcd`

Verified inner `PhotoCleaner-unsigned.zip`:
- size: 140024 bytes
- SHA-256: `03e528ffbdd3f6d71aa163cf539f81b7d26a99867863eda7fed52e9417175e8b`

## Bundle identifier correction

The historical unsigned build used `pro.gamemodai.PhotoCleaner`, while the current Personal Team provisioning material is for `com.gamemodai.PhotoCleaner`. The source project was corrected to use the provisioned identifier. Existing unsigned app bundles may be re-signed with zsign's bundle-id override; future builds should already emit the corrected identifier.

## Signing

Signing material remains private under `/var/lib/iphone-bootstrap/` and is never committed. `zsign` signs the `.app` bundle first; the signed bundle is then packaged manually as `Payload/PhotoCleaner.app` in an IPA. Passing a bare `.app` to zsign while also asking it to emit an IPA fails because zsign expects a `Payload/` package structure for IPA output.

Validation completed successfully for the signed IPA:
- `Payload/PhotoCleaner.app` structure
- bundle identifier `com.gamemodai.PhotoCleaner`
- embedded provisioning profile parses correctly
- `application-identifier` matches the bundle identifier
- code-signature load command and CodeDirectory exist
- CMS signature verifies cryptographically
- signing certificate is present in the provisioning profile

The signed IPA is intentionally not committed because it embeds device-specific provisioning material.

## Private OTA bootstrap

The existing HTTPS bootstrap service at `iphone-bootstrap.gamemodai.pro` now serves:
- `/install` — private installation page
- `/manifest.plist` — OTA manifest
- `/PhotoCleaner-signed.ipa` — signed IPA

The externally served IPA SHA-256 is verified against the local signed IPA after deployment. The bootstrap service was backed up before modification.

This OTA route is a device-side experiment for the already registered iPhone. If current iOS rejects legacy manifest-based OTA installation for a Personal Team development build, do not weaken signing or TLS; fall back to another native device-side installation mechanism. Developer Mode is required to run IPA-installed development builds.

## iOS install failure diagnosed on first OTA attempt

The first device-side install reached the manifest and IPA but failed with a generic iOS installation error. VPS logs showed iOS issuing `HEAD` requests to the IPA and receiving HTTP 501 because the bootstrap server only implemented GET. The signed app's generated `Info.plist` also lacked both `CFBundleVersion` and `CFBundleShortVersionString`.

Fixes:
- bootstrap now handles HEAD for the IPA and manifest and returns the real content length;
- project source declares marketing version `1.0.0` and build `1` and explicitly emits the matching Info.plist keys;
- the current IPA was rebuilt from the verified unsigned artifact, patched to version `1.0.0` build `1`, re-signed, and redeployed;
- HTTPS HEAD returns 200 and the remote IPA SHA-256 matches the local signed copy.

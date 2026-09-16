# iPhone Photo Bridge

Private-by-design iOS photo analysis prototype plus GitHub-hosted macOS diagnostics for the eventual iPhone bridge.

## Repository layout

- `PhotoCleaner/` SwiftUI/SwiftData app sources and tests.
- `project.yml` XcodeGen project description.
- `.github/workflows/build.yml` unsigned iOS build on the public Xcode 27 runner.
- `.github/workflows/bridge-diagnostics.yml` CoreDevice/WireGuard diagnostics.
- `.github/workflows/build-and-install.yml` unsigned build always; signed install only when an explicitly authorized signing environment already exists.
- `scripts/` WireGuard/device helpers.

## Safety properties

- Analysis is local to the iPhone.
- The test analyzer requests only locally available PhotoKit resources (`isNetworkAccessAllowed = false`).
- There is no automatic photo deletion.
- GitHub workflows do not request, synthesize, or persist Apple passwords, certificates, provisioning profiles, or private signing keys.

## Current app scope

The current phase indexes the local photo library into SwiftData using the PhotoKit local identifier as its stable key. It stores dates, pixel dimensions, media type/subtype, duration, favourite/hidden state and the PhotoKit source type. Indexing is resumable: already-seen assets are updated in place and `PHPhotoLibraryChangeObserver` triggers another pass when the library changes.

For images whose bytes are already local, the prototype computes two local visual fingerprints:

1. Vision's `VNGenerateImageFeaturePrintRequest` feature print.
2. A compact difference hash (dHash) generated from a small local thumbnail.

Assets requiring an iCloud download are deliberately skipped by the analysis pass for now instead of silently pulling the originals across the network.

## Generate/build locally

```bash
brew install xcodegen
xcodegen generate
xcodebuild \
  -project PhotoCleaner.xcodeproj \
  -scheme PhotoCleaner \
  -configuration Debug \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build
```

## Bridge status

A GitHub-hosted macOS runner can establish ordinary Layer-3 WireGuard connectivity when suitable peer configuration is supplied. That does **not** itself reproduce the local-link discovery environment used by Apple's wireless device support. The diagnostics therefore report tunnel reachability, Bonjour observations and CoreDevice visibility separately instead of treating a successful VPN handshake as proof that an iPhone is pairable/installable.

See `docs/GITHUB_CONFIGURATION.md` and `docs/LIMITATIONS.md`.

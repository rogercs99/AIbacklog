# Limitations

## Wireless iPhone access

A GitHub-hosted macOS runner is not physically attached to the user's iPhone. WireGuard can provide Layer-3 reachability to a VPS or other peer, but Apple's wireless device support also depends on prior pairing and local discovery behaviour. The diagnostics therefore treat these as independent facts:

1. VPN/tunnel configured and reachable.
2. Bonjour `_apple-mobdev2._tcp` observed.
3. CoreDevice can enumerate a physical iPhone.
4. Pairing can be confirmed or attempted.
5. A suitable development signing identity exists for installation.

A pass in one category must not be interpreted as a pass in another.

## Signing

Unsigned builds are the default and require no Apple credentials. A signed device build is intentionally gated on an already-present `Apple Development` identity plus an explicit team identifier. The workflow does not request or manufacture signing credentials.

## Photo privacy

Current analysis operates locally. `PHImageRequestOptions.isNetworkAccessAllowed` is false for prototype feature extraction, so assets that require an iCloud download are skipped instead of being silently fetched.

## Deletion

No production deletion path exists in this phase. Future deletion must use explicit user selection and PhotoKit's system-authorized change request so removed assets go through the platform's normal Recently Deleted behaviour.

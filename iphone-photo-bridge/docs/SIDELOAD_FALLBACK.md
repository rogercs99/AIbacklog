# Sideload fallback

If remote CoreDevice installation remains blocked after WireGuard/Bonjour diagnostics, use a normal sideload path outside GitHub-hosted runners, such as a paired local Mac or another environment that can actually expose the iPhone to Apple's device stack.

The repository keeps signed install automation separate from the unsigned build so build health can be proven independently from Apple's pairing/signing constraints.

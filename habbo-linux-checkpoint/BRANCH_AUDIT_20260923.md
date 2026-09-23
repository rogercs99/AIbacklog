# Branch audit — Habbo 2009 Dual Linux — 2026-09-23

Stable head: `c3af828fcbbbeb97f410f58e2481d3f4a4238f75`.

Release snapshot branch:
`release/habbo-2009-dual-linux-20260923`
is identical to stable (0 ahead / 0 behind).

Temporary/lab branch audit:
- `lab/habbo-deps-20260922`: keep. 16 unique commits; contains dependency/runtime fetch workflows not merged to stable.
- `lab/habbo-flash10-20260922`: keep. 5 unique commits; contains native Flash/QEMU/Wine fetch workflows.
- `tmp-habbo-dependency-fetch`: keep. 22 unique commits; contains Wine dependency-fetch history.
- `tmp-habbo-i386-libs-20260923`: keep. 1 unique commit; contains i386 X11 library workflow.
- `tmp-habbo-dual-video-20260921`: fully absorbed (0 unique commits, 21 behind). It is safe to delete, but no branch-delete action is exposed by the connected GitHub tool, so it is intentionally left untouched.

No branch with sole evidence was deleted.

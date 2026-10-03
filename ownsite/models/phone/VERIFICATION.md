# Phone acceptance — 2026-10-03, corrections

Scope: correct the audited Blender phone, screen refresh, full rotation and hero text layout in `ownsite`.
Authorization: the user's request to build/upload the phone in Blender, followed by the instruction to fix the audited defects.

Integrated base: `1fba391b7bc611296783f985db9a0cd55639ba13`.
Concurrent paper sections, shared catalogue renderer, accessible navigation and motion are preserved.
The local preview exposes nine seeded cases in an in-memory database only; publication flags in production are not modified.

Blender: 5.2.1 LTS. Editable blend and reproducible generator included.
GLB: 370,240 bytes, 41 mesh nodes, root `RT_Phone` and separate `Screen`.
GLB SHA-256: `7e4e6a663cd6f69146413c3bb509b4ad91262f6be1af033fedbc61ae28c0ddb1`.
Committed self-hosted browser bundle: 577,992 bytes, Three.js 0.180.0, MIT license included.
Bundle SHA-256: `8d130eb4aadc5a21c64753244a60f45da42e62b84c5f6269c31274905d4b1f47`.

| Check | Actual result |
| --- | --- |
| Blender model | Camera and earpiece moved outside screen; exact Boolean recesses for USB-C and eight speaker holes; inspected in Blender |
| Independent Three GLTFLoader geometry | Screen Y max 3.575; front camera ring Y min 3.602, gap 0.027; lens and earpiece also clear |
| Independent raycast of recesses | USB back Y -3.616; speaker back Y -3.676; control chassis surface Y -3.750 |
| Heading fit | Nine cases at 320, 390, 1024 and 1440 px; no heading or document horizontal overflow in 36 checks after integration |
| Readability | Tablet/mobile text sits on light paper; dark tear is confined to phone stage; screenshots inspected |
| Real browser rotation | Rear visible, front hidden and inert; rear grip drag changes pose; reset restores front |
| Real browser live screen | YCS loaded; menu opened inside iframe; menu remained open after rear rotation and reset |
| CSS fallback | Model request blocked locally; activation and iframe menu clicks worked; temporary block removed |
| Shared catalogue integration | Paper card selects correct case/reveal mode, portrait orientation and selected ticket; original motion retained |
| Screen regression tests | Nine scenarios execute real app functions and current registry/motion: metadata, poster, URL, embedding revocation, no-live, stale images, empty catalogue, stale response, full turn |
| Full regression suite | `node --test`: 43 pass, 0 fail, 1 skip |
| Skipped test | Cross-repository PostgreSQL/Tg-mcp integration needs `TG_MCP_DIRECTORY`; unavailable in this checkout |
| Diff whitespace | `git diff --check` passed |

Screen state is tracked separately from catalogue records. URL or embed-policy changes revoke the old iframe; metadata/poster-only changes preserve it. Empty catalogues clear the live screen. Request generations discard stale image and API responses.

The HTML screen remains interactive in WebGL and CSS modes. Same-camera projection and screen metrics remain unchanged. Existing server allowlists and published/hidden poster authorization are preserved. The Dockerfile already copies the bundle and model.

This file records local acceptance. GitHub tree/ref readback and production byte/render checks are separate evidence; they are performed after publication.

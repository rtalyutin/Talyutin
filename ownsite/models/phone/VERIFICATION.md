# Phone acceptance — 2026-10-03

Scope: a Blender phone asset integrated into the existing portfolio in `ownsite`.
Authorization: the user's request to build the phone in Blender and upload it to
`rtalyutin/Talyutin`. The existing HTML screen, case data and external actions are preserved.

Base: `13df38160deb45b3781167b2131983f61738765a` (including concurrent project captions).
Blender: 5.2.1 LTS. GLB SHA-256:
`1b5687caf3f87310526a1e0a352cf0454e7df694f7a641e6b675a6f6c26b5de1`.
The editable blend and generator are included. GLB: 310,896 bytes.
Browser bundle: 577,828 bytes, self-hosted; Three.js 0.180.0, MIT license included.

| Check | Actual result |
| --- | --- |
| Blender studio front/rear renders | Inspected; phone body, glass, buttons, camera cluster visible |
| Independent Three GLTFLoader + Box3 check | 41 meshes; body 3.6 × 7.5; screen 3.33 × 7.15, front Z .228; no exported cube/lights/camera |
| Desktop landscape, real browser | Model status ready; screen aligned with body; rotation controls work |
| Live YCS screen | iframe loaded; the site's menu was opened inside the phone |
| Mobile 390 × 844 | No horizontal document overflow; phone and controls visible |
| Mobile live-screen click | CDP Page.windowOpen: correct YCS URL, userGesture true, target _blank; no embedded iframe |
| Portrait desktop | Synthetic orientation fixture in an in-memory local DB; no screen-button/arrow overlap after sizing correction |
| GLB load failure | Request blocked locally; CSS fallback shown and live-screen button available; block removed |
| WebGL context loss | Actual WEBGL_lose_context extension; CSS body and rotation continue to work |
| iframe state protection | Independent source review: no DOM reparenting on context loss; pre-opened iframe keeps CSS fallback during model load |
| Regression suite | node --test: 24 pass, 0 fail, 1 skip |
| Skipped test | Cross-repository PostgreSQL/Tg-mcp integration requires TG_MCP_DIRECTORY; not covered by this asset change |
| Diff whitespace | git diff --check passed |

The existing Tochki test fixture expected unpacked PNGs missing from a clean checkout.
Its assertion now compares served original bytes with the recorded original size/SHA-256
from the existing packed-asset manifest. No game code or game assets were changed.

Server changes are limited to global GLB/viewer allowlisted paths, GLB MIME and a
cross-platform static-file containment check. Published/hidden poster authorization stays intact.
The Dockerfile already copies `public`, so the committed bundle and GLB ship with the existing image.

This report confirms local acceptance. Git upload and production deployment require their
own readback; a local render or test pass is not evidence of a deployed site.

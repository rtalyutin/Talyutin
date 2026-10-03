# RT phone — Blender / web

Original unbranded graphite phone authored in Blender 5.2.1 LTS for the portfolio.
No downloaded models, external textures, logos or font dependencies.

- Editable scene: `rt-phone.blend`.
- Reproducible source: `build_phone.py`. Run from a fresh Blender file:
  `p = "/absolute/path/build_phone.py"; exec(compile(open(p).read(), p, "exec"), {"__file__": p})`.
- Browser asset: `../../public/assets/rt-phone.glb`, about 304 KiB.
- Export only the active scene's selected phone objects. Studio lights/camera and the default cube are excluded.
- Coordinates in GLB: X right, Y up, front +Z. Body 3.6 × 7.5 × 0.36.
  Root `RT_Phone` extras define the HTML screen: 3.33 × 7.15, Z .228, corner radius .28.
  `Screen` is a standalone mesh and is hidden in the viewer to reveal the real HTML screen.

## Web integration

`../../client/phone-viewer.js` uses Three.js GLTFLoader and CSS3DRenderer with one camera
and one pose. The existing HTML poster/button/iframe stay interactive.
Portrait and landscape use the original case orientation. The content counter-rotates
in landscape. Existing drag, arrows, reset, mobile links and reduced motion are preserved.

The dependency and asset are served from this site; no CDN or third-party 3D API is required.
`npm run build:phone` (in ownsite) regenerates the committed `public/phone-viewer.js` bundle.
The existing Dockerfile copies it and the GLB as public assets. No container build step is added.

If GLB or WebGL fails, the CSS phone and live screen continue to work. If the user
opens an iframe while GLB is loading, the CSS version is retained for that page load,
so the live screen is not reparented. Context loss retains the CSS3D DOM parent and
shows the CSS body, preserving the iframe state.

Local acceptance and deployment status are recorded in `VERIFICATION.md`.

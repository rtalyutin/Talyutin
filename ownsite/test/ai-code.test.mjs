import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { createHandler } from "../server.mjs";
import { phase, motion } from "../public/ai-code/motion/config.js";
import { gazeTarget } from "../public/ai-code/motion/cat-gaze.js";
import {
  catSvg,
  catGlyphs,
  glyphAlphabet,
  createCatModel,
  transformPoint,
  projectPoint,
} from "../public/ai-code/motion/cat-model.js";

test("AI-code serves all assets under existing CSP without the portfolio backend and restricts paths", async (t) => {
  let calls = 0;
  const unavailable = async () => {
    calls++;
    throw new Error("offline");
  };
  const server = createServer(
    createHandler({ publicWorks: unavailable, publicContacts: unavailable }),
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(base + "/ai-code");
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.equal((html.match(/<section /g) || []).length, 6);
  assert.match(html, /href="#process"/);
  assert.match(html, /href="https:\/\/t.me\/evieer"/);
  assert.doesNotMatch(
    page.headers.get("content-security-policy"),
    /unsafe-inline|unsafe-eval/,
  );
  assert.match(html, /src="\/ai-code\/cat-static.svg" width="640" height="590" alt=""/);
  assert.equal(readFileSync(new URL("../public/ai-code/cat-static.svg", import.meta.url), "utf8"), catSvg(), "static cat matches animation model");
  for (const file of [
    "styles.css",
    "boot.js",
    "main.js",
    "events.js",
    "motion/studio.js",
    "rain.svg",
    "cat-static.svg",
    "motion/config.js",
    "motion/cat-gaze.js",
    "motion/cat-model.js",
    "motion/cat-volume.js",
    "motion/glyph-renderer.js",
    "motion/sections.js",
  ]) {
    const result = await fetch(base + "/ai-code/" + file);
    assert.equal(result.status, 200, file);
    assert.equal(
      await result.text(),
      readFileSync(
        new URL("../public/ai-code/" + file, import.meta.url),
        "utf8",
      ),
    );
  }
  const compressed = await fetch(base + "/ai-code", { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(compressed.headers.get("content-encoding"), "gzip");
  assert.equal(compressed.headers.get("vary"), "Accept-Encoding");
  assert.equal(await compressed.text(), html);
  const uncompressed = await fetch(base + "/ai-code", { headers: { "Accept-Encoding": "gzip;q=0" } });
  assert.equal(uncompressed.headers.get("content-encoding"), null);
  assert.equal(await uncompressed.text(), html);
  const preview = await fetch(base + "/ai-code/social-preview.png");
  assert.equal(preview.status, 200);
  assert.deepEqual(Buffer.from(await preview.arrayBuffer()), readFileSync(new URL("../public/ai-code/social-preview.png", import.meta.url)));
  const font = await fetch(base + "/ai-code/fonts/onest-latin-cyrillic.woff2");
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
  assert.deepEqual(Buffer.from(await font.arrayBuffer()), readFileSync(new URL("../public/ai-code/fonts/onest-latin-cyrillic.woff2", import.meta.url)));
  for (const path of ["/ai-code/", "/ai-code/index.html"]) {
    const r = await fetch(base + path, { redirect: "manual" });
    assert.equal(r.status, 308);
    assert.equal(r.headers.get("location"), "/ai-code");
  }
  for (const path of [
    "/ai-code/missing",
    "/ai-code/server.mjs",
    "/ai-code/%2e%2e/server.mjs",
  ])
    assert.equal((await fetch(base + path)).status, 404);
  assert.equal(
    (await fetch(base + "/ai-code", { method: "POST" })).status,
    405,
  );
  assert.equal(calls, 0);
});
test("hero and subsequent assemblies transition at configured boundaries", () => {
  for (const hero of [true, false]) {
    const rain = hero ? motion.heroRain : motion.rain,
      assemble = hero ? motion.heroAssemble : motion.assemble;
    assert.equal(phase(0, hero).state, "rain");
    assert.equal(phase(rain, hero).state, "assemble");
    assert.equal(phase(rain + assemble / 2, hero).progress, 0.5);
    assert.deepEqual(phase(rain + assemble, hero), {
      state: "ready",
      progress: 1,
    });
  }
});
test("gaze stays within eyes and returns to neutral without a pointer", () => {
  const rect = { left: 100, top: 100, width: 640, height: 590 };
  for (const x of [-1e6, 0, 420, 1e6])
    for (const y of [-1e6, 0, 395, 1e6]) {
      const target = gazeTarget({ x, y }, rect);
      assert.ok(Math.abs(target.x) <= motion.gazeLimitX);
      assert.ok(Math.abs(target.y) <= motion.gazeLimitY);
    }
  assert.deepEqual(gazeTarget(null, rect), { x: 0, y: 0 });
  assert.deepEqual(gazeTarget({ x: 420, y: 395 }, rect), { x: 0, y: 0 });
});

test("cat is a depth-bearing triangle mesh with surface-attached ASCII and transparent material", () => {
  const model = createCatModel();
  assert.equal(model.material.opacity, 0);
  assert.equal(model.material.transparent, true);
  assert.ok(model.triangles.length > 3000);
  assert.ok(model.glyphs.length > 3000);
  const z = model.triangles.flatMap((t) => t.vertices.map((v) => v.p[2]));
  assert.ok(Math.max(...z) - Math.min(...z) > 1);
  assert.ok(model.triangles.some((t) => t.part === "ear"));
  assert.ok(model.glyphs.some((p) => p.part === "pupil"));
  const original = [0.8, 0.2, 0.5],
    rotated = transformPoint(original, 0.2, 0);
  assert.notEqual(projectPoint(original).x, projectPoint(rotated).x);
  assert.ok(Math.abs(Math.hypot(...original) - Math.hypot(...rotated)) < 1e-10);
});

// Catch invalid normals / runaway geometry before it reaches the GPU, and keep
// the complete silhouette within its canvas through the allowed pointer range.
test("cat geometry stays finite, bounded and visible through its motion range", () => {
  const model = createCatModel();
  assert.ok(model.triangles.length < 30000);
  assert.ok(model.glyphs.length < 16000);
  for (const g of model.glyphs) {
    assert.ok([...g.position, ...g.normal, g.size].every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...g.normal) - 1) < 1e-8);
    assert.ok(glyphAlphabet.includes(g.char));
    for (const yaw of [-0.18, 0, 0.18]) for (const pitch of [-0.084, 0.084]) {
      const p = projectPoint(transformPoint(g.position, yaw, pitch));
      assert.ok(p.x >= 0 && p.x <= 640 && p.y >= 0 && p.y <= 590, `clipped ${g.part}`);
    }
  }
  const visible = catGlyphs();
  for (const part of ["pupil", "iris", "nose", "innerEar", "whisker"])
    assert.ok(visible.some(g => g.part === part), `${part} survives depth occlusion`);
  assert.ok(visible.every(g => g.matrix.every(Number.isFinite)));
});

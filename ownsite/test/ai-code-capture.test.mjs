import test from "node:test";
import assert from "node:assert/strict";
import { createGlyphRenderer } from "../public/ai-code/motion/glyph-renderer.js";
import { captureProgress, motion } from "../public/ai-code/motion/config.js";

test("falling columns capture upper rows first and finish every target before the handoff", () => {
  for (let x = 0; x < 1600; x += 7) {
    const times = [0, 100, 400, 800].map((y) => captureProgress(x, y, 800));
    assert.ok(times.every((t) => t > 0 && t < 1));
    assert.ok(times.every((t, i) => !i || t > times[i - 1]));
  }
});

test("captured letters stay at their exact final positions, are cached once, and rain never fades during assembly", (t) => {
  const names = ["document", "devicePixelRatio", "innerWidth", "innerHeight"];
  const saved = new Map(
    names.map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  t.after(() => {
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  });
  const contexts = [];
  function context() {
    const result = {
      globalAlpha: 1,
      letters: [],
      images: [],
      save() {},
      restore() {},
      beginPath() {},
      rect() {},
      clip() {},
      scale() {},
      setTransform() {},
      clearRect() {},
      fillText(char, x, y) {
        this.letters.push({ char, x, y, alpha: this.globalAlpha });
      },
      drawImage(...args) {
        this.images.push(args);
      },
    };
    contexts.push(result);
    return result;
  }
  const ink = context();
  Object.assign(globalThis, {
    innerWidth: 800,
    innerHeight: 800,
    devicePixelRatio: 1,
    document: {
      createElement() {
        const sheet = { width: 0, height: 0 };
        const pen = context();
        sheet.getContext = () => pen;
        return sheet;
      },
    },
  });
  const renderer = createGlyphRenderer({ getContext: () => ink });
  const section = {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 800 }),
  };
  const targets = Array.from({ length: 4000 }, (_, i) => ({
    x: (i % 80) * 10,
    y: Math.floor(i / 80) * 14,
    char: "A",
    size: 12,
    color: "#064509",
    captureAt: captureProgress((i % 80) * 10, Math.floor(i / 80) * 14, 800),
  })).sort((a, b) => a.captureAt - b.captureAt);
  renderer.draw(section, targets, "rain", 0, 500);
  assert.equal(contexts.length, 1);
  ink.letters = [];
  renderer.draw(section, targets, "assemble", 0.25, 500);
  const pen = contexts[1],
    captured = pen.letters.length;
  assert.ok(captured > 0 && captured < 4000);
  assert.deepEqual(
    pen.letters.map((p) => [p.char, p.x, p.y]),
    targets.slice(0, captured).map((p) => [p.char, p.x, p.y]),
  );
  const maxEarly = Math.max(...ink.letters.map((p) => p.alpha));
  ink.letters = [];
  renderer.draw(section, targets, "assemble", 0.999, 600);
  assert.equal(
    pen.letters.length,
    4000,
    "no targets are discarded to meet a particle cap",
  );
  assert.deepEqual(
    pen.letters.map((p) => [p.char, p.x, p.y]),
    targets.map((p) => [p.char, p.x, p.y]),
  );
  assert.equal(Math.max(...ink.letters.map((p) => p.alpha)), maxEarly);
  assert.equal(maxEarly, motion.rainOpacity);
  renderer.draw(section, targets, "assemble", 1, 700);
  assert.equal(
    pen.letters.length,
    4000,
    "settled glyphs are never moved, scrambled or drawn twice",
  );
  renderer.release(section);
  renderer.draw(section, targets, "assemble", 1, 800);
  assert.equal(contexts.length, 3, "finished section cache can be released");
});

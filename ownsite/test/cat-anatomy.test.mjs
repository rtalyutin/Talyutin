import test from 'node:test';
import assert from 'node:assert/strict';
import { createCatModel, catGlyphs, eyes } from '../public/ai-code/motion/cat-model.js';

// The earlier portrait passed a mere "some pupil glyphs survive" assertion but
// had only 19 pupil and 41 iris glyphs across both eyes, leaving them hollow.
test('both eyes retain readable pupils, irises and highlights after depth occlusion', () => {
  const visible = catGlyphs();
  for (const side of [-1, 1]) {
    const eye = visible.filter(g => Math.sign(g.x - 320) === side);
    const pupils = eye.filter(g => g.part === 'pupil');
    const irises = eye.filter(g => g.part === 'iris');
    assert.ok(pupils.length >= 16, `eye ${side}: pupil has only ${pupils.length} visible glyphs`);
    assert.ok(irises.length >= 32, `eye ${side}: iris has only ${irises.length} visible glyphs`);
    assert.ok(eye.some(g => g.part === 'glint'), `eye ${side}: highlight was lost or only writes depth`);
    // A line of stray samples must not count as a complete eye.
    for (const [name, points] of [['pupil', pupils], ['iris', irises]]) {
      assert.ok(Math.max(...points.map(g => g.x)) - Math.min(...points.map(g => g.x)) > 3, `${name} has no visible width`);
      assert.ok(Math.max(...points.map(g => g.y)) - Math.min(...points.map(g => g.y)) > 10, `${name} has no visible height`);
    }
  }
});

test('readable text tangents do not replace the curved surface lighting normals', () => {
  const model = createCatModel();
  const head = model.glyphs.filter(g => g.part === 'head');
  assert.ok(head.some(g => g.normal[0] < -.3), 'left side of head lost its surface normals');
  assert.ok(head.some(g => g.normal[0] > .3), 'right side of head lost its surface normals');
  assert.ok(head.some(g => Math.abs(g.normal[1]) > .3), 'forehead and jaw lost their curvature');
  for (const glyph of model.glyphs) {
    for (const normal of [glyph.normal, glyph.tangentNormal].filter(Boolean)) {
      assert.equal(normal.length, 3);
      assert.ok(normal.every(Number.isFinite));
      assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-8, 'non-unit normal distorts glyphs or lighting');
    }
  }
});

test('the lower jaw remains close to the muzzle instead of forming a long beard', () => {
  const model = createCatModel();
  const jaw = model.triangles.filter(t => ['head', 'chin'].includes(t.part));
  const bottom = Math.min(...jaw.flatMap(t => t.vertices.map(v => v.p[1])));
  const mouth = model.glyphs.filter(g => g.part === 'mouth');
  assert.ok(mouth.length > 0);
  const mouthBottom = Math.min(...mouth.map(g => g.position[1]));
  const eyeSeparation = Math.abs(eyes[1].x - eyes[0].x);
  assert.ok(mouthBottom > bottom, 'jaw must extend beneath the mouth');
  assert.ok((mouthBottom - bottom) / eyeSeparation < .6, 'empty lower face is too long relative to the eye spacing');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createHandler } from '../server.mjs';

test('Tochki serves complete runtime independently of portfolio DB and blocks private paths', async () => {
  const server = createServer(createHandler({ async publicWorks() { throw new Error('unavailable'); } }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const redirect = await fetch(origin + '/tochki', { redirect: 'manual' });
    assert.equal(redirect.status, 308); assert.equal(redirect.headers.get('location'), '/tochki/');
    const html = await fetch(origin + '/tochki/');
    assert.equal(html.status, 200); assert.match(html.headers.get('content-type'), /text\/html/);
    assert.match(await html.text(), /id="board"/);
    for (const file of ['app.js', 'worker.js', 'core.js', 'bot.js', 'capture.js']) {
      const response = await fetch(origin + '/tochki/' + file);
      assert.equal(response.status, 200, file); assert.match(response.headers.get('content-type'), /text\/javascript/);
      assert.equal(await response.text(), readFileSync(new URL('../public/tochki/' + file, import.meta.url), 'utf8'));
    }
    const css = await fetch(origin + '/tochki/game.css');
    assert.equal(css.status, 200); assert.match(css.headers.get('content-type'), /text\/css/);
    for (const file of ['board-paper.png', 'background-desktop.png', 'background-mobile.png', 'captured-zone-red.png', 'captured-zone-blue.png']) {
      const response = await fetch(origin + '/tochki/assets/' + file);
      assert.equal(response.status, 200, file); assert.match(response.headers.get('content-type'), /image\/png/);
      const bytes = Buffer.from(await response.arrayBuffer());
      const packed = JSON.parse(readFileSync(new URL('../public/tochki/assets/packed-assets.json', import.meta.url), 'utf8'))[file];
      // Packed source PNGs are intentionally absent from a clean checkout.
      // Verify against their recorded original digest, independent of reconstruction.
      if (packed) {
        assert.equal(bytes.length, packed.size);
        assert.equal(createHash('sha256').update(bytes).digest('hex'), packed.sha256);
      } else {
        assert.deepEqual(bytes, readFileSync(new URL('../public/tochki/assets/' + file, import.meta.url)));
      }
    }
    for (const path of ['/tochki/core.test.js', '/tochki/bot.test.js', '/tochki/package.json', '/tochki/README.md', '/tochki/assets/unknown.png', '/tochki/assets/packed-assets.json', '/tochki/assets/board-paper.part-000.b64', '/tochki/%2e%2e/server.mjs']) {
      assert.equal((await fetch(origin + path)).status, 404, path);
    }
    assert.equal((await fetch(origin + '/tochki/', { method: 'POST' })).status, 405);
    assert.equal((await fetch(origin + '/api/works')).status, 503);
    assert.equal((await fetch(origin + '/healthz')).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createHandler } from '../server.mjs';
import { openDatabase } from '../db.mjs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('CSS surname homepage has accessible content and only a noscript analytics image', () => {
  assert.match(html, /class="skip" href="#main"/);
  assert.match(html, /<main id="main" tabindex="-1">/);
  assert.match(html, /aria-label="ТАЛЮТИН"/);
  assert.doesNotMatch(html.replace(/<noscript>[\s\S]*?<\/noscript>/g, ''), /<(form|input|textarea|select|img|svg|canvas|style)\b/i);
  assert.match(html, /<noscript><div hidden><img src="https:\/\/mc\.yandex\.ru\/watch\/113739633" alt=""><\/div><\/noscript>/);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)|\sstyle=|\son\w+=|preview-chip/i);
  assert.doesNotMatch(css, /url\(|@import/i);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /scroll-behavior:auto/);
  assert.match(css, /animation:none!important;transition:none!important/);
});

test('homepage serves its modules under strict CSP, drops phone routes and keeps deep links', async t => {
  const db = openDatabase(':memory:');
  const server = createServer(createHandler(db));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(origin + '/?work=dashboard&mode=reveal');
  const page = await response.text();
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy'), /script-src 'self' https:\/\/mc\.yandex\.ru /);
  assert.doesNotMatch(response.headers.get('content-security-policy'), /unsafe-inline|unsafe-eval/);
  assert.match(page, /id="selected-case-title">Dashboard/);
  assert.match(page, /Публичная демо-проекция работает/);
  assert.doesNotMatch(page, /\{\{[A-Z_]+\}\}|phone-viewer|МАКЕТ \/ HTML/);
  for (const asset of ['/app.js', '/registry.js', '/motion.js', '/metrika.js', '/styles.css', '/tool.html']) {
    assert.equal((await fetch(origin + asset)).status, 200, asset);
  }
  for (const asset of ['/phone-viewer.js', '/phone-viewer.js.LEGAL.txt', '/assets/rt-phone.glb', '/assets/torn-paper.jpg']) {
    assert.equal((await fetch(origin + asset)).status, 404, asset);
  }
});

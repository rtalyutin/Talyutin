import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHandler } from '../server.mjs';

test('PHP2Shell landing and its assets work without the portfolio backend under the existing CSP', async t => {
  let backendCalls = 0;
  const unavailable = async () => { backendCalls++; throw new Error('upstream unavailable'); };
  const server = createServer(createHandler({ publicWorks: unavailable, publicContacts: unavailable }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(origin + '/php2shell');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.equal(html, readFileSync(new URL('../public/php2shell/index.html', import.meta.url), 'utf8'));
  assert.match(page.headers.get('content-type'), /text\/html/);
  const csp = page.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /style-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-inline|unsafe-eval/);
  assert.doesNotMatch(html, /<style[\s>]|\sstyle=|<script(?![^>]*\bsrc=)/i);
  for (const [file, type] of [['styles.css', 'text/css'], ['app.js', 'text/javascript']]) {
    const response = await fetch(origin + '/php2shell/' + file);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('content-type').startsWith(type));
    assert.equal(await response.text(), readFileSync(new URL('../public/php2shell/' + file, import.meta.url), 'utf8'));
  }
  assert.equal(backendCalls, 0);
  for (const path of ['/php2shell/', '/php2shell/index.html']) {
    const response = await fetch(origin + path, { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), '/php2shell');
  }
  for (const path of ['/php2shell/missing', '/php2shell/server.mjs', '/php2shell/../server.mjs']) {
    assert.equal((await fetch(origin + path)).status, 404);
  }
  assert.equal((await fetch(origin + '/php2shell', { method: 'POST', body: 'site=example.ru' })).status, 405);
  assert.equal((await fetch(origin + '/php2shell', { method: 'HEAD' })).status, 200);
  assert.equal((await fetch(origin + '/healthz')).status, 200);
  const home = await fetch(origin + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /ТАЛЮТИН/);
  assert.equal((await fetch(origin + '/readyz')).status, 503);
});

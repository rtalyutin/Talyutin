import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDatabase, publicWorks } from '../db.mjs';
import { openRemotePortfolio } from '../remote-db.mjs';
import { createHandler, openConfiguredPortfolio } from '../server.mjs';

function fixture() {
  const db = openDatabase(':memory:');
  try { return publicWorks(db); } finally { db.close(); }
}
const response = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });

test('remote API preserves two cards and SSR, same-origin JSON and contacts', async t => {
  const rows = fixture(); const requests = [];
  const remote = openRemotePortfolio('https://api.example.test/ownsite', { fetchImpl: async (url, options) => {
    requests.push([url, options]);
    if (url.endsWith('/api/contacts')) return response([{ label: 'Позвонить', href: 'tel:+79065253445' }, { label: 'Написать письмо', href: 'mailto:info@yarcyberseason.ru' }]);
    if (url.endsWith('/api/works/stories')) return new Response('{}', { status: 404 });
    if (url.endsWith('/api/works/dashboard')) return response(rows[1]);
    return response(rows);
  } });
  const server = createServer(createHandler(remote));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const page = await fetch(url + '/?work=dashboard&mode=reveal');
  assert.equal(page.status, 200);
  const html = await page.text();
  assert.match(html, /Открыть в новой вкладке/);
  assert.match(html, /tel:\+79065253445/);
  assert.match(html, /mailto:info@yarcyberseason.ru/);
  assert.doesNotMatch(html, /\{\{TITLE\}\}|api\.example\.test/);
  assert.deepEqual((await (await fetch(url + '/api/works')).json()).map(row => row.slug), ['ycs', 'dashboard']);
  assert.equal((await fetch(url + '/api/works/stories')).status, 404);
  assert.equal((await fetch(url + '/readyz')).status, 200);
  assert.ok(requests.every(([, opts]) => opts.redirect === 'error' && !opts.headers.authorization));
});

test('remote endpoint rejects insecure or secret-bearing origins; required mode cannot fall back to local seed', async () => {
  for (const url of ['http://api.example.test/ownsite', 'https://user:pass@api.example.test/ownsite', 'https://api.example.test/ownsite?login=secret', 'https://api.example.test/mcp', 'https://api.example.test/ownsite#fragment']) {
    assert.throws(() => openRemotePortfolio(url), /unavailable/);
  }
  await assert.rejects(openConfiguredPortfolio({ REQUIRE_PORTFOLIO_API_URL: '1', DATABASE_URL: 'postgres://unused' }), /PORTFOLIO_API_URL/);
  await assert.rejects(openConfiguredPortfolio({ NODE_ENV: 'production', PORTFOLIO_API_URL: 'http://127.0.0.1/ownsite' }), /unavailable/);
});

test('malformed public response, private fields and executable links fail closed', async () => {
  for (const mutate of [row => { row.show = true; }, row => { row.internal_notes = 'PRIVATE'; }, row => { row.links = [{ label: 'unsafe', href: 'javascript:alert(1)' }]; }, row => { row.liveUrl = 'http://insecure.example'; }, row => { row.poster = '/assets/../secrets'; }, row => { row.embedAllowed = 'true'; }]) {
    const rows = fixture(); mutate(rows[0]);
    const remote = openRemotePortfolio('https://api.example.test/ownsite', { fetchImpl: async () => response(rows) });
    await assert.rejects(remote.publicWorks(), /unavailable/);
  }
});

test('failed upstream shows three approved projects while data routes report 503', async t => {
  const remote = openRemotePortfolio('https://api.example.test/ownsite', { fetchImpl: async () => new Response('SECRET CONNECTION URL', { status: 503 }) });
  const server = createServer(createHandler(remote));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  for (const path of ['/api/works', '/api/works/ycs', '/readyz']) {
    const result = await fetch(url + path);
    assert.equal(result.status, 503); assert.equal(await result.text(), 'Service unavailable');
  }
  assert.equal((await fetch(url + '/healthz')).status, 200);
  for (const path of ['/', '/index.html', '/?work=ycs&mode=reveal']) {
    const page = await fetch(url + path);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const html = await page.text();
    for (const marker of ['ТАЛЮТИН', 'id="approach"', 'id="contact"', '/motion.js', 'mailto:info@yarcyberseason.ru', 'tel:+79065253445', 'https://vk.com/talyutin']) assert.ok(html.includes(marker), marker);
    assert.match(html, /Избранные проекты: 3/);
    assert.match(html, /<template id="works-data" data-unavailable="true">/);
    assert.deepEqual([...html.matchAll(/data-project="([^"]+)"/g)].map(match => match[1]), ['ycs', 'booking', 'tochki']);
    assert.equal(html.includes('id="selected-case"'), path.includes('work=ycs'));
    assert.doesNotMatch(html, /SECRET CONNECTION|api\.example\.test|Service unavailable|\{\{[A-Z_]+\}\}/);
  }
  for (const [slug, target] of [['ycs', 'https://yarcyberseason.ru/'], ['booking', 'https://talyutin.online/'], ['tochki', '/tochki/']]) {
    const html = await (await fetch(url + '/?work=' + slug)).text();
    assert.ok(html.includes(`href="${target}"`));
  }
  assert.equal((await fetch(url + '/offline-works.js')).status, 200);
});

test('homepage isolates dependency failures, recovers and respects successful empty responses', async t => {
  const rows = fixture();
  const contacts = [{ label: 'Связаться', href: 'mailto:current@example.test' }];
  let state;
  const remote = openRemotePortfolio('https://api.example.test/ownsite', { fetchImpl: async url => {
    const result = url.endsWith('/api/contacts') ? state.contacts : state.works;
    return result === null ? new Response('upstream failed', { status: 503 }) : response(result);
  } });
  const server = createServer(createHandler(remote));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  // Same running server: recovery must use current public data, without a restart or stale cache.
  for (state of [
    { works: null, contacts: null },
    { works: null, contacts },
    { works: rows, contacts: null },
    { works: rows, contacts },
    { works: [], contacts: [] }
  ]) {
    const page = await fetch(url);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.equal(html.includes('data-unavailable="true"'), state.works === null);
    assert.equal(html.includes('Избранные проекты: 3'), state.works === null);
    assert.equal(html.includes('class="project"'), state.works === null || Boolean(state.works?.length));
    assert.equal(html.includes('mailto:current@example.test'), Boolean(state.contacts?.length));
    assert.equal(html.includes('mailto:info@yarcyberseason.ru'), state.contacts === null);
    if (state.works?.length === 0) assert.match(html, /Работы скоро появятся/);
    if (state.contacts?.length === 0) assert.match(html, /Контакты скоро появятся/);
  }
});

test('streamed response size and timeout bounds are enforced', async () => {
  const oversized = openRemotePortfolio('https://api.example.test/ownsite', {
    maxBytes: 20, fetchImpl: async () => new Response(new ReadableStream({ start(controller) {
      controller.enqueue(new TextEncoder().encode('["0123456789'));
      controller.enqueue(new TextEncoder().encode('01234567890123456789"]')); controller.close();
    } }), { headers: { 'content-type': 'application/json' } })
  });
  await assert.rejects(oversized.publicWorks(), /unavailable/);
  const timeout = openRemotePortfolio('https://api.example.test/ownsite', { timeoutMs: 20,
    fetchImpl: async (_url, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('secret upstream')), { once: true })) });
  await assert.rejects(timeout.publicWorks(), /unavailable/);
});

test('direct lookup checks slug identity, contacts only accept supported public channels', async () => {
  const remote = openRemotePortfolio('https://api.example.test/ownsite', { fetchImpl: async url => url.endsWith('/contacts')
    ? response([{ label: 'unsafe', href: 'https://private.example/secret' }]) : response(fixture()[0]) });
  await assert.rejects(remote.publicWork('dashboard'), /unavailable/);
  assert.equal(await remote.publicWork('../mcp'), null);
  await assert.rejects(remote.publicContacts(), /unavailable/);
});

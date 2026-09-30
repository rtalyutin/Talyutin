import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDatabase, publicWorks, publicWork } from '../db.mjs';
import { createHandler } from '../server.mjs';

async function withServer(db, run) {
  const server = createServer(createHandler(db));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try { await run(origin); }
  finally { await new Promise(resolve => server.close(resolve)); db.close(); }
}

test('current content revision publishes only verified YCS and Dashboard cases', () => {
  const db = openDatabase(':memory:');
  try {
    const works = publicWorks(db);
    assert.deepEqual(works.map(work => work.slug), ['ycs', 'dashboard']);
    assert.equal(works[0].links.length, 2);
    assert.equal(works[0].embedAllowed, true);
    assert.equal(works[1].featuredOrder, null);
    assert.equal(works[1].embedAllowed, false);
    assert.equal(works[1].liveUrl, 'https://rtalyutin-tg-mcp-8179.twc1.net/dashboard/');
    assert.equal(publicWork(db, 'stories'), null);
    assert.equal(publicWork(db, 'tochki'), null);
    assert.equal(publicWork(db, 'ycs-miniapp'), null);
    assert.equal(publicWork(db, 'ycs-site'), null);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM works').get().count, 9);
  } finally { db.close(); }
});

test('show=false and show=NULL are absent from list and direct record routes', () => {
  const db = openDatabase(':memory:');
  try {
    const showColumn = db.prepare('PRAGMA table_info(works)').all().find(column => column.name === 'show');
    assert.equal(showColumn.notnull, 0);
    db.prepare('UPDATE works SET show = NULL WHERE slug = ?').run('dashboard');
    db.prepare('UPDATE works SET show = 0 WHERE slug = ?').run('ycs');
    assert.deepEqual(publicWorks(db), []);
    assert.equal(publicWork(db, 'dashboard'), null);
    assert.equal(publicWork(db, 'ycs'), null);
    db.prepare('UPDATE works SET show = 1 WHERE slug = ?').run('dashboard');
    assert.equal(publicWork(db, 'dashboard')?.title, 'Dashboard');
  } finally { db.close(); }
});

test('hidden cases do not leak through API, SSR, direct URL, or metadata', async () => {
  const db = openDatabase(':memory:');
  await withServer(db, async origin => {
    db.prepare('UPDATE works SET show = NULL WHERE slug = ?').run('stories');
    const api = await (await fetch(`${origin}/api/works`)).text();
    assert.equal(api.includes('Недетские сказки'), false);
    const hidden = await fetch(`${origin}/api/works/stories`);
    assert.equal(hidden.status, 404);
    assert.equal((await hidden.text()).includes('Недетские сказки'), false);
    const html = await (await fetch(`${origin}/?work=stories&mode=reveal`)).text();
    assert.equal(html.includes('Недетские сказки'), false);
    assert.equal(html.includes('ЯрКиберСезон'), true);
    assert.equal(html.match(/<title>(.*?)<\/title>/)?.[1].includes('Недетские сказки'), false);
  });
});

test('Dashboard is public, selectable, and not featured', async () => {
  const db = openDatabase(':memory:');
  await withServer(db, async origin => {
    const record = await fetch(`${origin}/api/works/dashboard`);
    assert.equal(record.status, 200);
    assert.equal((await record.json()).featuredOrder, null);
    const html = await (await fetch(`${origin}/?work=dashboard&mode=reveal`)).text();
    assert.equal(html.includes('Dashboard'), true);
    assert.equal(html.includes('Публичная демо-проекция'), true);
    assert.equal(html.includes('rtalyutin-tg-mcp-8179.twc1.net/dashboard/'), true);
    assert.equal(html.includes('Открыть в новой вкладке'), true);
  });
});

test('hiding the YCS case revokes its poster URL along with every public projection', async () => {
  const db = openDatabase(':memory:');
  await withServer(db, async origin => {
    const poster = '/assets/ycs-backdrop.jpg';
    assert.equal((await fetch(origin + poster)).status, 200);
    db.prepare('UPDATE works SET show = 0 WHERE slug = ?').run('ycs');
    assert.equal((await fetch(origin + poster)).status, 404);
    assert.equal((await fetch(origin + '/api/works/ycs')).status, 404);
    assert.equal((await (await fetch(origin + '/')).text()).includes(poster), false);
    db.prepare('UPDATE works SET show = 1 WHERE slug = ?').run('ycs');
    assert.equal((await fetch(origin + poster)).status, 200);
  });
});

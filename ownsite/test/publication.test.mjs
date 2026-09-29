import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDatabase, publicWorks, publicWork, publicContacts } from '../db.mjs';
import { createHandler } from '../server.mjs';

function addHiddenWork(db) {
  db.prepare(`INSERT INTO works (id, slug, title, kind, category, status, role, summary, theme, show)
    VALUES ('hidden-fixture', 'hidden-fixture', 'Скрытая работа', 'it', 'Тест', 'Черновик', 'Тест', 'Не публиковать', 'neutral', 0)`).run();
}

test('show controls every public DB projection and newly enabled records', () => {
  const db = openDatabase(':memory:');
  try {
    addHiddenWork(db);
    assert.deepEqual(publicWorks(db).map(w => w.slug), ['ycs-miniapp', 'ycs-site']);
    assert.equal(publicWork(db, 'hidden-fixture'), null);
    db.prepare('UPDATE works SET show = 1, featured_order = 3 WHERE slug = ?').run('hidden-fixture');
    assert.equal(publicWork(db, 'hidden-fixture')?.title, 'Скрытая работа');
    assert.deepEqual(publicWorks(db).map(w => w.slug), ['ycs-miniapp', 'ycs-site', 'hidden-fixture']);
    db.prepare('UPDATE works SET show = 0 WHERE slug = ?').run('ycs-miniapp');
    assert.equal(publicWork(db, 'ycs-miniapp'), null);
    assert.deepEqual(publicWorks(db).map(w => w.slug), ['ycs-site', 'hidden-fixture']);
    assert.throws(() => db.prepare('UPDATE works SET show = NULL WHERE slug = ?').run('hidden-fixture'));
    assert.deepEqual(publicContacts(db), []);
  } finally { db.close(); }
});

test('hidden work is absent from API, SSR, and direct record route', async () => {
  const db = openDatabase(':memory:');
  addHiddenWork(db);
  const server = createServer(createHandler(db));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const api = await (await fetch(`${origin}/api/works`)).text();
    assert.equal(api.includes('Скрытая работа'), false);
    const hidden = await fetch(`${origin}/api/works/hidden-fixture`);
    assert.equal(hidden.status, 404);
    assert.equal((await hidden.text()).includes('Скрытая работа'), false);
    const html = await (await fetch(`${origin}/?work=hidden-fixture&mode=reveal`)).text();
    assert.equal(html.includes('Скрытая работа'), false);
    assert.equal(html.includes('ЯрКиберСезон'), true);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});

test('hiding a case revokes its poster URL along with its public listing', async () => {
  const db = openDatabase(':memory:');
  const server = createServer(createHandler(db));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const poster = '/assets/ycs-miniapp-poster.jpg';
    assert.equal((await fetch(origin + poster)).status, 200);
    db.prepare('UPDATE works SET show = 0 WHERE slug = ?').run('ycs-miniapp');
    assert.equal((await fetch(origin + poster)).status, 404);
    assert.equal((await fetch(origin + '/api/works/ycs-miniapp')).status, 404);
    assert.equal((await (await fetch(origin + '/')).text()).includes(poster), false);
    db.prepare('UPDATE works SET show = 1 WHERE slug = ?').run('ycs-miniapp');
    assert.equal((await fetch(origin + poster)).status, 200);
  } finally { await new Promise(resolve => server.close(resolve)); db.close(); }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';
import { openDatabase, publicWorks, publicWork, publicContacts } from '../db.mjs';
import { createHandler } from '../server.mjs';

function addHiddenWork(db) {
  db.prepare(`INSERT INTO works (id, slug, title, kind, category, status, role, summary, theme, show)
    VALUES ('hidden-fixture', 'hidden-fixture', 'Скрытая работа', 'it', 'Тест', 'Черновик', 'Тест', 'Не публиковать', 'neutral', 0)`).run();
}

async function serve(db, check) {
  const server = createServer(createHandler(db));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await check(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); db.close(); }
}

test('nine editorial records seed with YCS and Dashboard public', () => {
  const db = openDatabase(':memory:');
  try {
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM works').get().n, 9);
    assert.deepEqual(publicWorks(db).map(w => w.slug), ['ycs', 'dashboard']);
    const ycs = publicWork(db, 'ycs');
    assert.deepEqual(ycs.links.map(tool => tool.label), ['Открыть сайт ЯКС', 'Открыть Mini App']);
    assert.equal(publicWork(db, 'stories'), null);
    addHiddenWork(db);
    db.prepare('UPDATE works SET show = 1, featured_order = 2 WHERE slug = ?').run('hidden-fixture');
    assert.equal(publicWork(db, 'hidden-fixture')?.title, 'Скрытая работа');
    assert.deepEqual(publicWorks(db).map(w => w.slug), ['ycs', 'hidden-fixture', 'dashboard']);
    db.prepare('UPDATE works SET show = 0 WHERE slug = ?').run('ycs');
    assert.equal(publicWork(db, 'ycs'), null);
    assert.deepEqual(publicWorks(db).map(w => w.slug), ['hidden-fixture', 'dashboard']);
    db.prepare('UPDATE works SET show = NULL WHERE slug = ?').run('hidden-fixture');
    assert.equal(publicWork(db, 'hidden-fixture'), null);
    assert.deepEqual(publicContacts(db), []);
  } finally { db.close(); }
});

test('private records stay out of API, HTML, and direct routes; both YCS tools stay together', async () => {
  const db = openDatabase(':memory:');
  addHiddenWork(db);
  await serve(db, async origin => {
    const api = await (await fetch(`${origin}/api/works`)).json();
    assert.deepEqual(api.map(w => w.slug), ['ycs', 'dashboard']);
    assert.deepEqual(api[0].links.map(t => t.label), ['Открыть сайт ЯКС', 'Открыть Mini App']);
    assert.equal((await fetch(`${origin}/api/works/hidden-fixture`)).status, 404);
    assert.equal((await fetch(`${origin}/api/works/stories`)).status, 404);
    const html = await (await fetch(`${origin}/?work=hidden-fixture&mode=reveal`)).text();
    assert.equal(html.includes('Скрытая работа'), false);
    assert.equal(html.includes('Недетские сказки'), false);
    assert.equal(html.includes('ЯКС'), true);
    const siteHtml = await (await fetch(`${origin}/?work=ycs&tool=site`)).text();
    assert.equal(siteHtml.includes('data-orientation="landscape"'), true);
    assert.equal(siteHtml.includes('/assets/ycs-backdrop.jpg'), true);
    assert.match(siteHtml, /href="https:\/\/xn--90aiaibl0ahlel5n\.xn--p1ai\/" target="_blank"/);
    assert.equal((await fetch(`${origin}/tool.html`)).status, 200);
    assert.equal((await fetch(`${origin}/tool.js`)).status, 200);
    assert.equal((await fetch(`${origin}/healthz`)).status, 200);
  });
});

test('hiding YCS removes both tool posters and the case from public routes', async () => {
  const db = openDatabase(':memory:');
  await serve(db, async origin => {
    const posters = ['/assets/ycs-backdrop.jpg'];
    for (const poster of posters) assert.equal((await fetch(origin + poster)).status, 200);
    db.prepare('UPDATE works SET show = 0 WHERE slug = ?').run('ycs');
    for (const poster of posters) assert.equal((await fetch(origin + poster)).status, 404);
    assert.equal((await fetch(origin + '/api/works/ycs')).status, 404);
    assert.equal((await fetch(origin + '/tool.html')).status, 404);
    assert.equal((await fetch(origin + '/tool.js')).status, 404);
    const html = await (await fetch(origin + '/')).text();
    for (const poster of posters) assert.equal(html.includes(poster), false);
    db.prepare('UPDATE works SET show = 1 WHERE slug = ?').run('ycs');
    for (const poster of posters) assert.equal((await fetch(origin + poster)).status, 200);
    assert.equal((await fetch(origin + '/tool.html')).status, 200);
  });
});

test('older SQLite records migrate once, preserve edits, and retire duplicate YCS cards', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ownsite-migrate-'));
  const path = join(dir, 'portfolio.sqlite');
  try {
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE works (
      id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      kind TEXT NOT NULL, category TEXT NOT NULL, status TEXT NOT NULL,
      role TEXT NOT NULL, summary TEXT NOT NULL, theme TEXT NOT NULL,
      orientation TEXT NOT NULL DEFAULT 'portrait', live_url TEXT, poster TEXT,
      reveal_json TEXT NOT NULL DEFAULT '[]', featured_order INTEGER,
      catalogue_order INTEGER NOT NULL DEFAULT 0,
      show INTEGER NOT NULL DEFAULT 0 CHECK (show IN (0,1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);
    const insert = old.prepare(`INSERT INTO works
      (id,slug,title,kind,category,status,role,summary,theme,show)
      VALUES (?, ?, ?, 'it', 'old', 'old', 'old', 'old', 'neutral', 1)`);
    insert.run('ycs-miniapp', 'ycs-miniapp', 'Legacy Mini App');
    insert.run('ycs-site', 'ycs-site', 'Legacy Site');
    insert.run('other', 'other', 'Preserved custom work');
    old.close();
    const db = openDatabase(path);
    assert.deepEqual(publicWorks(db).map(w => w.slug), ['ycs', 'other', 'dashboard']);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM works WHERE id IN ('ycs-miniapp','ycs-site')").get().n, 2);
    db.prepare("UPDATE works SET show = 1 WHERE id = 'ycs-site'").run();
    db.close();
    const reopened = openDatabase(path);
    assert.deepEqual(publicWorks(reopened).map(w => w.slug), ['ycs', 'other', 'ycs-site', 'dashboard']);
    reopened.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('removing an environment-managed contact revokes it while manual contacts persist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ownsite-contact-'));
  const path = join(dir, 'portfolio.sqlite');
  const before = process.env.PUBLIC_PHONE;
  try {
    process.env.PUBLIC_PHONE = '+79990000000';
    const first = openDatabase(path);
    assert.equal(publicContacts(first).find(link => link.label === 'Позвонить')?.href, 'tel:+79990000000');
    first.close();
    delete process.env.PUBLIC_PHONE;
    const second = openDatabase(path);
    assert.equal(publicContacts(second).find(link => link.label === 'Позвонить'), undefined);
    second.prepare("INSERT INTO site_settings(key,value) VALUES ('phone','+78880000000')").run();
    second.close();
    const third = openDatabase(path);
    assert.equal(publicContacts(third).find(link => link.label === 'Позвонить')?.href, 'tel:+78880000000');
    third.close();
  } finally {
    if (before === undefined) delete process.env.PUBLIC_PHONE;
    else process.env.PUBLIC_PHONE = before;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('container mode refuses to start without DATABASE_URL', () => {
  const result = spawnSync(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, DATABASE_URL: '', REQUIRE_DATABASE_URL: '1' },
    encoding: 'utf8',
    timeout: 3000
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /database configuration/);
});

test('liveness stays independent from a failed database; readiness reports failure', async () => {
  const server = createServer(createHandler({
    async publicWorks() { throw new Error('database unavailable'); }
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(origin + '/healthz')).status, 200);
    assert.equal((await fetch(origin + '/readyz')).status, 503);
    assert.equal((await fetch(origin + '/api/works')).status, 503);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

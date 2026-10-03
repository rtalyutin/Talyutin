import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { openDatabase, publicWorks } from '../db.mjs';
import { createHandler } from '../server.mjs';
import { renderCatalogue } from '../public/registry.js';

test('catalogue keeps hostile editorial text inside one non-executable link', () => {
  const slug = 'a" onclick="alert(1)&<';
  const html = renderCatalogue([{ slug, title: '<script>alert(1)</script>', category: '"<img onerror=x>' }], slug);
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
  assert.equal((html.match(/aria-current="true"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<script|<img| onclick="/);
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes(`/?work=${encodeURIComponent(slug)}&amp;mode=reveal#manifesto`));
  assert.equal(renderCatalogue([]), '');
});

test('SSR and client use the same catalogue without widening publication or losing contacts', async () => {
  const db = openDatabase(':memory:');
  db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run('phone', '+79065253445');
  db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)').run('email', 'info@yarcyberseason.ru');
  const server = createServer(createHandler(db));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const expectedCount of [2, 9, 0]) {
      if (expectedCount === 9) db.exec('UPDATE works SET show = 1');
      if (expectedCount === 0) db.exec('UPDATE works SET show = 0');
      const works = publicWorks(db);
      assert.equal(works.length, expectedCount);
      const html = await (await fetch(`${origin}/?work=dashboard&mode=reveal`)).text();
      assert.ok(html.includes(renderCatalogue(works, works.find(work => work.slug === 'dashboard')?.slug)));
      assert.equal((html.match(/class="ticket-link"/g) ?? []).length, expectedCount);
      assert.match(html, /class="contact-ticket" data-contact="phone" href="tel:\+79065253445"/);
      assert.match(html, /class="contact-ticket" data-contact="email" href="mailto:info@yarcyberseason\.ru"/);
    }
    for (const module of ['/registry.js', '/motion.js']) {
      const response = await fetch(origin + module);
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type'), /javascript/);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    db.close();
  }
});

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { openDatabase, publicWorks, publicWork, publicContacts } from './db.mjs';

const root = resolve(import.meta.dirname, 'public');
const db = openDatabase(process.env.PORTFOLIO_DB || resolve(import.meta.dirname, 'data', 'portfolio.sqlite'));
const mime = { '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

export function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

function renderIndex(url, database) {
  const works = publicWorks(database);
  const requested = url.searchParams.get('work');
  const chosen = works.find(w => w.slug === requested) ?? works[0];
  const mode = url.searchParams.get('mode') === 'reveal' ? 'reveal' : 'view';
  const title = chosen?.title ?? 'Работы в действии';
  const category = chosen?.category ?? 'Портфолио';
  const reveal = chosen?.reveal?.map(part => `<div class="reveal-item"><span>${escapeHtml(part.heading)}</span><p>${escapeHtml(part.body)}</p></div>`).join('') ?? '';
  const entries = works.map((w, i) => `<li><a href="/?work=${encodeURIComponent(w.slug)}&mode=${mode}" data-work="${escapeHtml(w.slug)}" ${w.slug === chosen?.slug ? 'aria-current="true"' : ''}><span>${String(i + 1).padStart(2, '0')}</span><strong>${escapeHtml(w.category)}</strong><small>${escapeHtml(w.title)}</small></a></li>`).join('');
  const catalogue = works.map(w => `<article class="work-row"><span>${escapeHtml(w.category)}</span><h3>${escapeHtml(w.title)}</h3><p>${escapeHtml(w.summary)}</p><a href="/?work=${encodeURIComponent(w.slug)}&mode=reveal">Раскрыть работу ↗</a></article>`).join('');
  const contacts = publicContacts(database);
  const outlets = contacts.length ? contacts.map(link => `<a href="${escapeHtml(link.href)}" ${link.href.startsWith('https:') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(link.label)} ↗</a>`).join('') : '<span class="contact-pending">Публичные адреса для связи будут добавлены в финальную сборку.</span>';
  return readFileSync(join(root, 'index.html'), 'utf8')
    .replaceAll('{{TITLE}}', escapeHtml(title))
    .replaceAll('{{DISPLAY_TITLE}}', escapeHtml(chosen?.displayTitle ?? title))
    .replaceAll('{{CATEGORY}}', escapeHtml(category))
    .replaceAll('{{SUMMARY}}', escapeHtml(chosen?.summary ?? 'Реальные работы и решения.'))
    .replaceAll('{{ROLE}}', escapeHtml(chosen?.role ?? ''))
    .replaceAll('{{STATUS}}', escapeHtml(chosen?.status ?? ''))
    .replaceAll('{{LIVE_URL}}', escapeHtml(chosen?.liveUrl ?? '#works'))
    .replaceAll('{{POSTER}}', escapeHtml(chosen?.poster ?? ''))
    .replaceAll('{{REVEAL}}', reveal)
    .replaceAll('{{ENTRIES}}', entries)
    .replaceAll('{{CATALOGUE}}', catalogue)
    .replaceAll('{{CONTACT_OUTLETS}}', outlets)
    .replaceAll('{{CASE_COUNT}}', String(works.length).padStart(2, '0'))
    .replaceAll('{{CASE_INDEX}}', String(Math.max(works.findIndex(w => w.slug === chosen?.slug), 0) + 1).padStart(2, '0'))
    .replaceAll('{{MODE}}', mode)
    .replaceAll('{{THEME}}', escapeHtml(chosen?.theme ?? 'neutral'))
    .replaceAll('{{ORIENTATION}}', escapeHtml(chosen?.orientation ?? 'portrait'));
}

function send(res, code, type, body, extra = {}) {
  res.writeHead(code, {
    'Content-Type': `${type}; charset=utf-8`,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src https://xn--90aiaibl0ahlel5n.xn--p1ai https://ycs.bar; connect-src 'self'; base-uri 'none'; object-src 'none'",
    ...extra
  });
  res.end(body);
}

export function createHandler(database) {
  return (req, res) => handle(req, res, database);
}

export const handler = createHandler(db);

function handle(req, res, database) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'Method not allowed');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/works') return send(res, 200, 'application/json', JSON.stringify(publicWorks(database)));
  if (url.pathname.startsWith('/api/works/')) {
    let slug;
    try { slug = decodeURIComponent(url.pathname.slice('/api/works/'.length)); }
    catch { return send(res, 404, 'application/json', '{"error":"Not found"}'); }
    const work = publicWork(database, slug);
    return work ? send(res, 200, 'application/json', JSON.stringify(work)) : send(res, 404, 'application/json', '{"error":"Not found"}');
  }
  if (url.pathname === '/robots.txt') return send(res, 200, 'text/plain', 'User-agent: *\nDisallow: /\n');
  if (url.pathname === '/' || url.pathname === '/index.html') return send(res, 200, 'text/html', renderIndex(url, database));
  if (url.pathname === '/favicon.svg' || url.pathname.startsWith('/assets/') || url.pathname === '/app.js' || url.pathname === '/styles.css') {
    if (url.pathname.startsWith('/assets/') && url.pathname !== '/assets/torn-paper.jpg' &&
        !publicWorks(database).some(work => work.poster === url.pathname)) {
      return send(res, 404, 'text/plain', 'Not found');
    }
    const safe = resolve(root, '.' + url.pathname);
    if (!safe.startsWith(root + '/')) return send(res, 404, 'text/plain', 'Not found');
    try { return send(res, 200, mime[extname(safe)] || 'application/octet-stream', readFileSync(safe)); }
    catch { return send(res, 404, 'text/plain', 'Not found'); }
  }
  return send(res, 404, 'text/plain', 'Not found');
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const port = Number(process.env.PORT || 4173);
  createServer(handler).listen(port, '0.0.0.0', () => process.stdout.write(`Local preview on port ${port}\n`));
}

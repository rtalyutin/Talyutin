import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { openDatabase, publicWorks, publicWork, publicContacts } from './db.mjs';
import { openPostgres } from './pg-db.mjs';
import { seedWorks } from './seed-works.mjs';

const root = resolve(import.meta.dirname, 'public');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const staticFiles = new Set(['/favicon.svg', '/app.js', '/styles.css', '/tool.html', '/tool.js', '/tool.css']);
const sharedAssets = new Set(['/assets/torn-paper.jpg', '/assets/tear.webp']);
const plannerFiles = new Set(['/tool.html', '/tool.js', '/tool.css']);

function safeLiveUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

export function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}

async function getWorks(database) {
  return typeof database.publicWorks === 'function' ? database.publicWorks() : publicWorks(database);
}
async function getWork(database, slug) {
  return typeof database.publicWork === 'function' ? database.publicWork(slug) : publicWork(database, slug);
}
async function getContacts(database) {
  return typeof database.publicContacts === 'function' ? database.publicContacts() : publicContacts(database);
}

async function renderIndex(url, database) {
  const works = await getWorks(database);
  const requested = url.searchParams.get('work');
  const chosen = works.find(w => w.slug === requested) ?? works[0];
  const mode = url.searchParams.get('mode') === 'reveal' ? 'reveal' : 'view';
  const title = chosen?.title ?? 'Работы в действии';
  const category = chosen?.category ?? 'Портфолио';
  const reveal = chosen?.reveal?.map(part => `<div class="reveal-item"><span>${escapeHtml(part.heading)}</span><p>${escapeHtml(part.body)}</p></div>`).join('') ?? '';
  const entries = works.map((w, i) => `<li><a href="/?work=${encodeURIComponent(w.slug)}&mode=${mode}" data-work="${escapeHtml(w.slug)}" ${w.slug === chosen?.slug ? 'aria-current="true"' : ''}><span>${String(i + 1).padStart(2, '0')}</span><strong>${escapeHtml(w.category)}</strong><small>${escapeHtml(w.title)}</small></a></li>`).join('');
  const catalogue = works.map(w => `<article class="work-row"><span>${escapeHtml(w.category)}</span><h3>${escapeHtml(w.title)}</h3><p>${escapeHtml(w.summary)}</p><a href="/?work=${encodeURIComponent(w.slug)}&mode=reveal">Раскрыть работу ↗</a></article>`).join('');
  const workLinks = (chosen?.links?.length ? chosen.links : chosen?.liveUrl ? [{ label: 'Открыть действующий инструмент', href: chosen.liveUrl }] : [])
    .map(link => `<a href="${escapeHtml(link.href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)} ↗</a>`).join('');
  const contacts = await getContacts(database);
  const outlets = contacts.length ? contacts.map(link => `<a href="${escapeHtml(link.href)}" ${link.href.startsWith('https:') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(link.label)} ↗</a>`).join('') : '<span class="contact-pending">Публичные адреса для связи будут добавлены в финальную сборку.</span>';
  return readFileSync(join(root, 'index.html'), 'utf8')
    .replaceAll('{{TITLE}}', escapeHtml(title))
    .replaceAll('{{DISPLAY_TITLE}}', escapeHtml(chosen?.displayTitle ?? title))
    .replaceAll('{{CATEGORY}}', escapeHtml(category))
    .replaceAll('{{SUMMARY}}', escapeHtml(chosen?.summary ?? 'Реальные работы и решения.'))
    .replaceAll('{{ROLE}}', escapeHtml(chosen?.role ?? ''))
    .replaceAll('{{STATUS}}', escapeHtml(chosen?.status ?? ''))
    .replaceAll('{{LIVE_URL}}', escapeHtml(safeLiveUrl(chosen?.liveUrl) ?? '#works'))
    .replaceAll('{{POSTER}}', escapeHtml(chosen?.poster ?? ''))
    .replaceAll('{{POSTER_HIDDEN}}', chosen?.poster ? '' : 'hidden')
    .replaceAll('{{ACTIVATE_LABEL}}', chosen?.embedAllowed ? 'Открыть живой экран' : 'Открыть в новой вкладке')
    .replaceAll('{{EXTERNAL_LINKS}}', workLinks)
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
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src 'self' https://xn--90aiaibl0ahlel5n.xn--p1ai https://ycs.bar; connect-src 'self'; base-uri 'none'; object-src 'none'",
    ...extra
  });
  res.end(body);
}

export function createHandler(database) {
  return (req, res) => {
    void handle(req, res, database).catch(() => {
      if (!res.headersSent) send(res, 503, 'text/plain', 'Service unavailable');
      else res.destroy();
    });
  };
}

async function handle(req, res, database) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'text/plain', 'Method not allowed');
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/healthz') {
    return send(res, 200, 'text/plain', 'OK');
  }
  if (url.pathname === '/readyz') {
    await getWorks(database);
    return send(res, 200, 'text/plain', 'OK');
  }
  if (url.pathname === '/api/works') return send(res, 200, 'application/json', JSON.stringify(await getWorks(database)));
  if (url.pathname.startsWith('/api/works/')) {
    let slug;
    try { slug = decodeURIComponent(url.pathname.slice('/api/works/'.length)); }
    catch { return send(res, 404, 'application/json', '{"error":"Not found"}'); }
    const work = await getWork(database, slug);
    return work ? send(res, 200, 'application/json', JSON.stringify(work)) : send(res, 404, 'application/json', '{"error":"Not found"}');
  }
  if (url.pathname === '/robots.txt') return send(res, 200, 'text/plain', process.env.ALLOW_INDEXING === '1' ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');
  if (url.pathname === '/' || url.pathname === '/index.html') return send(res, 200, 'text/html', await renderIndex(url, database));
  if (staticFiles.has(url.pathname) || url.pathname.startsWith('/assets/')) {
    if (plannerFiles.has(url.pathname) && !(await getWorks(database)).some(work => work.slug === 'ycs')) {
      return send(res, 404, 'text/plain', 'Not found');
    }
    if (url.pathname.startsWith('/assets/') && !sharedAssets.has(url.pathname)) {
      const works = await getWorks(database);
      if (!works.some(work => work.poster === url.pathname || work.tools?.some(tool => tool.poster === url.pathname))) {
        return send(res, 404, 'text/plain', 'Not found');
      }
    }
    const safe = resolve(root, '.' + url.pathname);
    if (!safe.startsWith(root + '/')) return send(res, 404, 'text/plain', 'Not found');
    try { return send(res, 200, mime[extname(safe)] || 'application/octet-stream', readFileSync(safe)); }
    catch { return send(res, 404, 'text/plain', 'Not found'); }
  }
  return send(res, 404, 'text/plain', 'Not found');
}

async function start() {
  const database = process.env.DATABASE_URL
    ? await openPostgres(process.env.DATABASE_URL, seedWorks, { phone: process.env.PUBLIC_PHONE, email: process.env.PUBLIC_EMAIL })
    : process.env.REQUIRE_DATABASE_URL === '1'
      ? (() => { throw new Error('DATABASE_URL is required for this deployment'); })()
      : openDatabase(process.env.PORTFOLIO_DB || resolve(import.meta.dirname, 'data', 'portfolio.sqlite'));
  const port = Number(process.env.PORT || 4173);
  createServer(createHandler(database)).listen(port, '0.0.0.0', () => process.stdout.write(`Portfolio listening on port ${port}\n`));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  start().catch(() => { process.stderr.write('Portfolio startup failed: check database configuration\n'); process.exitCode = 1; });
}

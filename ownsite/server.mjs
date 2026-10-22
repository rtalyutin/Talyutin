import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { extname, join, resolve, relative, isAbsolute } from 'node:path';
import { openDatabase, publicWorks, publicWork, publicContacts } from './db.mjs';
import { openPostgres } from './pg-db.mjs';
import { seedWorks } from './seed-works.mjs';
import { openRemotePortfolio } from './remote-db.mjs';
import { renderCatalogue, renderCase } from './public/registry.js';
import { offlineWorks } from './public/offline-works.js';

const root = resolve(import.meta.dirname, 'public');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.txt': 'text/plain' };
const staticFiles = new Set(['/favicon.svg', '/app.js', '/registry.js', '/offline-works.js', '/motion.js', '/styles.css', '/tool.html', '/tool.js', '/tool.css']);
const php2shellFiles = new Set(['/php2shell', '/php2shell/styles.css', '/php2shell/app.js']);
const plannerFiles = new Set(['/tool.html', '/tool.js', '/tool.css']);
const tochkiFiles = new Set([
  '/tochki/', '/tochki/index.html', '/tochki/app.js', '/tochki/game.css',
  '/tochki/worker.js', '/tochki/core.js', '/tochki/bot.js', '/tochki/capture.js',
  '/tochki/assets/background-desktop.png', '/tochki/assets/background-mobile.png',
  '/tochki/assets/board-paper.png', '/tochki/assets/captured-zone-red.png',
  '/tochki/assets/captured-zone-blue.png',
]);

function readTochkiFile(path) {
  if (path.startsWith('/tochki/assets/') && path.endsWith('.png')) {
    const directory = join(root, 'tochki', 'assets');
    const name = path.slice('/tochki/assets/'.length);
    const asset = JSON.parse(readFileSync(join(directory, 'packed-assets.json'), 'utf8'))[name];
    if (asset) {
      // Transfer packaging only: reconstruct the original PNG byte for byte.
      const content = asset.parts.map(part => {
        if (!/^[a-z-]+\.part-\d{3}\.b64$/.test(part)) throw new Error('Invalid asset part');
        return readFileSync(join(directory, part), 'utf8');
      }).join('');
      const bytes = Buffer.from(content, 'base64');
      if (bytes.length !== asset.size || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
        throw new Error('Invalid packed asset');
      }
      return bytes;
    }
  }
  return readFileSync(resolve(root, '.' + path));
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

// Approved public contacts from the accepted homepage, independent of portfolio uptime.
// A successful empty contact response still hides them intentionally.
const publicEmail = 'r.talyutin@gmail.com';
const offlineContacts = [
  { label: 'Написать письмо', href: `mailto:${publicEmail}` },
  { label: 'Позвонить', href: 'tel:+79065253445' },
  { label: 'ВКонтакте', href: 'https://vk.com/talyutin' }
];

async function renderIndex(url, database) {
  const [worksResult, contactsResult] = await Promise.allSettled([
    getWorks(database), getContacts(database)
  ]);
  const worksUnavailable = worksResult.status === 'rejected';
  const works = worksUnavailable ? offlineWorks : worksResult.value;
  const requested = url.searchParams.get('work');
  const chosen = worksUnavailable ? undefined : works.find(work => work.slug === requested);
  // The owner's current website email also applies while an upstream retains the old address.
  const contacts = (contactsResult.status === 'fulfilled' ? contactsResult.value : offlineContacts)
    .map(link => link.href.startsWith('mailto:') ? { ...link, href: `mailto:${publicEmail}` } : link);
  const outlets = contacts.map(link => {
    const kind = link.href.startsWith('tel:') ? 'phone' : link.href.startsWith('mailto:') ? 'email' : 'external';
    let value = kind === 'external' ? link.label : link.href.replace(/^(tel:|mailto:)/, '').split('?')[0];
    if (kind === 'phone') value = value.replace(/^\+7(\d{3})(\d{3})(\d{2})(\d{2})$/, '+7 $1 $2-$3-$4');
    return `<a data-contact="${kind}" href="${escapeHtml(link.href)}" ${kind === 'external' ? 'target="_blank" rel="noopener noreferrer"' : ''}>${escapeHtml(value)} <span aria-hidden="true">↗</span></a>`;
  }).join('') || '<p class="contact-p">Контакты скоро появятся.</p>';
  const primary = contacts.find(link => link.href.startsWith('mailto:')) ?? contacts[0];
  const values = {
    PAGE_TITLE: escapeHtml(chosen ? `${chosen.title} · Роман Талютин` : 'Задача → решение · Роман Талютин'),
    CATALOGUE: renderCatalogue(works, chosen?.slug, { direct: worksUnavailable }) || `<p class="catalogue-empty">${worksUnavailable ? 'Портфолио временно недоступно. Попробуйте зайти позже.' : 'Работы скоро появятся.'}</p>`,
    CATALOGUE_HINT: worksUnavailable ? 'Проекты откроются в новой вкладке.' : 'У каждого проекта — свой разбор.',
    CASE_COUNT: String(works.length).padStart(2, '0'),
    WORKS_UNAVAILABLE: String(worksUnavailable),
    FILTER_STATUS: worksUnavailable ? `Избранные проекты: ${works.length}` : `Показано работ: ${works.length}`,
    SELECTED_CASE: chosen ? `<section class="case-fallback" id="selected-case" aria-labelledby="selected-case-title">${renderCase(chosen, { titleId: 'selected-case-title' })}<a class="case-fallback-close" href="/#works">← Все работы</a></section>` : '',
    CONTACT_CTA: primary ? `<a class="email-cta" href="${escapeHtml(primary.href)}">${primary.href.startsWith('tel:') ? 'Позвонить' : 'Написать о задаче'} <b aria-hidden="true">↗</b></a>` : '',
    CONTACT_OUTLETS: outlets,
    WORKS_JSON: escapeHtml(JSON.stringify(works))
  };
  // One pass: editorial content cannot inject another template replacement.
  return readFileSync(join(root, 'index.html'), 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => values[key] ?? '');
}

function send(res, code, type, body, extra = {}) {
  res.writeHead(code, {
    'Content-Type': (type === 'model/gltf-binary' ? type : `${type}; charset=utf-8`),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-src 'self' https://xn--90aiaibl0ahlel5n.xn--p1ai https://ycs.bar https://yarcyberseason.ru; connect-src 'self'; base-uri 'none'; object-src 'none'",
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
  if (url.pathname === '/php2shell/' || url.pathname === '/php2shell/index.html') return send(res, 308, 'text/plain', 'Moved', { Location: '/php2shell' });
  if (php2shellFiles.has(url.pathname)) {
    const path = url.pathname === '/php2shell' ? '/php2shell/index.html' : url.pathname;
    try { return send(res, 200, mime[extname(path)], readFileSync(resolve(root, '.' + path))); }
    catch { return send(res, 404, 'text/plain', 'Not found'); }
  }
  if (url.pathname === '/tochki') return send(res, 308, 'text/plain', 'Moved', { Location: '/tochki/' });
  if (tochkiFiles.has(url.pathname)) {
    const path = url.pathname === '/tochki/' ? '/tochki/index.html' : url.pathname;
    try { return send(res, 200, mime[extname(path)], readTochkiFile(path)); }
    catch { return send(res, 404, 'text/plain', 'Not found'); }
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
    if (url.pathname.startsWith('/assets/')) {
      const works = await getWorks(database);
      if (!works.some(work => work.poster === url.pathname || work.tools?.some(tool => tool.poster === url.pathname))) {
        return send(res, 404, 'text/plain', 'Not found');
      }
    }
    const safe = resolve(root, '.' + url.pathname);
    const within = relative(root, safe);
    if (within.startsWith('..') || isAbsolute(within)) return send(res, 404, 'text/plain', 'Not found');
    try { return send(res, 200, mime[extname(safe)] || 'application/octet-stream', readFileSync(safe)); }
    catch { return send(res, 404, 'text/plain', 'Not found'); }
  }
  return send(res, 404, 'text/plain', 'Not found');
}

export async function openConfiguredPortfolio(env = process.env) {
  if (env.PORTFOLIO_API_URL) return openRemotePortfolio(env.PORTFOLIO_API_URL, { allowLoopback: env.NODE_ENV !== 'production' });
  if (env.REQUIRE_PORTFOLIO_API_URL === '1') throw new Error('PORTFOLIO_API_URL is required for this deployment');
  return env.DATABASE_URL
    ? await openPostgres(env.DATABASE_URL, seedWorks, { phone: env.PUBLIC_PHONE, email: env.PUBLIC_EMAIL })
    : env.REQUIRE_DATABASE_URL === '1'
      ? (() => { throw new Error('DATABASE_URL is required for this deployment'); })()
      : openDatabase(env.PORTFOLIO_DB || resolve(import.meta.dirname, 'data', 'portfolio.sqlite'));
}

async function start() {
  const database = await openConfiguredPortfolio();
  const port = Number(process.env.PORT || 4173);
  createServer(createHandler(database)).listen(port, '0.0.0.0', () => process.stdout.write(`Portfolio listening on port ${port}\n`));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  start().catch(() => { process.stderr.write('Portfolio startup failed: check database configuration\n'); process.exitCode = 1; });
}


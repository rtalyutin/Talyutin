import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const defaultPath = resolve(process.cwd(), 'data', 'portfolio.sqlite');

export function openDatabase(path = defaultPath) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS works (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      display_title TEXT,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      role TEXT NOT NULL,
      summary TEXT NOT NULL,
      theme TEXT NOT NULL,
      orientation TEXT NOT NULL DEFAULT 'portrait',
      live_url TEXT,
      poster TEXT,
      reveal_json TEXT NOT NULL DEFAULT '[]',
      featured_order INTEGER,
      catalogue_order INTEGER NOT NULL DEFAULT 0,
      show INTEGER NOT NULL DEFAULT 0 CHECK (show IN (0, 1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS works_public_order ON works(show, featured_order, catalogue_order);
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  const columns = db.prepare('PRAGMA table_info(works)').all().map(row => row.name);
  if (!columns.includes('display_title')) db.exec('ALTER TABLE works ADD COLUMN display_title TEXT');
  seed(db);
  return db;
}

const seedWorks = [
  {
    id: 'ycs-miniapp', slug: 'ycs-miniapp', title: 'ЯрКиберСезон', display_title: 'ЯКС', kind: 'it',
    category: 'Telegram Mini App', status: 'Работает',
    role: 'Инициатор и организатор ЯКС; постановка сценариев миниаппы',
    summary: 'Турнир, участники, расписание и матчи — прямо на экране приложения.',
    theme: 'tear', orientation: 'portrait',
    live_url: 'https://xn--90aiaibl0ahlel5n.xn--p1ai/tg',
    poster: '/assets/ycs-miniapp-poster.jpg', featured_order: 1, catalogue_order: 1,
    show: 1,
    reveal_json: JSON.stringify([
      { heading: 'Задача', body: 'Сделать турнир доступным с телефона: от обзора и состава команд до расписания и сетки.' },
      { heading: 'Решение', body: 'Компактный интерфейс с отдельными состояниями турнира. Пользователь открывает реальный сезон и переходит к нужному разделу.' },
      { heading: 'Проверить самому', body: 'Откройте действующее приложение, выберите турнир и переключитесь на «Участники» или «Матчи».' }
    ])
  },
  {
    id: 'ycs-site', slug: 'ycs-site', title: 'ЯрКиберСезон', display_title: 'ЯКС', kind: 'it',
    category: 'Сайт турнира', status: 'Работает',
    role: 'Инициатор и организатор ЯКС; развитие сайта сезона',
    summary: 'Сезон, турнирные страницы, команды и результаты в одном живом продукте.',
    theme: 'arena', orientation: 'landscape',
    live_url: 'https://xn--90aiaibl0ahlel5n.xn--p1ai/',
    poster: '/assets/ycs-backdrop.jpg', featured_order: 2, catalogue_order: 2,
    show: 1,
    reveal_json: JSON.stringify([
      { heading: 'Задача', body: 'Собрать разрозненную информацию турнира в понятный маршрут для участников и зрителей.' },
      { heading: 'Решение', body: 'На сайте доступны текущий сезон, архив, команды, расписание и результаты. Данные и состояния разделены по турнирным страницам.' },
      { heading: 'Проверить самому', body: 'Откройте сайт, перейдите в архив или на страницу команды и вернитесь к турниру.' }
    ])
  }
];

function seed(db) {
  const insert = db.prepare(`INSERT OR IGNORE INTO works
    (id, slug, title, display_title, kind, category, status, role, summary, theme, orientation,
      live_url, poster, reveal_json, featured_order, catalogue_order, show)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const w of seedWorks) {
    insert.run(w.id, w.slug, w.title, w.display_title ?? null, w.kind, w.category, w.status, w.role,
      w.summary, w.theme, w.orientation ?? 'portrait', w.live_url ?? null,
      w.poster ?? null, w.reveal_json ?? '[]', w.featured_order ?? null,
      w.catalogue_order, w.show);
  }
  db.prepare("UPDATE works SET display_title = 'ЯКС' WHERE id IN ('ycs-miniapp', 'ycs-site') AND display_title IS NULL").run();
  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  for (const [key, value] of [['phone', process.env.PUBLIC_PHONE], ['email', process.env.PUBLIC_EMAIL]]) {
    if (validContactValue(key, value)) insertSetting.run(key, value);
  }
}

function mapPublic(row) {
  return {
    id: row.id, slug: row.slug, title: row.title, displayTitle: row.display_title || row.title, kind: row.kind,
    category: row.category, status: row.status, role: row.role,
    summary: row.summary, theme: row.theme, orientation: row.orientation,
    liveUrl: row.live_url, poster: row.poster,
    reveal: JSON.parse(row.reveal_json), featuredOrder: row.featured_order
  };
}

const publicColumns = `id, slug, title, display_title, kind, category, status, role, summary, theme,
  orientation, live_url, poster, reveal_json, featured_order`;

export function publicWorks(db) {
  return db.prepare(`SELECT ${publicColumns} FROM works WHERE show = 1
    ORDER BY CASE WHEN featured_order IS NULL THEN 1 ELSE 0 END,
      featured_order, catalogue_order, slug`).all().map(mapPublic);
}

export function publicWork(db, slug) {
  const row = db.prepare(`SELECT ${publicColumns} FROM works
    WHERE slug = ? AND show = 1`).get(slug);
  return row ? mapPublic(row) : null;
}

export function publicContacts(db) {
  const values = Object.fromEntries(db.prepare("SELECT key, value FROM site_settings WHERE key IN ('phone', 'telegram', 'email')").all().map(row => [row.key, row.value]));
  const links = [];
  if (validContactValue('phone', values.phone)) links.push({ label: 'Позвонить', href: `tel:${values.phone}` });
  if (validContactValue('telegram', values.telegram)) links.push({ label: 'Написать в Telegram', href: values.telegram });
  if (validContactValue('email', values.email)) links.push({ label: 'Написать письмо', href: `mailto:${values.email}` });
  return links;
}

export function validContactValue(key, value) {
  if (typeof value !== 'string') return false;
  if (key === 'phone') return /^\+[0-9]{10,15}$/.test(value);
  if (key === 'telegram') return /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\/?$/.test(value);
  if (key === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return false;
}

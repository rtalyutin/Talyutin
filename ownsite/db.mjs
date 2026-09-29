import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { seedWorks } from './seed-works.mjs';

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
      tools_json TEXT NOT NULL DEFAULT '[]',
      featured_order INTEGER,
      catalogue_order INTEGER NOT NULL DEFAULT 0,
      show INTEGER NOT NULL DEFAULT 0 CHECK (show IN (0, 1)),
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS works_public_order ON works(show, featured_order, catalogue_order);
    CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS env_managed_contacts (key TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  const columns = new Set(db.prepare('PRAGMA table_info(works)').all().map(row => row.name));
  if (!columns.has('display_title')) db.exec('ALTER TABLE works ADD COLUMN display_title TEXT');
  if (!columns.has('tools_json')) db.exec("ALTER TABLE works ADD COLUMN tools_json TEXT NOT NULL DEFAULT '[]'");
  seed(db);
  return db;
}

function seed(db) {
  const insert = db.prepare(`INSERT OR IGNORE INTO works
    (id, slug, title, display_title, kind, category, status, role, summary, theme, orientation,
      live_url, poster, reveal_json, tools_json, featured_order, catalogue_order, show)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const w of seedWorks) {
    insert.run(w.id, w.slug, w.title, w.display_title ?? null, w.kind, w.category, w.status, w.role,
      w.summary, w.theme, w.orientation ?? 'portrait', w.live_url ?? null, w.poster ?? null,
      JSON.stringify(w.reveal_json ?? []), JSON.stringify(w.tools_json ?? []),
      w.featured_order ?? null, w.catalogue_order, w.show ?? 0);
  }
  // A one-time local migration keeps legacy records but removes duplicate public YCS cases.
  if (!db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'unify-ycs' ").get()) {
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE works SET show = 0 WHERE id IN ('ycs-miniapp', 'ycs-site')").run();
      db.prepare("INSERT INTO schema_migrations(name) VALUES ('unify-ycs')").run();
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  const insertSetting = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  const markEnv = db.prepare('INSERT OR IGNORE INTO env_managed_contacts (key) VALUES (?)');
  const wasEnv = db.prepare('SELECT 1 FROM env_managed_contacts WHERE key = ?');
  const deleteSetting = db.prepare('DELETE FROM site_settings WHERE key = ?');
  const unmarkEnv = db.prepare('DELETE FROM env_managed_contacts WHERE key = ?');
  db.exec('BEGIN');
  try {
    for (const [key, value] of [['phone', process.env.PUBLIC_PHONE], ['email', process.env.PUBLIC_EMAIL]]) {
      if (validContactValue(key, value)) { insertSetting.run(key, value); markEnv.run(key); }
      else if (wasEnv.get(key)) { deleteSetting.run(key); unmarkEnv.run(key); }
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function parseArray(value) {
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

function mapPublic(row) {
  const tools = parseArray(row.tools_json);
  return {
    id: row.id, slug: row.slug, title: row.title, displayTitle: row.display_title || row.title, kind: row.kind,
    category: row.category, status: row.status, role: row.role, summary: row.summary,
    theme: row.theme, orientation: row.orientation, liveUrl: row.live_url, poster: row.poster,
    reveal: parseArray(row.reveal_json), tools, featuredOrder: row.featured_order
  };
}

const publicColumns = `id, slug, title, display_title, kind, category, status, role, summary, theme,
  orientation, live_url, poster, reveal_json, tools_json, featured_order`;

export function publicWorks(db) {
  return db.prepare(`SELECT ${publicColumns} FROM works WHERE show = 1
    ORDER BY CASE WHEN featured_order IS NULL THEN 1 ELSE 0 END,
      featured_order, catalogue_order, slug`).all().map(mapPublic);
}

export function publicWork(db, slug) {
  const row = db.prepare(`SELECT ${publicColumns} FROM works WHERE slug = ? AND show = 1`).get(slug);
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

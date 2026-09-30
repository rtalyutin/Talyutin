import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const defaultPath = resolve(process.cwd(), 'data', 'portfolio.sqlite');
import { seedWorks, contentRevision } from './seed-works.mjs';

const worksSchema = `CREATE TABLE works (
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
  embed_allowed INTEGER NOT NULL DEFAULT 0 CHECK (embed_allowed IN (0, 1)),
  links_json TEXT NOT NULL DEFAULT '[]',
  poster TEXT,
  reveal_json TEXT NOT NULL DEFAULT '[]',
  featured_order INTEGER,
  catalogue_order INTEGER NOT NULL DEFAULT 0,
  show INTEGER DEFAULT 0 CHECK (show IN (0, 1) OR show IS NULL),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export function openDatabase(path = defaultPath) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL;');
  db.exec(`${worksSchema.replace('CREATE TABLE works', 'CREATE TABLE IF NOT EXISTS works')};
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  migrateWorksSchema(db);
  db.exec('CREATE INDEX IF NOT EXISTS works_public_order ON works(show, featured_order, catalogue_order);');
  seed(db);
  syncEnvironmentContacts(db);
  return db;
}

function migrateWorksSchema(db) {
  let columns = db.prepare('PRAGMA table_info(works)').all();
  const names = columns.map(row => row.name);
  if (!names.includes('display_title')) db.exec('ALTER TABLE works ADD COLUMN display_title TEXT');
  if (!names.includes('embed_allowed')) db.exec('ALTER TABLE works ADD COLUMN embed_allowed INTEGER NOT NULL DEFAULT 0 CHECK (embed_allowed IN (0, 1))');
  if (!names.includes('links_json')) db.exec("ALTER TABLE works ADD COLUMN links_json TEXT NOT NULL DEFAULT '[]'");
  columns = db.prepare('PRAGMA table_info(works)').all();
  const showColumn = columns.find(row => row.name === 'show');
  if (!showColumn?.notnull) return;

  db.exec(`BEGIN IMMEDIATE;
    DROP INDEX IF EXISTS works_public_order;
    ALTER TABLE works RENAME TO works_legacy;
    ${worksSchema};
    INSERT INTO works (
      id, slug, title, display_title, kind, category, status, role, summary, theme, orientation,
      live_url, embed_allowed, links_json, poster, reveal_json, featured_order, catalogue_order, show, updated_at
    ) SELECT
      id, slug, title, display_title, kind, category, status, role, summary, theme, orientation,
      live_url, embed_allowed, links_json, poster, reveal_json, featured_order, catalogue_order, show, updated_at
    FROM works_legacy;
    DROP TABLE works_legacy;
    COMMIT;
  `);
}


function seed(db) {
  const insert = db.prepare(`INSERT OR IGNORE INTO works
    (id, slug, title, display_title, kind, category, status, role, summary, theme, orientation,
      live_url, embed_allowed, links_json, poster, reveal_json, featured_order, catalogue_order, show)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const w of seedWorks) insert.run(
    w.id, w.slug, w.title, w.display_title ?? null, w.kind, w.category, w.status, w.role,
    w.summary, w.theme, w.orientation ?? 'portrait', w.live_url ?? null, w.embed_allowed ?? 0, w.links_json ?? '[]',
    w.poster ?? null, w.reveal_json ?? '[]', w.featured_order ?? null, w.catalogue_order, w.show
  );

  const revision = db.prepare("SELECT value FROM site_settings WHERE key = 'content_revision'").get()?.value;
  if (revision === contentRevision) return;
  const update = db.prepare(`UPDATE works SET
    slug = ?, title = ?, display_title = ?, kind = ?, category = ?, status = ?, role = ?, summary = ?,
    theme = ?, orientation = ?, live_url = ?, embed_allowed = ?, links_json = ?, poster = ?, reveal_json = ?,
    featured_order = ?, catalogue_order = ?, show = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const w of seedWorks) update.run(
      w.slug, w.title, w.display_title ?? null, w.kind, w.category, w.status, w.role, w.summary,
      w.theme, w.orientation ?? 'portrait', w.live_url ?? null, w.embed_allowed ?? 0, w.links_json ?? '[]', w.poster ?? null,
      w.reveal_json ?? '[]', w.featured_order ?? null, w.catalogue_order, w.show, w.id
    );
    db.prepare("UPDATE works SET show = 0 WHERE id IN ('ycs-miniapp', 'ycs-site', 'ycs-easter-eggs', 'documents', 'dota-huds', 'statistics-extension', 'wb-cards', 'sparrow')").run();
    db.prepare("INSERT INTO site_settings (key, value) VALUES ('content_revision', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(contentRevision);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function safeArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function mapPublic(row) {
  return {
    id: row.id, slug: row.slug, title: row.title, displayTitle: row.display_title || row.title, kind: row.kind,
    category: row.category, status: row.status, role: row.role,
    summary: row.summary, theme: row.theme, orientation: row.orientation,
    liveUrl: row.live_url, embedAllowed: row.embed_allowed === 1, links: safeArray(row.links_json), poster: row.poster,
    reveal: safeArray(row.reveal_json), featuredOrder: row.featured_order
  };
}

const publicColumns = `id, slug, title, display_title, kind, category, status, role, summary, theme,
  orientation, live_url, embed_allowed, links_json, poster, reveal_json, featured_order`;

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

function syncEnvironmentContacts(db) {
  db.exec("CREATE TABLE IF NOT EXISTS env_managed_contacts (key TEXT PRIMARY KEY)");
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

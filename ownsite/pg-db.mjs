import { Pool } from 'pg';

const publicColumns = `id, slug, title, display_title, kind, category, status, role, summary, theme,
  orientation, live_url, poster, reveal_json, tools_json, featured_order`;

const insertWork = `INSERT INTO works
  (id, slug, title, display_title, kind, category, status, role, summary, theme, orientation,
    live_url, poster, reveal_json, tools_json, featured_order, catalogue_order, show)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
    $14::jsonb, $15::jsonb, $16, $17, $18)
  ON CONFLICT (id) DO NOTHING`;

function jsonArray(value, field) {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value ?? [];
  if (!Array.isArray(parsed)) throw new TypeError(`${field} must be an array`);
  return parsed;
}

export function mapPostgresPublicWork(row) {
  return {
    id: row.id, slug: row.slug, title: row.title,
    displayTitle: row.display_title || row.title, kind: row.kind,
    category: row.category, status: row.status, role: row.role,
    summary: row.summary, theme: row.theme, orientation: row.orientation,
    liveUrl: row.live_url, poster: row.poster,
    reveal: jsonArray(row.reveal_json, 'reveal_json'),
    tools: jsonArray(row.tools_json, 'tools_json'),
    featuredOrder: row.featured_order
  };
}

function validContactValue(key, value) {
  if (typeof value !== 'string') return false;
  if (key === 'phone') return /^\+[0-9]{10,15}$/.test(value);
  if (key === 'telegram') return /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\/?$/.test(value);
  if (key === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return false;
}

async function migrateAndSeed(pool, seedWorks, contactSettings) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialise startup migrations and seeds across overlapping app deployments.
    await client.query('SELECT pg_advisory_xact_lock(892761, 1)');
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const { rows: versions } = await client.query('SELECT version FROM schema_migrations WHERE version = 1');
    if (!versions.length) {
      await client.query(`CREATE TABLE IF NOT EXISTS works (
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
        reveal_json JSONB NOT NULL DEFAULT '[]'::jsonb
          CHECK (jsonb_typeof(reveal_json) = 'array'),
        tools_json JSONB NOT NULL DEFAULT '[]'::jsonb
          CHECK (jsonb_typeof(tools_json) = 'array'),
        featured_order INTEGER,
        catalogue_order INTEGER NOT NULL DEFAULT 0,
        show BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
      await client.query(`CREATE INDEX IF NOT EXISTS works_public_order
        ON works (show, featured_order, catalogue_order, slug)`);
      await client.query(`CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`);
      await client.query('INSERT INTO schema_migrations (version) VALUES (1)');
    }
    await client.query('CREATE TABLE IF NOT EXISTS env_managed_contacts (key TEXT PRIMARY KEY)');

    for (const work of seedWorks) {
      await client.query(insertWork, [
        work.id, work.slug, work.title, work.display_title ?? null,
        work.kind, work.category, work.status, work.role, work.summary, work.theme,
        work.orientation ?? 'portrait', work.live_url ?? null, work.poster ?? null,
        JSON.stringify(jsonArray(work.reveal_json, 'reveal_json')),
        JSON.stringify(jsonArray(work.tools_json, 'tools_json')),
        work.featured_order ?? null, work.catalogue_order ?? 0,
        work.show === true || work.show === 1
      ]);
    }

    for (const key of ['phone', 'email']) {
      const value = contactSettings[key];
      if (validContactValue(key, value)) {
        await client.query(`INSERT INTO site_settings (key, value) VALUES ($1, $2)
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [key, value]);
        await client.query('INSERT INTO env_managed_contacts (key) VALUES ($1) ON CONFLICT (key) DO NOTHING', [key]);
      } else {
        await client.query(`DELETE FROM site_settings WHERE key = $1
          AND EXISTS (SELECT 1 FROM env_managed_contacts WHERE key = $1)`, [key]);
        await client.query('DELETE FROM env_managed_contacts WHERE key = $1', [key]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* Keep the original failure. */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function openPostgres(connectionString, seedWorks = [], contactSettings = {}) {
  if (typeof connectionString !== 'string' || !connectionString) {
    throw new TypeError('PostgreSQL connection string is required');
  }
  let address;
  try { address = new URL(connectionString); } catch { /* Report without leaking credentials. */ }
  if (!address || !['postgres:', 'postgresql:'].includes(address.protocol) || !address.hostname) {
    throw new TypeError('Invalid PostgreSQL connection string');
  }

  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
  pool.on('error', () => process.stderr.write('PostgreSQL idle connection failed\n'));
  try {
    await migrateAndSeed(pool, seedWorks, contactSettings);
  } catch (error) {
    await pool.end();
    throw error;
  }

  return {
    async publicWorks() {
      const { rows } = await pool.query(`SELECT ${publicColumns} FROM works WHERE show = TRUE
        ORDER BY featured_order ASC NULLS LAST, catalogue_order, slug`);
      return rows.map(mapPostgresPublicWork);
    },
    async publicWork(slug) {
      const { rows } = await pool.query(`SELECT ${publicColumns} FROM works
        WHERE slug = $1 AND show = TRUE`, [slug]);
      return rows.length ? mapPostgresPublicWork(rows[0]) : null;
    },
    async publicContacts() {
      const { rows } = await pool.query(`SELECT key, value FROM site_settings
        WHERE key IN ('phone', 'telegram', 'email')`);
      const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
      const links = [];
      if (validContactValue('phone', values.phone)) {
        links.push({ label: 'Позвонить', href: `tel:${values.phone}` });
      }
      if (validContactValue('telegram', values.telegram)) {
        links.push({ label: 'Написать в Telegram', href: values.telegram });
      }
      if (validContactValue('email', values.email)) {
        links.push({ label: 'Написать письмо', href: `mailto:${values.email}` });
      }
      return links;
    },
    async close() { await pool.end(); }
  };
}

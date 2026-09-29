import { resolve } from 'node:path';
import { openDatabase, validContactValue } from '../db.mjs';

const [key, value] = process.argv.slice(2);
if (!validContactValue(key, value)) {
  process.stderr.write('Usage: node scripts/set-contact.mjs phone|telegram|email VALUE\n');
  process.exit(1);
}
const db = openDatabase(process.env.PORTFOLIO_DB || resolve(import.meta.dirname, '..', 'data', 'portfolio.sqlite'));
try {
  db.prepare('INSERT INTO site_settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
  db.prepare('DELETE FROM env_managed_contacts WHERE key = ?').run(key);
  process.stdout.write(`Saved public contact: ${key}\n`);
} finally { db.close(); }

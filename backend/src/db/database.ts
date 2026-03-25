import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';
import { DB_PATH, DATA_DIR, SERVERS_DIR, BACKUPS_DIR, JARS_DIR } from '../config';

let db: Database;

export function getDb(): Database {
  if (!db) throw new Error('DB not initialized');
  return db;
}

export function initDb(): void {
  for (const dir of [DATA_DIR, SERVERS_DIR, BACKUPS_DIR, JARS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(DB_PATH, { create: true });
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const schema = fs.readFileSync(
    path.join(import.meta.dir, 'schema.sql'),
    'utf8'
  );
  db.exec(schema);

  // Migrations for existing databases
  try { db.exec("ALTER TABLE servers ADD COLUMN java_version TEXT NOT NULL DEFAULT '21'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE backups ADD COLUMN type TEXT NOT NULL DEFAULT 'full'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE servers ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE servers ADD COLUMN backup_enabled INTEGER NOT NULL DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE servers ADD COLUMN backup_interval_hours INTEGER NOT NULL DEFAULT 24"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE servers ADD COLUMN backup_retain_count INTEGER NOT NULL DEFAULT 5"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE servers ADD COLUMN backup_last_at TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE servers ADD COLUMN discord_webhook_url TEXT"); } catch { /* already exists */ }
}

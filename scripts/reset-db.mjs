#!/usr/bin/env node
/**
 * reset-db.mjs — wipe the SQLite database (dev use only)
 *
 * Usage:
 *   node scripts/reset-db.mjs [data_dir]
 *
 * Defaults:
 *   data_dir = ./data
 *
 * What it does:
 *   1. Backs up the existing database to backups/db/ (via db-backup.mjs logic)
 *   2. Deletes mc.db so the backend recreates a fresh schema on next start
 *
 * The backend auto-creates the schema on startup, so just restart after this.
 */

import { unlinkSync, copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const ROOT     = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(process.argv[2] ?? join(ROOT, 'data'));
const DB_PATH  = join(DATA_DIR, 'mc.db');
const OUT_DIR  = join(DATA_DIR, 'db-backups');

if (!existsSync(DB_PATH)) {
  console.log('No database found — nothing to reset.');
  process.exit(0);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.question('This will DELETE the database (a backup will be saved first). Continue? [y/N] ', (answer) => {
  rl.close();
  if (answer.toLowerCase() !== 'y') {
    console.log('Aborted.');
    process.exit(0);
  }

  // Backup first
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
  const dest  = join(OUT_DIR, `mc_${stamp}_pre-reset.db`);
  copyFileSync(DB_PATH, dest);
  console.log(`✓ Backed up to ${dest}`);

  // Delete
  unlinkSync(DB_PATH);
  console.log(`✓ Deleted ${DB_PATH}`);
  console.log('Restart the backend (or rebuild Docker) to create a fresh database.');
});

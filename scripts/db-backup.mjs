#!/usr/bin/env node
/**
 * db-backup.mjs — copy the SQLite database to a timestamped backup file
 *
 * Usage:
 *   node scripts/db-backup.mjs [data_dir] [output_dir]
 *
 * Defaults:
 *   data_dir   = ./data
 *   output_dir = ./data/db-backups
 *
 * Output: data/db-backups/mc_YYYY-MM-DD_HH-MM-SS.db
 */

import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT      = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR  = resolve(process.argv[2] ?? join(ROOT, 'data'));
const OUT_DIR   = resolve(process.argv[3] ?? join(DATA_DIR, 'db-backups'));
const DB_PATH   = join(DATA_DIR, 'mc.db');

if (!existsSync(DB_PATH)) {
  console.error(`Database not found: ${DB_PATH}`);
  console.error('Is Spawnpoint running / has it been started at least once?');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const now    = new Date();
const stamp  = now.toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 19);
const dest   = join(OUT_DIR, `mc_${stamp}.db`);

copyFileSync(DB_PATH, dest);
console.log(`✓ Backed up to ${dest}`);

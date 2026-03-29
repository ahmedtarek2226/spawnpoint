#!/usr/bin/env node
/**
 * logs.mjs — filtered Docker Compose log viewer
 *
 * Usage:
 *   node scripts/logs.mjs [filter]
 *
 * Examples:
 *   node scripts/logs.mjs           # all logs (like docker compose logs -f)
 *   node scripts/logs.mjs error     # only lines containing "error" (case-insensitive)
 *   node scripts/logs.mjs warn      # only warnings
 *   node scripts/logs.mjs eWd3Kr8j  # only lines for a specific server ID
 *
 * Ctrl+C to stop.
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT   = join(dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2] ? new RegExp(process.argv[2], 'i') : null;

const RESET  = '\x1b[0m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM    = '\x1b[2m';

function colorLine(line) {
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('fatal'))  return `${RED}${line}${RESET}`;
  if (l.includes('warn'))                           return `${YELLOW}${line}${RESET}`;
  if (l.includes('debug'))                          return `${DIM}${line}${RESET}`;
  return line;
}

const proc = spawn('docker', ['compose', 'logs', '--follow', '--no-log-prefix'], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
});

function handleData(data) {
  const lines = data.toString().replace(/\n$/, '').split('\n');
  for (const line of lines) {
    if (filter && !filter.test(line)) continue;
    process.stdout.write(colorLine(line) + '\n');
  }
}

proc.stdout.on('data', handleData);
proc.stderr.on('data', handleData);

proc.on('exit', (code) => {
  if (code !== null && code !== 0) {
    process.stderr.write(`docker compose logs exited with code ${code}\n`);
  }
});

process.on('SIGINT', () => { proc.kill(); process.exit(0); });

#!/usr/bin/env node
/**
 * dev.mjs — start backend and frontend dev servers concurrently
 *
 * Usage:
 *   node scripts/dev.mjs
 *
 * Backend:  http://localhost:3000  (bun --hot)
 * Frontend: http://localhost:5173  (vite, proxies /api → :3000)
 *
 * Press Ctrl+C to stop both.
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const BLUE   = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';

function prefix(label, color) {
  return (data) => {
    const lines = data.toString().replace(/\n$/, '').split('\n');
    for (const line of lines) {
      process.stdout.write(`${color}[${label}]${RESET} ${line}\n`);
    }
  };
}

function startProcess(label, color, cmd, args, cwd) {
  const proc = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', prefix(label, color));
  proc.stderr.on('data', prefix(label, color));
  proc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      process.stdout.write(`${RED}[${label}] exited with code ${code}${RESET}\n`);
    }
  });
  return proc;
}

console.log(`${GREEN}Starting Spawnpoint dev servers...${RESET}`);
console.log(`${BLUE}[backend]${RESET} http://localhost:3000`);
console.log(`${YELLOW}[frontend]${RESET} http://localhost:5173\n`);

const backend  = startProcess('backend',  BLUE,   'bun', ['--hot', 'run', 'src/index.ts'], join(ROOT, 'backend'));
const frontend = startProcess('frontend', YELLOW, 'npm', ['run', 'dev'],                   join(ROOT, 'frontend'));

function shutdown() {
  console.log(`\n${GREEN}Shutting down...${RESET}`);
  backend.kill();
  frontend.kill();
  process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

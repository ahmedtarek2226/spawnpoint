#!/usr/bin/env node
/**
 * health.mjs — check if Spawnpoint is up and show status
 *
 * Usage:
 *   node scripts/health.mjs [base_url]
 *
 * Defaults:
 *   base_url = http://localhost:3000
 *
 * Exit codes:
 *   0 — healthy
 *   1 — unhealthy or unreachable
 */

const BASE = process.argv[2] ?? 'http://localhost:3000';

const RESET  = '\x1b[0m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

function fmt(label, value, color = '') {
  return `  ${DIM}${label.padEnd(14)}${RESET}${color}${value}${RESET}`;
}

let health, servers;

try {
  const [hRes, sRes] = await Promise.all([
    fetch(`${BASE}/api/health`),
    fetch(`${BASE}/api/servers`),
  ]);
  health  = await hRes.json();
  servers = await sRes.json();
} catch (err) {
  console.error(`${RED}✗ Unreachable${RESET} — ${err.message}`);
  console.error(`  Tried: ${BASE}`);
  process.exit(1);
}

const d = health.data ?? {};
const version = d.version ? `v${d.version}` : 'unknown';
const uptime  = d.uptime  != null ? `${Math.floor(d.uptime)}s` : 'unknown';

console.log(`\n${BOLD}Spawnpoint${RESET} ${DIM}${BASE}${RESET}`);
console.log(fmt('Status',   `${GREEN}● online${RESET}`));
console.log(fmt('Version',  version));
console.log(fmt('Uptime',   uptime));

if (servers?.data) {
  const all     = servers.data;
  const running = all.filter(s => s.runtime?.status === 'running');
  console.log(fmt('Servers',  `${all.length} total, ${running.length} running`));

  if (running.length > 0) {
    for (const sv of running) {
      const ram = sv.runtime?.memoryUsageMb ? `${sv.runtime.memoryUsageMb} MB` : '';
      const players = sv.runtime?.playerCount != null ? `${sv.runtime.playerCount} players` : '';
      const stats = [ram, players].filter(Boolean).join(' · ');
      console.log(`  ${GREEN}▸${RESET} ${sv.name} ${DIM}${stats}${RESET}`);
    }
  }
}

console.log();

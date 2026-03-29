#!/usr/bin/env node
/**
 * screenshot.mjs — capture Spawnpoint UI screenshots
 *
 * Usage:
 *   node scripts/screenshot.mjs [base_url] [server_id]
 *
 * Defaults:
 *   base_url  = http://localhost:3000
 *   server_id = first server returned by /api/servers
 *
 * Prerequisites (one-time, from scripts/ directory):
 *   cd scripts && npm install && npx playwright install chromium
 *
 * Output: screenshots/{dashboard,console,files,new-server,mods}.png
 */

import { chromium } from 'playwright';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE    = process.argv[2] ?? 'http://localhost:3000';
const OUT     = join(ROOT, 'screenshots');

// Resolve server ID: use CLI arg or fetch the first one from the API
let SERVER = process.argv[3];
if (!SERVER) {
  const res  = await fetch(`${BASE}/api/servers`);
  const json = await res.json();
  SERVER = json.data?.[0]?.id;
  if (!SERVER) { console.error('No servers found — start a server first'); process.exit(1); }
  console.log(`Using server: ${json.data[0].name} (${SERVER})`);
}

const browser = await chromium.launch();
const ctx     = await browser.newContext({ viewport: { width: 1400, height: 860 } });
const page    = await ctx.newPage();

async function shot(url, file, waitMs = 800) {
  await page.goto(`${BASE}${url}`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: join(OUT, file) });
  console.log(`✓ ${file}`);
}

await shot('/',                             'dashboard.png');
await shot(`/servers/${SERVER}`,            'console.png');
await shot(`/servers/${SERVER}/files`,      'files.png');
await shot(`/servers/${SERVER}/mods`,       'mods.png');
await shot('/servers/new',                  'new-server.png');

await browser.close();
console.log(`\nAll screenshots saved to ${OUT}`);

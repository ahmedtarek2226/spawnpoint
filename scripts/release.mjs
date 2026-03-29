#!/usr/bin/env node
/**
 * release.mjs — bump version, commit, tag, and push
 *
 * Usage:
 *   node scripts/release.mjs <version>
 *
 * Example:
 *   node scripts/release.mjs 0.7.0
 *
 * What it does:
 *   1. Writes BUILD_VERSION=<version> to .env (creates if missing)
 *   2. Commits all staged + the .env change with message "Release vX.Y.Z"
 *   3. Tags the commit vX.Y.Z
 *   4. Pushes branch + tag to origin
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const version = process.argv[2];
if (!version) {
  console.error('Usage: node scripts/release.mjs <version>');
  console.error('Example: node scripts/release.mjs 0.7.0');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version "${version}" — expected semver like 1.2.3`);
  process.exit(1);
}

const tag = `v${version}`;

function run(cmd) {
  console.log(`$ ${cmd}`);
  return execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function runCapture(cmd) {
  return execSync(cmd, { cwd: ROOT }).toString().trim();
}

// Check for uncommitted changes (excluding .env which we'll update)
const dirty = runCapture('git status --porcelain')
  .split('\n')
  .filter(l => l && !l.endsWith('.env'))
  .join('\n');

if (dirty) {
  console.error('Working tree has uncommitted changes (other than .env). Commit or stash first.');
  console.error(dirty);
  process.exit(1);
}

// Check tag doesn't already exist
try {
  runCapture(`git rev-parse ${tag}`);
  console.error(`Tag ${tag} already exists.`);
  process.exit(1);
} catch { /* tag doesn't exist, continue */ }

// Update BUILD_VERSION in .env
const envPath = join(ROOT, '.env');
let envContent = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';

if (/^BUILD_VERSION=/m.test(envContent)) {
  envContent = envContent.replace(/^BUILD_VERSION=.*/m, `BUILD_VERSION=${version}`);
} else {
  envContent += (envContent.endsWith('\n') || envContent === '' ? '' : '\n') + `BUILD_VERSION=${version}\n`;
}

writeFileSync(envPath, envContent);
console.log(`✓ Set BUILD_VERSION=${version} in .env`);

// Commit and tag
run(`git add .env`);
run(`git commit -m "Release ${tag}"`);
run(`git tag ${tag}`);
console.log(`✓ Tagged ${tag}`);

// Push
run(`git push origin main`);
run(`git push origin ${tag}`);
console.log(`\n✓ Released ${tag}`);

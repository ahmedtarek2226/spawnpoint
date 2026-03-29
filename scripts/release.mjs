#!/usr/bin/env node
/**
 * release.mjs — tag and push a release to trigger the Docker Hub build
 *
 * Usage:
 *   node scripts/release.mjs <version>
 *
 * Example:
 *   node scripts/release.mjs 0.7.0
 *
 * What it does:
 *   1. Checks the working tree is clean
 *   2. Tags HEAD as vX.Y.Z
 *   3. Pushes branch + tag to origin
 *
 * The GitHub Actions release workflow triggers on tag push and passes
 * BUILD_VERSION to Docker Hub automatically via github.ref_name.
 */

import { execSync } from 'child_process';
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

function runCapture(cmd, opts = {}) {
  return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts }).toString().trim();
}

// Check working tree is clean
const dirty = runCapture('git status --porcelain')
  .split('\n')
  .filter(l => l.trim())
  .join('\n');

if (dirty) {
  console.error('Working tree has uncommitted changes. Commit or stash first.');
  console.error(dirty);
  process.exit(1);
}

// Check tag doesn't already exist
try {
  runCapture(`git rev-parse ${tag}`);
  console.error(`Tag ${tag} already exists.`);
  process.exit(1);
} catch { /* tag doesn't exist — good */ }

// Tag and push
run(`git tag ${tag}`);
console.log(`✓ Tagged ${tag}`);

run(`git push origin main`);
run(`git push origin ${tag}`);
console.log(`\n✓ Released ${tag} — Docker Hub build triggered`);
console.log(`  Watch: node scripts/build-watch.mjs`);

import archiver from 'archiver';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { parseProperties } from './FileService';

export interface ModpackInfo {
  name?: string;
  version?: string;
  mcVersion?: string;
  loader?: string;
  loaderVersion?: string;
}

function readTomlField(content: string, key: string): string | undefined {
  const m = content.match(new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return m?.[1] || undefined;
}

/** Detects modpack name/version from common manifest formats. */
export function detectModpackInfo(serverDir: string): ModpackInfo {
  const info: ModpackInfo = {};

  // BCC (BetterCompatibilityChecker) — used by ATM, AllTheMods, etc.
  try {
    const bcc = fs.readFileSync(path.join(serverDir, 'config', 'bcc-common.toml'), 'utf8');
    const name = readTomlField(bcc, 'modpackName');
    const version = readTomlField(bcc, 'modpackVersion');
    if (name) info.name = name;
    if (version) info.version = version;
    if (info.name || info.version) return info;
  } catch { /* not present */ }

  // Packwiz pack.toml — common format for Fabric/Quilt/Forge modpacks
  try {
    const toml = fs.readFileSync(path.join(serverDir, 'pack.toml'), 'utf8');
    const name = readTomlField(toml, 'name');
    const version = readTomlField(toml, 'version');
    if (name) info.name = name;
    if (version) info.version = version;
    // Packwiz versions block: [versions] / minecraft = "x.y.z" / fabric = "x.y.z"
    const mcMatch = toml.match(/^\s*minecraft\s*=\s*"([^"]+)"/m);
    if (mcMatch) info.mcVersion = mcMatch[1];
    const fabricMatch = toml.match(/^\s*fabric\s*=\s*"([^"]+)"/m);
    const forgeMatch = toml.match(/^\s*forge\s*=\s*"([^"]+)"/m);
    const neoforgeMatch = toml.match(/^\s*neoforge\s*=\s*"([^"]+)"/m);
    const quiltMatch = toml.match(/^\s*quilt-loader\s*=\s*"([^"]+)"/m);
    if (fabricMatch) { info.loader = 'fabric'; info.loaderVersion = fabricMatch[1]; }
    else if (neoforgeMatch) { info.loader = 'neoforge'; info.loaderVersion = neoforgeMatch[1]; }
    else if (forgeMatch) { info.loader = 'forge'; info.loaderVersion = forgeMatch[1]; }
    else if (quiltMatch) { info.loader = 'quilt'; info.loaderVersion = quiltMatch[1]; }
    if (info.name || info.version) return info;
  } catch { /* not present */ }

  // FTB server pack — version.json
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(serverDir, 'version.json'), 'utf8'));
    if (raw.name) info.name = raw.name;
    if (raw.version) info.version = String(raw.version);
    if (raw.minecraft) info.mcVersion = raw.minecraft;
    if (info.name || info.version) return info;
  } catch { /* not present */ }


  // CurseForge manifest.json
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(serverDir, 'manifest.json'), 'utf8'));
    if (raw.name) info.name = raw.name;
    if (raw.version) info.version = raw.version;
    if (raw.minecraft?.version) info.mcVersion = raw.minecraft.version;
    if (raw.minecraft?.modLoaders?.[0]?.id) {
      const loaderStr: string = raw.minecraft.modLoaders[0].id;
      const [loader, loaderVer] = loaderStr.split('-');
      info.loader = loader;
      info.loaderVersion = loaderVer;
    }
    if (info.name || info.version) return info;
  } catch { /* not present */ }

  // Modrinth modrinth.index.json
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(serverDir, 'modrinth.index.json'), 'utf8'));
    if (raw.name) info.name = raw.name;
    if (raw.versionId) info.version = raw.versionId;
    if (raw.dependencies?.minecraft) info.mcVersion = raw.dependencies.minecraft;
    const loaderEntry = Object.entries(raw.dependencies ?? {}).find(([k]) => k !== 'minecraft');
    if (loaderEntry) { info.loader = loaderEntry[0]; info.loaderVersion = loaderEntry[1] as string; }
    if (info.name || info.version) return info;
  } catch { /* not present */ }

  // MultiMC / Prism mmc-pack.json
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(serverDir, 'mmc-pack.json'), 'utf8'));
    const mc = raw.components?.find((c: { uid: string }) => c.uid === 'net.minecraft');
    if (mc?.version) info.mcVersion = mc.version;
    const forge = raw.components?.find((c: { uid: string }) => c.uid === 'net.minecraftforge');
    const fabric = raw.components?.find((c: { uid: string }) => c.uid === 'net.fabricmc.fabric-loader');
    const neo = raw.components?.find((c: { uid: string }) => c.uid === 'net.neoforged');
    if (forge) { info.loader = 'forge'; info.loaderVersion = forge.version; }
    else if (neo) { info.loader = 'neoforge'; info.loaderVersion = neo.version; }
    else if (fabric) { info.loader = 'fabric'; info.loaderVersion = fabric.version; }
  } catch { /* not present */ }

  // itzg/minecraft-server loader manifests (fallback — gives MC + loader versions)
  if (!info.loader) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(serverDir, '.fabric-manifest.json'), 'utf8'));
      if (!info.mcVersion && raw.origin?.game) info.mcVersion = raw.origin.game;
      info.loader = 'fabric';
      if (raw.origin?.loader) info.loaderVersion = raw.origin.loader;
    } catch { /* not present */ }
  }
  if (!info.loader) {
    const neoforgeManifests = [
      { file: '.neoforge-manifest.json', loader: 'neoforge', mcKey: 'minecraftVersion', verKey: 'forgeVersion' },
      { file: '.forge-manifest.json',    loader: 'forge',    mcKey: 'minecraftVersion', verKey: 'forgeVersion' },
    ];
    for (const { file, loader, mcKey, verKey } of neoforgeManifests) {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(serverDir, file), 'utf8'));
        if (!info.mcVersion && raw[mcKey]) info.mcVersion = raw[mcKey];
        info.loader = loader;
        if (raw[verKey]) info.loaderVersion = raw[verKey];
        break;
      } catch { /* not present */ }
    }
  }
  if (!info.loader) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(serverDir, '.papermc-manifest.json'), 'utf8'));
      if (!info.mcVersion && raw.minecraftVersion) info.mcVersion = raw.minecraftVersion;
      info.loader = raw.project ?? 'paper';
      if (raw.build) info.loaderVersion = String(raw.build);
    } catch { /* not present */ }
  }

  // MC version from server.properties as last resort
  if (!info.mcVersion) {
    try {
      const props = parseProperties(fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8'));
      if (props['mc-version'] || props['version']) info.mcVersion = props['mc-version'] ?? props['version'];
    } catch { /* not present */ }
  }

  return info;
}

/** Returns world directory names under serverDir.
 *  Scans for level.dat — every Minecraft world root (vanilla, Spigot, or mod-added)
 *  always contains one. Checks top-level dirs and one level deeper to catch worlds
 *  nested inside a parent directory (e.g. some modpacks use saves/worldName/). */
export function detectWorldDirs(serverDir: string): string[] {
  let levelName = 'world';
  try {
    const props = parseProperties(fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8'));
    if (props['level-name']) levelName = props['level-name'];
  } catch { /* no server.properties yet */ }

  const found = new Set<string>();

  let entries: string[] = [];
  try { entries = fs.readdirSync(serverDir); } catch { return []; }

  for (const entry of entries) {
    const full = path.join(serverDir, entry);
    try { if (!fs.statSync(full).isDirectory()) continue; } catch { continue; }

    // Direct hit: level.dat in this top-level dir
    if (fs.existsSync(path.join(full, 'level.dat'))) {
      found.add(entry);
      continue;
    }

    // One level deeper — catches layouts like saves/worldName/level.dat
    let sub: string[] = [];
    try { sub = fs.readdirSync(full); } catch { continue; }
    for (const child of sub) {
      const childFull = path.join(full, child);
      try { if (!fs.statSync(childFull).isDirectory()) continue; } catch { continue; }
      if (fs.existsSync(path.join(childFull, 'level.dat'))) {
        found.add(`${entry}/${child}`);
      }
    }
  }

  // Order: standard names first, then extras alphabetically
  const standard = [levelName, `${levelName}_nether`, `${levelName}_the_end`];
  const ordered = standard.filter((d) => found.has(d));
  const extras = [...found].filter((d) => !standard.includes(d)).sort();
  return [...ordered, ...extras];
}

export async function createBackupArchive(serverDir: string, outputPath: string): Promise<number> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('tar', { gzip: true });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);

    archive.pipe(output);
    archive.directory(serverDir, false);
    archive.finalize();
  });
}

export async function createWorldBackupArchive(serverDir: string, outputPath: string): Promise<number> {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const worldDirs = detectWorldDirs(serverDir);
  if (worldDirs.length === 0) throw new Error('No world directories found — has the server started at least once?');

  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver('tar', { gzip: true });

    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);

    archive.pipe(output);
    for (const dir of worldDirs) {
      archive.directory(path.join(serverDir, dir), dir);
    }
    archive.finalize();
  });
}

async function execFile(cmd: string, args: string[]): Promise<{ stdout: string }> {
  const { execFile: _execFile } = await import('child_process');
  const { promisify } = await import('util');
  return promisify(_execFile)(cmd, args);
}

/** Throws if any entry in the tar archive contains path traversal sequences. */
async function assertNoPathTraversal(archivePath: string): Promise<void> {
  const { stdout } = await execFile('tar', ['-tzf', archivePath]);
  const unsafe = stdout.split('\n').filter((e) => e.includes('..'));
  if (unsafe.length > 0) {
    throw new Error(`Archive contains unsafe paths: ${unsafe.slice(0, 3).join(', ')}`);
  }
}

export async function restoreBackupArchive(archivePath: string, serverDir: string, type: 'full' | 'world'): Promise<void> {
  // Zip-slip guard: reject archives with path traversal entries before extracting
  await assertNoPathTraversal(archivePath);

  if (type === 'full') {
    fs.mkdirSync(serverDir, { recursive: true });
    // Wipe and restore entire directory
    if (fs.existsSync(serverDir)) fs.rmSync(serverDir, { recursive: true });
    fs.mkdirSync(serverDir, { recursive: true });
    await execFile('tar', ['-xzf', archivePath, '-C', serverDir]);
  } else {
    // World-only: delete existing world dirs then extract
    const worldDirs = detectWorldDirs(serverDir);
    // Also remove dirs that will be restored even if they don't exist yet
    const { stdout } = await execFile('tar', ['-tzf', archivePath]);
    const dirsInArchive = stdout
      .split('\n')
      .filter((l) => l.includes('/') || l.trim() !== '')
      .map((l) => l.split('/')[0])
      .filter((v, i, a) => v && a.indexOf(v) === i);

    for (const dir of [...new Set([...worldDirs, ...dirsInArchive])]) {
      const full = path.join(serverDir, dir);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true });
    }

    fs.mkdirSync(serverDir, { recursive: true });
    await execFile('tar', ['-xzf', archivePath, '-C', serverDir]);
  }
}

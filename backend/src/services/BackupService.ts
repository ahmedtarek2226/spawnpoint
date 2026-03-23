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

  // BCC (BetterCompatibilityChecker) — used by ATM, AllTheMons, etc.
  try {
    const bcc = fs.readFileSync(path.join(serverDir, 'config', 'bcc-common.toml'), 'utf8');
    const name = readTomlField(bcc, 'modpackName');
    const version = readTomlField(bcc, 'modpackVersion');
    if (name) info.name = name;
    if (version) info.version = version;
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
  const loaderManifests = [
    { file: '.neoforge-manifest.json', loader: 'neoforge', mcKey: 'minecraftVersion', verKey: 'forgeVersion' },
    { file: '.forge-manifest.json',    loader: 'forge',    mcKey: 'minecraftVersion', verKey: 'forgeVersion' },
    { file: '.fabric.env',             loader: 'fabric',   mcKey: null,               verKey: null },
  ];
  for (const { file, loader, mcKey, verKey } of loaderManifests) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(serverDir, file), 'utf8'));
      if (!info.mcVersion && mcKey && raw[mcKey]) info.mcVersion = raw[mcKey];
      if (!info.loader) {
        info.loader = loader;
        if (verKey && raw[verKey]) info.loaderVersion = raw[verKey];
      }
      break;
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

/** Returns the world directory names that exist under serverDir. */
export function detectWorldDirs(serverDir: string): string[] {
  let levelName = 'world';
  try {
    const props = parseProperties(fs.readFileSync(path.join(serverDir, 'server.properties'), 'utf8'));
    if (props['level-name']) levelName = props['level-name'];
  } catch { /* no server.properties yet — use default */ }

  const candidates = [levelName, `${levelName}_nether`, `${levelName}_the_end`];
  return candidates.filter((d) => {
    const p = path.join(serverDir, d);
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  });
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

export async function restoreBackupArchive(archivePath: string, serverDir: string, type: 'full' | 'world'): Promise<void> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  if (type === 'full') {
    fs.mkdirSync(serverDir, { recursive: true });
    // Wipe and restore entire directory
    if (fs.existsSync(serverDir)) fs.rmSync(serverDir, { recursive: true });
    fs.mkdirSync(serverDir, { recursive: true });
    await execAsync(`tar -xzf "${archivePath}" -C "${serverDir}"`);
  } else {
    // World-only: delete existing world dirs then extract
    const worldDirs = detectWorldDirs(serverDir);
    // Also remove dirs that will be restored even if they don't exist yet
    const dirsInArchive = (await execAsync(`tar -tzf "${archivePath}"`)).stdout
      .split('\n')
      .filter((l) => l.includes('/') || l.trim() !== '')
      .map((l) => l.split('/')[0])
      .filter((v, i, a) => v && a.indexOf(v) === i);

    for (const dir of [...new Set([...worldDirs, ...dirsInArchive])]) {
      const full = path.join(serverDir, dir);
      if (fs.existsSync(full)) fs.rmSync(full, { recursive: true });
    }

    fs.mkdirSync(serverDir, { recursive: true });
    await execAsync(`tar -xzf "${archivePath}" -C "${serverDir}"`);
  }
}

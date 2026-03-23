/**
 * Prism Launcher export (.zip) importer.
 *
 * Prism exports an instance as a zip with this structure:
 *   instance.cfg           — instance metadata (name, MCVersion, etc.)
 *   mmc-pack.json          — component list (mod loader + version)
 *   .minecraft/            — the actual game directory
 *     mods/                — mod jars
 *     config/              — mod configs
 *     ...
 *
 * We use yauzl for streaming extraction — handles ZIP64 and large archives.
 */

import yauzl from 'yauzl';
import fs from 'fs';
import path from 'path';

export interface PrismImportResult {
  name: string;
  mcVersion: string;
  serverType: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla';
  loaderVersion?: string;
  javaVersion: string; // detected from instance.cfg JavaVersion field
  modsDir: string;
  mods: string[]; // detected mod jar filenames
}

interface MmcComponent { uid: string; version: string; }
interface MmcPack { components: MmcComponent[]; }
interface InstanceCfg { name?: string; MCVersion?: string; javaVersion?: string; }

function parseInstanceCfg(raw: string): InstanceCfg {
  const result: InstanceCfg = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key === 'name') result.name = val;
    if (key === 'MCVersion') result.MCVersion = val;
    if (key === 'JavaVersion') result.javaVersion = val;
  }
  return result;
}

// Map a full Java version string (e.g. "21.0.7", "17.0.2", "1.8.0_292") to
// the nearest itzg/minecraft-server JAVA_VERSION tag.
const SUPPORTED_JAVA = [8, 11, 17, 21, 22];
function resolveJavaVersion(raw: string | undefined): string {
  if (!raw) return '21';
  // Java 8 was versioned as "1.8.x" historically
  const major = raw.startsWith('1.') ? parseInt(raw.split('.')[1]) : parseInt(raw.split('.')[0]);
  if (isNaN(major)) return '21';
  // Find the highest supported version that is <= the detected major
  let best = SUPPORTED_JAVA[0];
  for (const v of SUPPORTED_JAVA) {
    if (v <= major) best = v;
  }
  return String(best);
}

function detectServerType(components: MmcComponent[]): {
  serverType: PrismImportResult['serverType'];
  loaderVersion?: string;
} {
  for (const c of components) {
    if (c.uid === 'net.fabricmc.fabric-loader') return { serverType: 'fabric', loaderVersion: c.version };
    if (c.uid === 'net.minecraftforge') return { serverType: 'forge', loaderVersion: c.version };
    if (c.uid === 'net.neoforged') return { serverType: 'neoforge', loaderVersion: c.version };
    if (c.uid === 'org.quiltmc.quilt-loader') return { serverType: 'quilt', loaderVersion: c.version };
  }
  return { serverType: 'vanilla' };
}

// Directories that only exist client-side — skip them
const SKIP_PREFIXES = [
  'screenshots/',
  'crash-reports/',
  'logs/',
  'saves/',
  'resourcepacks/',
  'shaderpacks/',
  'journeymap/',
  'replay_recordings/',
];

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

function streamToFile(stream: NodeJS.ReadableStream, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    stream.pipe(out);
    out.on('finish', resolve);
    out.on('error', reject);
    stream.on('error', reject);
  });
}

export async function importPrismExport(zipPath: string, targetDir: string): Promise<PrismImportResult> {
  const metaFiles = new Map<string, Buffer>(); // instance.cfg, mmc-pack.json
  const detectedMods: string[] = [];

  await new Promise<void>((resolve, reject) => {
    // decodeStrings: false allows yauzl to handle non-UTF8 filenames gracefully
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err ?? new Error('Failed to open ZIP archive'));

      zipfile.readEntry();

      zipfile.on('entry', (entry: yauzl.Entry) => {
        const filePath: string = entry.fileName;

        // Skip directory entries
        if (/\/$/.test(filePath)) {
          zipfile.readEntry();
          return;
        }

        // Capture metadata files
        if (filePath === 'instance.cfg' || filePath === 'mmc-pack.json') {
          zipfile.openReadStream(entry, (err, stream) => {
            if (err || !stream) { zipfile.readEntry(); return; }
            streamToBuffer(stream)
              .then((buf) => { metaFiles.set(filePath, buf); zipfile.readEntry(); })
              .catch(() => zipfile.readEntry());
          });
          return;
        }

        // Extract game directory subtree.
        // Prism exports as 'minecraft/' or '.minecraft/' depending on version.
        const mcPrefixes = ['.minecraft/', 'minecraft/'];
        const matchedPrefix = mcPrefixes.find((p) => filePath.startsWith(p));
        if (matchedPrefix) {
          const relative = filePath.slice(matchedPrefix.length);
          if (!relative || SKIP_PREFIXES.some((p) => relative.startsWith(p))) {
            zipfile.readEntry();
            return;
          }

          // Track mod names as we extract them
          if (relative.startsWith('mods/') && relative.endsWith('.jar')) {
            detectedMods.push(path.basename(relative));
          }

          const dest = path.join(targetDir, relative);
          fs.mkdirSync(path.dirname(dest), { recursive: true });

          zipfile.openReadStream(entry, (err, stream) => {
            if (err || !stream) { zipfile.readEntry(); return; }
            streamToFile(stream, dest)
              .then(() => zipfile.readEntry())
              .catch(() => zipfile.readEntry());
          });
          return;
        }

        zipfile.readEntry();
      });

      zipfile.on('end', resolve);
      zipfile.on('error', reject);
    });
  });

  // Parse metadata
  const instanceCfgRaw = metaFiles.get('instance.cfg')?.toString('utf8') ?? '';
  const mmcPackRaw = metaFiles.get('mmc-pack.json')?.toString('utf8') ?? '{"components":[]}';

  const instanceCfg = parseInstanceCfg(instanceCfgRaw);
  const mmcPack: MmcPack = JSON.parse(mmcPackRaw);

  const vanillaComponent = mmcPack.components.find((c) => c.uid === 'net.minecraft');
  const mcVersion = vanillaComponent?.version ?? instanceCfg.MCVersion ?? '1.21.4';
  const { serverType, loaderVersion } = detectServerType(mmcPack.components);
  const name = instanceCfg.name ?? path.basename(zipPath, '.zip');
  const javaVersion = resolveJavaVersion(instanceCfg.javaVersion);

  return { name, mcVersion, serverType, loaderVersion, javaVersion, modsDir: path.join(targetDir, 'mods'), mods: detectedMods.sort() };
}

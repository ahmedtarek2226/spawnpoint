/**
 * CurseForge modpack importer.
 *
 * CurseForge modpack .zip contains:
 *   manifest.json  — metadata + list of { projectID, fileID, required }
 *   overrides/     — files placed directly into the game directory
 *
 * Mods are NOT bundled — each file ID must be resolved via the CF API to get
 * a download URL. Files where the author disabled third-party distribution
 * have downloadUrl === null and are skipped.
 */

import yauzl from 'yauzl';
import fs from 'fs';
import path from 'path';
import { cfPost, cfGet } from './CurseForgeClient';

export interface CfModpackImportResult {
  name: string;
  version: string;
  mcVersion: string;
  serverType: 'fabric' | 'forge' | 'neoforge' | 'quilt' | 'vanilla';
  loaderVersion?: string;
  modsDownloaded: number;
  modsSkipped: number;
}

interface CfManifest {
  name: string;
  version: string;
  minecraft: {
    version: string;
    modLoaders: { id: string; primary: boolean }[];
  };
  files: { projectID: number; fileID: number; required: boolean }[];
  overrides?: string;
}

interface CfFileObject {
  id: number;
  modId: number;
  fileName: string;
  downloadUrl: string | null;
}

const SKIP_OVERRIDE_PREFIXES = [
  'screenshots/', 'crash-reports/', 'logs/', 'saves/',
  'resourcepacks/', 'shaderpacks/', 'replay_recordings/',
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

export async function importCurseForgeModpack(
  zipPath: string,
  targetDir: string,
): Promise<CfModpackImportResult> {
  let manifestBuf: Buffer | null = null;
  const overridePrefix = 'overrides/';

  // Extract manifest + overrides in one pass
  await new Promise<void>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('Failed to open zip'));
      zip.readEntry();

      zip.on('entry', (entry: yauzl.Entry) => {
        const name: string = entry.fileName;
        if (/\/$/.test(name)) { zip.readEntry(); return; }

        if (name === 'manifest.json') {
          zip.openReadStream(entry, (e, stream) => {
            if (e || !stream) { zip.readEntry(); return; }
            streamToBuffer(stream)
              .then((b) => { manifestBuf = b; zip.readEntry(); })
              .catch(() => zip.readEntry());
          });
          return;
        }

        if (name.startsWith(overridePrefix)) {
          const relative = name.slice(overridePrefix.length);
          if (!relative || SKIP_OVERRIDE_PREFIXES.some((p) => relative.startsWith(p))) {
            zip.readEntry(); return;
          }
          const dest = path.join(targetDir, relative);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          zip.openReadStream(entry, (e, stream) => {
            if (e || !stream) { zip.readEntry(); return; }
            streamToFile(stream, dest)
              .then(() => zip.readEntry())
              .catch(() => zip.readEntry());
          });
          return;
        }

        zip.readEntry();
      });

      zip.on('end', resolve);
      zip.on('error', reject);
    });
  });

  if (!manifestBuf) throw new Error('manifest.json not found in modpack zip');

  const manifest: CfManifest = JSON.parse(manifestBuf.toString('utf8'));
  const mcVersion = manifest.minecraft?.version ?? '1.21';
  const primaryLoader = manifest.minecraft?.modLoaders?.find((l) => l.primary) ?? manifest.minecraft?.modLoaders?.[0];

  let serverType: CfModpackImportResult['serverType'] = 'vanilla';
  let loaderVersion: string | undefined;

  if (primaryLoader) {
    const [loaderName, lv] = primaryLoader.id.split('-');
    loaderVersion = lv;
    if (loaderName === 'forge')    serverType = 'forge';
    else if (loaderName === 'fabric')   serverType = 'fabric';
    else if (loaderName === 'neoforge') serverType = 'neoforge';
    else if (loaderName === 'quilt')    serverType = 'quilt';
  }

  // Batch-resolve file download URLs (groups of 50 to stay within API limits)
  const required = manifest.files.filter((f) => f.required);
  const fileIdToProjectId = new Map<number, number>(required.map((f) => [f.fileID, f.projectID]));
  const allFileIds = required.map((f) => f.fileID);

  const resolvedFiles: CfFileObject[] = [];
  const BATCH = 50;
  for (let i = 0; i < allFileIds.length; i += BATCH) {
    const batch = allFileIds.slice(i, i + BATCH);
    try {
      const resp = await cfPost<{ data: CfFileObject[] }>('/mods/files', { fileIds: batch });
      resolvedFiles.push(...resp.data);
    } catch { /* skip batch on error */ }
  }

  // Download server-side mods
  let modsDownloaded = 0;
  let modsSkipped = 0;

  for (const file of resolvedFiles) {
    if (!file.downloadUrl) { modsSkipped++; continue; }

    const projectId = fileIdToProjectId.get(file.id);
    if (!projectId) { modsSkipped++; continue; }

    const dest = path.join(targetDir, 'mods', file.fileName);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    try {
      const res = await fetch(file.downloadUrl, { headers: { 'User-Agent': 'Spawnpoint/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      modsDownloaded++;
    } catch {
      modsSkipped++;
    }
  }

  return {
    name: manifest.name,
    version: manifest.version ?? '1.0.0',
    mcVersion,
    serverType,
    loaderVersion,
    modsDownloaded,
    modsSkipped,
  };
}

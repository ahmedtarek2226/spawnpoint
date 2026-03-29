import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { nanoid } from 'nanoid';
import yauzl from 'yauzl';
import { importPrismExport } from '../services/PrismImporter';
import { importMrpack } from '../services/MrpackImporter';
import { cfEnabled } from '../services/CurseForgeClient';
import { createServer } from '../models/Server';
import { enqueueInstallModrinth, enqueueInstallCurseForge } from '../services/JobRunner';
import { SERVERS_DIR } from '../config';
import { getHostDataDir } from '../services/hostDataDir';

const router = Router();
const upload = multer({ dest: '/tmp/mc-prism-uploads/' });

router.post('/import', upload.single('export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return next(Object.assign(new Error('No export file uploaded'), { status: 400 }));

    const id = nanoid(10);
    const serverLocalDir = path.join(SERVERS_DIR, id);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);

    fs.mkdirSync(serverLocalDir, { recursive: true });

    const result = await importPrismExport(file.path, serverLocalDir);
    fs.unlinkSync(file.path);

    // Override name if user provided one; javaVersion falls back to auto-detected value from instance.cfg
    const name = (req.body.name as string) || result.name;
    const port = parseInt(req.body.port ?? '25565', 10);
    const memoryMb = parseInt(req.body.memoryMb ?? '2048', 10);
    const javaVersion = (req.body.javaVersion as string) || result.javaVersion;

    const server = createServer({
      id,
      name,
      type: result.serverType,
      mcVersion: result.mcVersion,
      port,
      memoryMb,
      jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      javaVersion,
      rconPassword: nanoid(24),
      hostDirectory,
      modpackSource: null,
      modpackProjectId: null,
      modpackVersionId: null,
      modpackSlug: null,
    });

    res.status(201).json({
      success: true,
      data: {
        server,
        importInfo: {
          mcVersion: result.mcVersion,
          serverType: result.serverType,
          loaderVersion: result.loaderVersion,
          javaVersion: result.javaVersion,
          mods: result.mods,
          modsFound: result.mods.length,
        },
      },
    });
  } catch (err) { next(err); }
});

router.post('/import-mrpack', upload.single('export'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return next(Object.assign(new Error('No file uploaded'), { status: 400 }));
    if (!file.originalname.endsWith('.mrpack')) {
      fs.unlinkSync(file.path);
      return next(Object.assign(new Error('Only .mrpack files are accepted'), { status: 400 }));
    }

    const id = nanoid(10);
    const serverLocalDir = path.join(SERVERS_DIR, id);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);

    fs.mkdirSync(serverLocalDir, { recursive: true });

    const result = await importMrpack(file.path, serverLocalDir);
    fs.unlinkSync(file.path);

    const name = (req.body.name as string) || result.name;
    const port = parseInt(req.body.port ?? '25565', 10);
    const memoryMb = parseInt(req.body.memoryMb ?? '2048', 10);
    const javaVersion = (req.body.javaVersion as string) || '21';

    const server = createServer({
      id,
      name,
      type: result.serverType,
      mcVersion: result.mcVersion,
      port,
      memoryMb,
      jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      javaVersion,
      rconPassword: nanoid(24),
      hostDirectory,
      modpackSource: null,
      modpackProjectId: null,
      modpackVersionId: null,
      modpackSlug: null,
    });

    res.status(201).json({
      success: true,
      data: {
        server,
        importInfo: {
          name: result.name,
          versionId: result.versionId,
          mcVersion: result.mcVersion,
          serverType: result.serverType,
          loaderVersion: result.loaderVersion,
          modsDownloaded: result.modsDownloaded,
          modsSkipped: result.modsSkipped,
        },
      },
    });
  } catch (err) { next(err); }
});

// ── Modrinth modpack browser (for new-server flow) ───────────────────────────

const MODPACK_PAGE_SIZE = 20;

router.get('/modpacks/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = (req.query.q as string) ?? '';
    const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;

    const facets = [['project_type:modpack']];
    const params = new URLSearchParams({
      query: q,
      facets: JSON.stringify(facets),
      limit: String(MODPACK_PAGE_SIZE),
      offset: String(offset),
      index: 'relevance',
    });

    const resp = await fetch(`https://api.modrinth.com/v2/search?${params}`, {
      headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' },
    });
    if (!resp.ok) throw new Error(`Modrinth API error: ${resp.status}`);
    const data = await resp.json() as { hits: unknown[]; total_hits: number };

    res.json({ success: true, data: { hits: data.hits, total: data.total_hits } });
  } catch (err) { next(err); }
});

router.get('/modpacks/versions/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resp = await fetch(
      `https://api.modrinth.com/v2/project/${req.params.projectId}/version`,
      { headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' } }
    );
    if (!resp.ok) throw new Error(`Modrinth API error: ${resp.status}`);
    const versions = await resp.json();
    res.json({ success: true, data: versions });
  } catch (err) { next(err); }
});

// Estimate memory by counting mods in the mrpack manifest
function readZipEntry(zipPath: string, entryName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zf) => {
      if (err) return reject(err);
      zf.readEntry();
      zf.on('entry', (entry) => {
        if (entry.fileName === entryName) {
          zf.openReadStream(entry, (e, stream) => {
            if (e || !stream) return reject(e ?? new Error('No stream'));
            const chunks: Buffer[] = [];
            stream.on('data', (c: Buffer) => chunks.push(c));
            stream.on('end', () => { zf.close(); resolve(Buffer.concat(chunks)); });
            stream.on('error', reject);
          });
        } else {
          zf.readEntry();
        }
      });
      zf.on('end', () => reject(new Error(`Entry "${entryName}" not found in zip`)));
      zf.on('error', reject);
    });
  });
}

function suggestMemoryMb(modCount: number): number {
  if (modCount < 30)  return 2048;
  if (modCount < 80)  return 3072;
  if (modCount < 150) return 4096;
  if (modCount < 250) return 6144;
  return 8192;
}

// MC version → minimum Java version required
export function javaForMcVersion(mcVersion: string): string {
  const [, minor, patch] = mcVersion.split('.').map(Number);
  if (minor >= 21) return '21';
  if (minor === 20 && (patch ?? 0) >= 5) return '21';
  if (minor >= 18) return '17';
  if (minor === 17) return '17';
  return '8';
}

router.get('/modpacks/estimate-memory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = (req.query.url as string) ?? '';
    if (!url.startsWith('https://cdn.modrinth.com/')) {
      return next(Object.assign(new Error('Only Modrinth CDN URLs accepted'), { status: 400 }));
    }

    const tmpPath = path.join(os.tmpdir(), `mrpack-est-${nanoid(8)}.mrpack`);
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' } });
      if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
      fs.writeFileSync(tmpPath, Buffer.from(await resp.arrayBuffer()));

      const raw = await readZipEntry(tmpPath, 'modrinth.index.json');
      const index = JSON.parse(raw.toString('utf8')) as {
        files?: { env?: { server?: string } }[];
        dependencies?: Record<string, string>;
      };
      const modCount = (index.files ?? []).filter(f => f.env?.server !== 'unsupported').length;
      const mcVersion = index.dependencies?.minecraft ?? '';
      const suggestedJavaVersion = mcVersion ? javaForMcVersion(mcVersion) : '21';

      res.json({ success: true, data: { modCount, suggestedMemoryMb: suggestMemoryMb(modCount), mcVersion, suggestedJavaVersion } });
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }
  } catch (err) { next(err); }
});

// Install a modpack directly from a Modrinth CDN URL — enqueues a background job
router.post('/install-from-url', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { packUrl, name, port, memoryMb, javaVersion, projectId: bodyProjectId, versionId: bodyVersionId } = req.body as {
      packUrl: string; name?: string; port?: number; memoryMb?: number; javaVersion?: string;
      projectId?: string; versionId?: string;
    };
    if (!packUrl) return next(Object.assign(new Error('packUrl is required'), { status: 400 }));
    if (!packUrl.startsWith('https://cdn.modrinth.com/')) {
      return next(Object.assign(new Error('Only Modrinth CDN URLs are accepted'), { status: 400 }));
    }

    // Parse projectId and versionId from CDN URL:
    // https://cdn.modrinth.com/data/{projectId}/versions/{versionId}/filename.mrpack
    let parsedProjectId: string | null = bodyProjectId ?? null;
    let parsedVersionId: string | null = bodyVersionId ?? null;
    const cdnMatch = packUrl.match(/\/data\/([^/]+)\/versions\/([^/]+)\//);
    if (cdnMatch) {
      parsedProjectId = parsedProjectId ?? cdnMatch[1];
      parsedVersionId = parsedVersionId ?? cdnMatch[2];
    }

    const job = enqueueInstallModrinth({
      packUrl,
      name,
      port,
      memoryMb,
      javaVersion,
      projectId: parsedProjectId,
      versionId: parsedVersionId,
    });

    res.status(202).json({ success: true, data: { jobId: job.id } });
  } catch (err) { next(err); }
});

// Install a CurseForge modpack by project + file ID — enqueues a background job
router.post('/install-from-curseforge', (req: Request, res: Response, next: NextFunction) => {
  if (!cfEnabled()) return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
  try {
    const { projectId, fileId, name, port, memoryMb, javaVersion } = req.body as {
      projectId: number; fileId: number; name?: string; port?: number; memoryMb?: number; javaVersion?: string;
    };
    if (!projectId || !fileId) return next(Object.assign(new Error('projectId and fileId are required'), { status: 400 }));

    const job = enqueueInstallCurseForge({ projectId, fileId, name, port, memoryMb, javaVersion });
    res.status(202).json({ success: true, data: { jobId: job.id } });
  } catch (err) { next(err); }
});

export default router;

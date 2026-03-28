import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { getServer } from '../models/Server';
import { SERVERS_DIR } from '../config';
import {
  cfEnabled, cfGet, cfPost, cfFingerprint,
  LOADER_TYPE, GAME_ID, CLASS_MOD, CLASS_MODPACK,
} from '../services/CurseForgeClient';

// ── Global router (mounted at /api/curseforge) ────────────────────────────────

export const globalRouter = Router();

globalRouter.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: { enabled: cfEnabled() } });
});

const PACK_PAGE_SIZE = 20;

globalRouter.get('/modpacks/search', async (req: Request, res: Response, next: NextFunction) => {
  if (!cfEnabled()) return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
  try {
    const q = (req.query.q as string) ?? '';
    const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;

    const resp = await cfGet<{ data: unknown[]; pagination: { totalCount: number } }>(
      `/mods/search?gameId=${GAME_ID}&classId=${CLASS_MODPACK}&searchFilter=${encodeURIComponent(q)}&pageSize=${PACK_PAGE_SIZE}&index=${offset}&sortField=2&sortOrder=desc`
    );

    res.json({ success: true, data: { hits: resp.data, total: resp.pagination.totalCount } });
  } catch (err) { next(err); }
});

globalRouter.get('/modpacks/versions/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  if (!cfEnabled()) return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
  try {
    const resp = await cfGet<{ data: unknown[] }>(`/mods/${req.params.projectId}/files?pageSize=50&sortField=2&sortOrder=desc`);
    res.json({ success: true, data: resp.data });
  } catch (err) { next(err); }
});

// ── Per-server router (mounted at /api/servers/:id/curseforge) ────────────────

const serverRouter = Router({ mergeParams: true });
export default serverRouter;

const MOD_PAGE_SIZE = 20;

// Only mod-capable loaders are supported by CurseForge
const SUPPORTED_LOADERS = new Set(Object.keys(LOADER_TYPE));

serverRouter.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  if (!cfEnabled()) return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    if (!SUPPORTED_LOADERS.has(server.type)) {
      return res.json({ success: true, data: { hits: [], total: 0 } });
    }

    const q = (req.query.q as string) ?? '';
    const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;
    const loaderType = LOADER_TYPE[server.type] ?? 0;

    const resp = await cfGet<{ data: unknown[]; pagination: { totalCount: number } }>(
      `/mods/search?gameId=${GAME_ID}&classId=${CLASS_MOD}&gameVersion=${encodeURIComponent(server.mcVersion)}&modLoaderType=${loaderType}&searchFilter=${encodeURIComponent(q)}&pageSize=${MOD_PAGE_SIZE}&index=${offset}&sortField=2&sortOrder=desc`
    );

    res.json({ success: true, data: { hits: resp.data, total: resp.pagination.totalCount } });
  } catch (err) { next(err); }
});

serverRouter.get('/versions/:modId', async (req: Request, res: Response, next: NextFunction) => {
  if (!cfEnabled()) return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const loaderType = LOADER_TYPE[server.type] ?? 0;
    const resp = await cfGet<{ data: unknown[] }>(
      `/mods/${req.params.modId}/files?gameVersion=${encodeURIComponent(server.mcVersion)}&modLoaderType=${loaderType}&pageSize=10&sortField=2&sortOrder=desc`
    );
    res.json({ success: true, data: resp.data });
  } catch (err) { next(err); }
});

serverRouter.post('/install', async (req: Request, res: Response, next: NextFunction) => {
  if (!cfEnabled()) return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
  try {
    const { fileUrl, fileName } = req.body as { fileUrl: string; fileName: string };
    if (!fileUrl || !fileName) return next(Object.assign(new Error('fileUrl and fileName are required'), { status: 400 }));
    if (!fileUrl.startsWith('https://edge.forgecdn.net/') && !fileUrl.startsWith('https://mediafilez.forgecdn.net/')) {
      return next(Object.assign(new Error('Only CurseForge CDN URLs are accepted'), { status: 400 }));
    }

    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const serverDir = path.join(SERVERS_DIR, req.params.id);
    const subdir = server.type === 'paper' || server.type === 'spigot' || server.type === 'purpur' ? 'plugins' : 'mods';
    const modsDir = path.join(serverDir, subdir);
    fs.mkdirSync(modsDir, { recursive: true });

    const resp = await fetch(fileUrl, { headers: { 'User-Agent': 'Spawnpoint/1.0' } });
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    fs.writeFileSync(path.join(modsDir, fileName), Buffer.from(await resp.arrayBuffer()));

    res.json({ success: true });
  } catch (err) { next(err); }
});

// Fingerprint all JARs and return map of { projectId: fileName }
serverRouter.get('/installed-ids', async (req: Request, res: Response, next: NextFunction) => {
  if (!cfEnabled()) return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const serverDir = path.join(SERVERS_DIR, req.params.id);
    const subdir = server.type === 'paper' || server.type === 'spigot' || server.type === 'purpur' ? 'plugins' : 'mods';
    const modsDir = path.join(serverDir, subdir);

    if (!fs.existsSync(modsDir)) return res.json({ success: true, data: {} });

    const jars = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'));
    if (!jars.length) return res.json({ success: true, data: {} });

    const fingerprintToFile = new Map<number, string>();
    for (const jar of jars) {
      try {
        const buf = fs.readFileSync(path.join(modsDir, jar));
        fingerprintToFile.set(cfFingerprint(buf), jar);
      } catch { /* skip unreadable files */ }
    }

    const resp = await cfPost<{ data: { exactMatches: { id: number; file: { modId: number; id: number } }[] } }>(
      '/fingerprints',
      { fingerprints: Array.from(fingerprintToFile.keys()) }
    );

    const result: Record<number, string> = {};
    for (const match of resp.data.exactMatches ?? []) {
      const fp = match.id;
      const fileName = fingerprintToFile.get(fp);
      if (fileName) result[match.file.modId] = fileName;
    }

    res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

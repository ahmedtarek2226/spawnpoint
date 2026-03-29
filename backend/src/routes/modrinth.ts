import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getServer } from '../models/Server';
import { SERVERS_DIR } from '../config';
import { ApiError } from '../errors';
import { getModsDir } from '../utils/getModsDir';

const router = Router({ mergeParams: true });

// Loader/project-type mapping by server type
const SERVER_LOADER_MAP: Record<string, { loaders: string[]; projectType: string }> = {
  fabric:      { loaders: ['fabric'],      projectType: 'mod' },
  quilt:       { loaders: ['quilt'],       projectType: 'mod' },
  forge:       { loaders: ['forge'],       projectType: 'mod' },
  neoforge:    { loaders: ['neoforge'],    projectType: 'mod' },
  paper:       { loaders: ['paper'],       projectType: 'plugin' },
  spigot:      { loaders: ['spigot'],      projectType: 'plugin' },
  purpur:      { loaders: ['purpur'],      projectType: 'plugin' },
  bungeecord:  { loaders: ['bungeecord'],  projectType: 'plugin' },
  velocity:    { loaders: ['velocity'],    projectType: 'plugin' },
};

// Search Modrinth
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));

    const q = (req.query.q as string) ?? '';
    const offset = parseInt((req.query.offset as string) ?? '0', 10) || 0;
    const info = SERVER_LOADER_MAP[server.type];
    if (!info) return res.json({ success: true, data: { hits: [], total: 0 } });

    const facets = [
      [`project_type:${info.projectType}`],
      [`game_versions:${server.mcVersion}`],
      info.loaders.map((l) => `categories:${l}`),
    ];

    const params = new URLSearchParams({
      query: q,
      facets: JSON.stringify(facets),
      limit: '20',
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

// Get compatible versions for a project
router.get('/versions/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));

    const info = SERVER_LOADER_MAP[server.type];
    if (!info) return res.json({ success: true, data: [] });

    const params = new URLSearchParams({
      game_versions: JSON.stringify([server.mcVersion]),
      loaders: JSON.stringify(info.loaders),
    });

    const resp = await fetch(
      `https://api.modrinth.com/v2/project/${req.params.projectId}/version?${params}`,
      { headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' } }
    );
    if (!resp.ok) throw new Error(`Modrinth API error: ${resp.status}`);
    const versions = await resp.json();

    res.json({ success: true, data: versions });
  } catch (err) { next(err); }
});

// Identify which installed mods are from Modrinth via SHA1 hash lookup
router.get('/installed-ids', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));

    const modsDir = getModsDir(path.join(SERVERS_DIR, server.id), server.type);

    if (!fs.existsSync(modsDir)) return res.json({ success: true, data: {} });

    const files = fs.readdirSync(modsDir).filter((f) => f.endsWith('.jar'));
    if (files.length === 0) return res.json({ success: true, data: {} });

    // Compute SHA1 of each jar
    const hashes: Record<string, string> = {}; // hash → filename
    for (const file of files) {
      const buf = fs.readFileSync(path.join(modsDir, file));
      const hash = crypto.createHash('sha1').update(buf).digest('hex');
      hashes[hash] = file;
    }

    // Look up project IDs via Modrinth's version_files API
    const resp = await fetch('https://api.modrinth.com/v2/version_files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)',
      },
      body: JSON.stringify({ hashes: Object.keys(hashes), algorithm: 'sha1' }),
    });
    if (!resp.ok) return res.json({ success: true, data: {} });

    const result = await resp.json() as Record<string, { project_id: string }>;

    // Map hash → project_id
    const projectIds: Record<string, string> = {}; // project_id → filename
    for (const [hash, version] of Object.entries(result)) {
      projectIds[version.project_id] = hashes[hash];
    }

    res.json({ success: true, data: projectIds });
  } catch (err) { next(err); }
});

// Install a mod (download primary file into mods/plugins dir)
router.post('/install', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));

    const { fileUrl, fileName } = req.body as { fileUrl: string; fileName: string };
    if (!fileUrl || !fileName) return next(new ApiError('fileUrl and fileName required', 400));

    // Validate URL is from Modrinth CDN
    if (!fileUrl.startsWith('https://cdn.modrinth.com/')) {
      return next(new ApiError('Only Modrinth CDN URLs are accepted', 400));
    }
    // Sanitize filename
    const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._\-]/g, '_');

    const destDir = getModsDir(path.join(SERVERS_DIR, server.id), server.type);
    fs.mkdirSync(destDir, { recursive: true });

    const resp = await fetch(fileUrl, {
      headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' },
    });
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);

    const buffer = Buffer.from(await resp.arrayBuffer());
    fs.writeFileSync(path.join(destDir, safeName), buffer);

    res.json({ success: true, data: { fileName: safeName } });
  } catch (err) { next(err); }
});

export default router;

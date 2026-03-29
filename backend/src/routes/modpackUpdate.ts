import { Router, Request, Response, NextFunction } from 'express';
import { getServer } from '../models/Server';
import { cfEnabled, cfGet } from '../services/CurseForgeClient';
import { enqueueUpdateModpack } from '../services/JobRunner';

const router = Router({ mergeParams: true });

// GET /api/servers/:id/modpack/versions — list available versions for the tracked pack
router.get('/versions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const { modpackSource, modpackProjectId, modpackVersionId, modpackSlug } = server;
    if (!modpackSource || !modpackProjectId) {
      return res.json({ success: true, data: { versions: [] } });
    }

    if (modpackSource === 'modrinth') {
      const resp = await fetch(
        `https://api.modrinth.com/v2/project/${modpackProjectId}/version`,
        { headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' } }
      );
      if (!resp.ok) throw new Error(`Modrinth API error: ${resp.status}`);
      const versions = await resp.json() as Array<{
        id: string; name: string; version_number: string; date_published: string;
        files: { url: string; filename: string; primary: boolean }[];
      }>;

      res.json({
        success: true,
        data: {
          source: 'modrinth',
          slug: modpackSlug,
          current: modpackVersionId,
          versions: versions.map(v => ({
            id: v.id,
            name: v.name,
            versionNumber: v.version_number,
            datePublished: v.date_published,
            isCurrent: v.id === modpackVersionId,
            downloadAvailable: true,
          })),
        },
      });
    } else {
      // CurseForge
      const resp = await cfGet<{
        data: Array<{ id: number; displayName: string; fileName: string; fileDate: string; downloadUrl: string | null }>;
      }>(`/mods/${modpackProjectId}/files?pageSize=50&sortField=5&sortOrder=desc`);

      res.json({
        success: true,
        data: {
          source: 'curseforge',
          slug: modpackSlug,
          current: modpackVersionId,
          versions: resp.data.map(f => ({
            id: String(f.id),
            name: f.displayName,
            versionNumber: f.fileName,
            datePublished: f.fileDate,
            isCurrent: String(f.id) === modpackVersionId,
            downloadAvailable: !!f.downloadUrl,
          })),
        },
      });
    }
  } catch (err) { next(err); }
});

// POST /api/servers/:id/modpack/update — enqueues a background update job
router.post('/update', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const { versionId } = req.body as { versionId: string };
    if (!versionId) return next(Object.assign(new Error('versionId is required'), { status: 400 }));

    if (!server.modpackSource || !server.modpackProjectId) {
      return next(Object.assign(new Error('This server has no tracked modpack source'), { status: 400 }));
    }
    if (server.modpackSource === 'curseforge' && !cfEnabled()) {
      return next(Object.assign(new Error('CurseForge API key not configured'), { status: 503 }));
    }

    const job = enqueueUpdateModpack({ serverId: server.id, versionId });
    res.status(202).json({ success: true, data: { jobId: job.id } });
  } catch (err) { next(err); }
});

export default router;

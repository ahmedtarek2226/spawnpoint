import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { getServer } from '../models/Server';
import { getServerRuntime, sendCommand } from '../services/DockerManager';
import { SERVERS_DIR } from '../config';

const router = Router({ mergeParams: true });

interface OpsEntry { uuid: string; name: string; level: number; bypassesPlayerLimit: boolean; }
interface WhitelistEntry { uuid: string; name: string; }
interface BannedEntry { uuid: string; name: string; source: string; expires: string; reason: string; created: string; }

function readJson<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T[]; } catch { return []; }
}

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const serverDir = path.join(SERVERS_DIR, server.id);
    const rt = getServerRuntime(server.id);

    res.json({
      success: true,
      data: {
        online: rt.playersOnline,
        ops: readJson<OpsEntry>(path.join(serverDir, 'ops.json')),
        whitelist: readJson<WhitelistEntry>(path.join(serverDir, 'whitelist.json')),
        banned: readJson<BannedEntry>(path.join(serverDir, 'banned-players.json')),
      },
    });
  } catch (err) { next(err); }
});

// Generic RCON action — requires server to be running
async function rconAction(
  req: Request, res: Response, next: NextFunction,
  buildCommand: (body: Record<string, string>) => string
) {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
    const rt = getServerRuntime(server.id);
    if (rt.status !== 'running') {
      return next(Object.assign(new Error('Server is not running'), { status: 409 }));
    }
    const cmd = buildCommand(req.body as Record<string, string>);
    await sendCommand(server, cmd);
    res.json({ success: true });
  } catch (err) { next(err); }
}

router.post('/op', (req, res, next) =>
  rconAction(req, res, next, ({ username }) => `op ${username}`)
);

router.post('/deop', (req, res, next) =>
  rconAction(req, res, next, ({ username }) => `deop ${username}`)
);

router.post('/kick', (req, res, next) =>
  rconAction(req, res, next, ({ username, reason }) =>
    reason ? `kick ${username} ${reason}` : `kick ${username}`)
);

router.post('/ban', (req, res, next) =>
  rconAction(req, res, next, ({ username, reason }) =>
    reason ? `ban ${username} ${reason}` : `ban ${username}`)
);

router.post('/pardon', (req, res, next) =>
  rconAction(req, res, next, ({ username }) => `pardon ${username}`)
);

router.post('/whitelist', (req, res, next) =>
  rconAction(req, res, next, ({ username, action }) => `whitelist ${action} ${username}`)
);

export default router;

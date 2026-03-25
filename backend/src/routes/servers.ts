import { Router, Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import { listServers, getServer, createServer, updateServer, deleteServer } from '../models/Server';
import {
  startServer, stopServer, restartServer, killServer,
  getServerRuntime, syncContainerStates
} from '../services/DockerManager';
import { SERVER_TYPES, CrashIssue } from '../types';
import { SERVERS_DIR, BACKUPS_DIR } from '../config';
import { getHostDataDir } from '../services/hostDataDir';
import { safePath, dirSizeSync, readFile, writeFile, parseProperties, stringifyProperties } from '../services/FileService';

const router = Router();

router.get('/', (_req, res) => {
  const servers = listServers().map(s => ({
    ...s,
    runtime: getServerRuntime(s.id),
  }));
  res.json({ success: true, data: servers });
});

router.get('/:id', (req, res, next) => {
  const server = getServer(req.params.id);
  if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
  res.json({ success: true, data: { ...server, runtime: getServerRuntime(server.id) } });
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, type, mcVersion, port, memoryMb, jvmFlags, javaVersion } = req.body as {
      name: string; type: string; mcVersion: string;
      port?: number; memoryMb?: number; jvmFlags?: string; javaVersion?: string;
    };

    if (!name || !type || !mcVersion) {
      return next(Object.assign(new Error('name, type, mcVersion required'), { status: 400 }));
    }
    if (!SERVER_TYPES.includes(type as typeof SERVER_TYPES[number])) {
      return next(Object.assign(new Error(`Invalid server type: ${type}`), { status: 400 }));
    }

    const id = nanoid(10);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);
    fs.mkdirSync(path.join(SERVERS_DIR, id), { recursive: true });

    const server = createServer({
      id,
      name,
      type: type as typeof SERVER_TYPES[number],
      mcVersion,
      port: port ?? 25565,
      memoryMb: memoryMb ?? 2048,
      jvmFlags: jvmFlags ?? '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      javaVersion: javaVersion ?? '21',
      rconPassword: nanoid(24),
      hostDirectory,
    });

    res.status(201).json({ success: true, data: server });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const updated = updateServer(server.id, req.body);

    // If rconPassword changed, propagate to server.properties
    if (req.body.rconPassword && typeof req.body.rconPassword === 'string') {
      const serverDir = path.join(SERVERS_DIR, server.id);
      try {
        const existing = readFile(serverDir, 'server.properties');
        const props = parseProperties(existing);
        props['rcon.password'] = req.body.rconPassword;
        writeFile(serverDir, 'server.properties', stringifyProperties(props));
      } catch { /* file may not exist yet — that's fine, it'll be created on first start */ }
    }

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const rt = getServerRuntime(server.id);
    if (rt.status === 'running' || rt.status === 'starting') {
      await stopServer(server.id);
    }

    if (req.query.wipe === 'true') {
      const serverLocalDir = path.join(SERVERS_DIR, server.id);
      if (fs.existsSync(serverLocalDir)) fs.rmSync(serverLocalDir, { recursive: true });
    }

    deleteServer(server.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Duplicate server (copies all files — server must be stopped)
router.post('/:id/duplicate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const rt = getServerRuntime(server.id);
    if (rt.status !== 'stopped' && rt.status !== 'crashed') {
      return next(Object.assign(new Error('Server must be stopped before duplicating'), { status: 409 }));
    }

    const { nanoid } = await import('nanoid');
    const newId = nanoid(10);
    const srcDir = path.join(SERVERS_DIR, server.id);
    const destDir = path.join(SERVERS_DIR, newId);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', newId);

    fs.cpSync(srcDir, destDir, { recursive: true });

    const copy = createServer({
      ...server,
      id: newId,
      name: `${server.name} (copy)`,
      rconPassword: nanoid(24),
      hostDirectory,
    });

    res.status(201).json({ success: true, data: copy });
  } catch (err) { next(err); }
});

// Disk usage
router.get('/:id/disk-usage', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
    const serverFiles = dirSizeSync(path.join(SERVERS_DIR, server.id));
    const backups = dirSizeSync(path.join(BACKUPS_DIR, server.id));
    res.json({ success: true, data: { serverFiles, backups, total: serverFiles + backups } });
  } catch (err) { next(err); }
});

// Server lifecycle
router.post('/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    // Check for port conflict with another active server
    const conflict = listServers().find((s) => {
      if (s.id === server.id) return false;
      const rt = getServerRuntime(s.id);
      return s.port === server.port && (rt.status === 'running' || rt.status === 'starting');
    });
    if (conflict) {
      return next(Object.assign(
        new Error(`Port ${server.port} is already in use by "${conflict.name}"`),
        { status: 409 }
      ));
    }

    await startServer(server);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
    await stopServer(server.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/restart', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
    await restartServer(server);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/:id/kill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
    await killServer(server.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Remove mods identified in crash diagnosis as client-only, then clear diagnosis
router.post('/:id/fix-crash', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const rt = getServerRuntime(server.id);
    const issues = rt.crashDiagnosis ?? [];
    const removed: string[] = [];

    const serverDir = path.join(SERVERS_DIR, server.id);
    for (const issue of issues as CrashIssue[]) {
      if (issue.type === 'client_only_mod' && issue.modFile) {
        const modPath = safePath(path.join(serverDir, 'mods'), issue.modFile);
        if (fs.existsSync(modPath)) {
          fs.unlinkSync(modPath);
          removed.push(issue.modFile);
        }
      }
    }

    res.json({ success: true, data: { removed } });
  } catch (err) { next(err); }
});

export default router;

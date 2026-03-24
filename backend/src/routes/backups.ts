import { Router, Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { getServer } from '../models/Server';
import { listBackups, getBackup, createBackup, deleteBackup } from '../models/Backup';
import { createBackupArchive, createWorldBackupArchive, restoreBackupArchive, detectWorldDirs, detectModpackInfo } from '../services/BackupService';
import { stopServer, startServer, getServerRuntime } from '../services/DockerManager';
import { SERVERS_DIR, BACKUPS_DIR } from '../config';

const upload = multer({ dest: '/tmp/mc-backups/' });

const router = Router({ mergeParams: true });

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const serverDir = path.join(SERVERS_DIR, server.id);
    const worldDirs = detectWorldDirs(serverDir);
    const modpackInfo = detectModpackInfo(serverDir);

    res.json({
      success: true,
      data: {
        backups: listBackups(req.params.id),
        worldDirs,
        modpackInfo,
      },
    });
  } catch (err) { next(err); }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const label = (req.body.label as string) || new Date().toLocaleString();
    const type: 'full' | 'world' = req.body.type === 'world' ? 'world' : 'full';
    const id = nanoid(10);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const safeName = server.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(BACKUPS_DIR, `${safeName}_${type}_${timestamp}.tar.gz`);
    const serverDir = path.join(SERVERS_DIR, server.id);

    const sizeBytes = type === 'world'
      ? await createWorldBackupArchive(serverDir, filePath)
      : await createBackupArchive(serverDir, filePath);

    const record = createBackup({ id, serverId: server.id, label, filePath, sizeBytes, type });
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.get('/:backupId/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = getBackup(req.params.backupId);
    if (!backup || backup.serverId !== req.params.id) {
      return next(Object.assign(new Error('Backup not found'), { status: 404 }));
    }
    res.download(backup.filePath, path.basename(backup.filePath));
  } catch (err) { next(err); }
});

router.post('/:backupId/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    const backup = getBackup(req.params.backupId);
    if (!backup || backup.serverId !== server.id) {
      return next(Object.assign(new Error('Backup not found'), { status: 404 }));
    }
    if (!fs.existsSync(backup.filePath)) {
      return next(Object.assign(new Error('Backup file missing from disk'), { status: 404 }));
    }

    const rt = getServerRuntime(server.id);
    const wasRunning = rt.status === 'running';
    if (wasRunning) await stopServer(server.id);

    const serverDir = path.join(SERVERS_DIR, server.id);
    await restoreBackupArchive(backup.filePath, serverDir, backup.type);

    if (wasRunning) await startServer(server);

    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/upload', upload.single('file'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));

    if (!req.file) return next(Object.assign(new Error('No file uploaded'), { status: 400 }));

    const originalName = req.file.originalname;
    if (!originalName.endsWith('.tar.gz')) {
      fs.unlinkSync(req.file.path);
      return next(Object.assign(new Error('Only .tar.gz backup files are accepted'), { status: 400 }));
    }

    const id = nanoid(10);
    const destPath = path.join(BACKUPS_DIR, `${server.id}-${id}.tar.gz`);
    fs.renameSync(req.file.path, destPath);

    const type: 'full' | 'world' = originalName.includes('_world_') ? 'world' : 'full';
    const label = originalName.replace(/\.tar\.gz$/, '');
    const sizeBytes = fs.statSync(destPath).size;

    const record = createBackup({ id, serverId: server.id, label, filePath: destPath, sizeBytes, type });
    res.status(201).json({ success: true, data: record });
  } catch (err) { next(err); }
});

router.delete('/:backupId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const backup = getBackup(req.params.backupId);
    if (!backup || backup.serverId !== req.params.id) {
      return next(Object.assign(new Error('Backup not found'), { status: 404 }));
    }
    if (fs.existsSync(backup.filePath)) fs.unlinkSync(backup.filePath);
    deleteBackup(backup.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;

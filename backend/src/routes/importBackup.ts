import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { createServer } from '../models/Server';
import { restoreBackupArchive, detectModpackInfo } from '../services/BackupService';
import { SERVERS_DIR } from '../config';
import { getHostDataDir } from '../services/hostDataDir';

const router = Router();
const upload = multer({ dest: '/tmp/mc-backup-imports/' });

const LOADER_TO_TYPE: Record<string, string> = {
  neoforge: 'neoforge',
  forge: 'forge',
  fabric: 'fabric',
  quilt: 'quilt',
  paper: 'paper',
};

router.post('/import-as-server', upload.single('backup'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) return next(Object.assign(new Error('No file uploaded'), { status: 400 }));
    if (!file.originalname.endsWith('.tar.gz')) {
      fs.unlinkSync(file.path);
      return next(Object.assign(new Error('Only .tar.gz backup files are accepted'), { status: 400 }));
    }

    const id = nanoid(10);
    const serverLocalDir = path.join(SERVERS_DIR, id);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);

    fs.mkdirSync(serverLocalDir, { recursive: true });

    await restoreBackupArchive(file.path, serverLocalDir, 'full');
    fs.unlinkSync(file.path);

    const modpackInfo = detectModpackInfo(serverLocalDir);

    const type = (req.body.type as string) || LOADER_TO_TYPE[modpackInfo.loader ?? ''] || 'vanilla';
    const mcVersion = (req.body.mcVersion as string) || modpackInfo.mcVersion || '1.21';
    const name = (req.body.name as string) || modpackInfo.name || file.originalname.replace(/\.tar\.gz$/, '');
    const port = parseInt(req.body.port ?? '25565', 10);
    const memoryMb = parseInt(req.body.memoryMb ?? '2048', 10);
    const javaVersion = (req.body.javaVersion as string) || '21';

    const server = createServer({
      id,
      name,
      type,
      mcVersion,
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
        detected: modpackInfo,
      },
    });
  } catch (err) { next(err); }
});

export default router;

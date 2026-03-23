import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getServer } from '../models/Server';
import { listDir, readFile, writeFile, deleteEntry, renameEntry, makeDir, parseProperties, stringifyProperties, safePath } from '../services/FileService';
import { SERVERS_DIR } from '../config';

const router = Router({ mergeParams: true });
const upload = multer({ dest: '/tmp/mc-uploads/' });

function serverDir(id: string): string {
  return path.join(SERVERS_DIR, id);
}

function requireServer(req: Request, _res: Response, next: NextFunction): void {
  if (!getServer(req.params.id)) {
    return next(Object.assign(new Error('Server not found'), { status: 404 }));
  }
  next();
}

router.use(requireServer);

// List directory
router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const dir = serverDir(req.params.id);
    const rel = (req.query.path as string) ?? '';
    res.json({ success: true, data: listDir(dir, rel) });
  } catch (err) { next(err); }
});

// Read file content
router.get('/content', (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return next(Object.assign(new Error('path required'), { status: 400 }));
    const content = readFile(serverDir(req.params.id), filePath);
    res.json({ success: true, data: content });
  } catch (err) { next(err); }
});

// Write file content
router.put('/content', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath, content } = req.body as { path: string; content: string };
    if (!filePath || content === undefined) return next(Object.assign(new Error('path and content required'), { status: 400 }));
    writeFile(serverDir(req.params.id), filePath, content);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Upload file(s)
router.post('/upload', upload.array('files'), (req: Request, res: Response, next: NextFunction) => {
  try {
    const destDir = (req.body.path as string) ?? '';
    const files = (req.files as Express.Multer.File[]) ?? [];
    const dir = serverDir(req.params.id);
    for (const f of files) {
      const dest = safePath(dir, path.join(destDir, f.originalname));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      try {
        fs.renameSync(f.path, dest);
      } catch (e: unknown) {
        // rename fails across filesystems (EXDEV) — fall back to copy + delete
        if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
          fs.copyFileSync(f.path, dest);
          fs.unlinkSync(f.path);
        } else {
          throw e;
        }
      }
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Download file
router.get('/download', (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return next(Object.assign(new Error('path required'), { status: 400 }));
    const target = safePath(serverDir(req.params.id), filePath);
    res.download(target);
  } catch (err) { next(err); }
});

// Delete file or dir
router.delete('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: filePath } = req.body as { path: string };
    if (!filePath) return next(Object.assign(new Error('path required'), { status: 400 }));
    deleteEntry(serverDir(req.params.id), filePath);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Rename / move
router.post('/rename', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { from, to } = req.body as { from: string; to: string };
    if (!from || !to) return next(Object.assign(new Error('from and to required'), { status: 400 }));
    renameEntry(serverDir(req.params.id), from, to);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Create directory
router.post('/mkdir', (req: Request, res: Response, next: NextFunction) => {
  try {
    const { path: dirPath } = req.body as { path: string };
    if (!dirPath) return next(Object.assign(new Error('path required'), { status: 400 }));
    makeDir(serverDir(req.params.id), dirPath);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// server.properties helpers
router.get('/properties', (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = readFile(serverDir(req.params.id), 'server.properties');
    res.json({ success: true, data: parseProperties(content) });
  } catch {
    res.json({ success: true, data: {} });
  }
});

router.put('/properties', (req: Request, res: Response, next: NextFunction) => {
  try {
    const props = req.body as Record<string, string>;
    writeFile(serverDir(req.params.id), 'server.properties', stringifyProperties(props));
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Plugins/mods listing
router.get('/mods', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id)!;
    const isPlugin = ['paper', 'spigot', 'purpur'].includes(server.type);
    const dir = isPlugin ? 'plugins' : 'mods';
    const entries = listDir(serverDir(req.params.id), dir).filter(e => !e.isDir);
    res.json({ success: true, data: entries });
  } catch {
    res.json({ success: true, data: [] });
  }
});

export default router;

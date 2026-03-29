import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import yauzl from 'yauzl';
import { getServer } from '../models/Server';
import { listDir, readFile, writeFile, deleteEntry, renameEntry, makeDir, parseProperties, stringifyProperties, safePath } from '../services/FileService';
import { SERVERS_DIR } from '../config';

function extractJarsFromZip(zipPath: string, destDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const extracted: string[] = [];
    yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new Error('Failed to open zip'));
      zip.readEntry();
      zip.on('entry', (entry: yauzl.Entry) => {
        // Only extract top-level .jar files (ignore nested directories)
        const name: string = entry.fileName;
        if (/\/$/.test(name) || !name.toLowerCase().endsWith('.jar') || name.includes('/')) {
          zip.readEntry();
          return;
        }
        const dest = safePath(destDir, path.basename(name));
        zip.openReadStream(entry, (e, stream) => {
          if (e || !stream) { zip.readEntry(); return; }
          const out = fs.createWriteStream(dest);
          stream.pipe(out);
          out.on('finish', () => { extracted.push(path.basename(name)); zip.readEntry(); });
          out.on('error', () => zip.readEntry());
          stream.on('error', () => zip.readEntry());
        });
      });
      zip.on('end', () => resolve(extracted));
      zip.on('error', reject);
    });
  });
}

const router = Router({ mergeParams: true });
const upload = multer({ dest: '/tmp/mc-uploads/', limits: { fieldSize: 20 * 1024 * 1024 } });

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

// Upload file(s) — .jar files are placed directly; .zip files are unpacked and .jar contents extracted
router.post('/upload', upload.array('files'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const destDir = (req.body.path as string) ?? '';
    const files = (req.files as Express.Multer.File[]) ?? [];
    const dir = serverDir(req.params.id);
    const absDestDir = safePath(dir, destDir);
    fs.mkdirSync(absDestDir, { recursive: true });

    const relativePaths: string[] = req.body.relativePaths ? JSON.parse(req.body.relativePaths) : [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const relPath = relativePaths[i] || f.originalname;

      if (f.originalname.toLowerCase().endsWith('.zip') && !relativePaths[i]) {
        await extractJarsFromZip(f.path, absDestDir);
        fs.unlinkSync(f.path);
      } else {
        const dest = safePath(dir, path.join(destDir, relPath));
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        try {
          fs.renameSync(f.path, dest);
        } catch (e: unknown) {
          if ((e as NodeJS.ErrnoException).code === 'EXDEV') {
            fs.copyFileSync(f.path, dest);
            fs.unlinkSync(f.path);
          } else {
            throw e;
          }
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

// Mods that couldn't be auto-downloaded (CF distribution disabled)
router.get('/mods/missing', (req: Request, res: Response) => {
  try {
    const filePath = path.join(serverDir(req.params.id), 'missing-mods.json');
    if (!fs.existsSync(filePath)) return res.json({ success: true, data: [] });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json({ success: true, data });
  } catch {
    res.json({ success: true, data: [] });
  }
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

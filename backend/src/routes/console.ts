import { Router, Request, Response, NextFunction } from 'express';
import { getServer } from '../models/Server';
import { sendCommand, getConsoleBuf } from '../services/DockerManager';

const router = Router({ mergeParams: true });

router.get('/history', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
    const lines = parseInt((req.query.lines as string) ?? '200', 10);
    const buf = getConsoleBuf(server.id);
    res.json({ success: true, data: buf.slice(-lines) });
  } catch (err) { next(err); }
});

router.post('/command', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(Object.assign(new Error('Server not found'), { status: 404 }));
    const { command } = req.body as { command: string };
    if (!command) return next(Object.assign(new Error('command required'), { status: 400 }));
    await sendCommand(server, command);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;

import { ApiError } from '../errors';
import { Router, Request, Response, NextFunction } from 'express';
import { listMessages, getMessage, createMessage, updateMessage, deleteMessage } from '../models/Message';
import { getServer } from '../models/Server';
import { getServerRuntime } from '../services/DockerManager';
import { startScheduler } from '../services/MessageScheduler';

const router = Router({ mergeParams: true });

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));
    res.json({ success: true, data: listMessages(server.id) });
  } catch (err) { next(err); }
});

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));
    const { type, content, intervalMinutes } = req.body as {
      type: 'join' | 'timed'; content: string; intervalMinutes?: number;
    };
    if (!type || !content?.trim()) {
      return next(new ApiError('type and content are required', 400));
    }
    const msg = createMessage(server.id, { type, content: content.trim(), intervalMinutes });
    const rt = getServerRuntime(server.id);
    if (rt.status === 'running') startScheduler(server);
    res.status(201).json({ success: true, data: msg });
  } catch (err) { next(err); }
});

router.patch('/:msgId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));
    const msg = updateMessage(req.params.msgId, req.body);
    if (!msg) return next(new ApiError('Message not found', 404));
    const rt = getServerRuntime(server.id);
    if (rt.status === 'running') startScheduler(server);
    res.json({ success: true, data: msg });
  } catch (err) { next(err); }
});

router.delete('/:msgId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));
    const msg = getMessage(req.params.msgId);
    if (!msg) return next(new ApiError('Message not found', 404));
    deleteMessage(req.params.msgId);
    const rt = getServerRuntime(server.id);
    if (rt.status === 'running') startScheduler(server);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;

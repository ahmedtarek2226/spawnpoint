import { ApiError } from '../errors';
import { Router, Request, Response, NextFunction } from 'express';
import { nanoid } from 'nanoid';
import { getServer } from '../models/Server';
import { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule } from '../models/Schedule';

const router = Router({ mergeParams: true });

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));
    res.json({ success: true, data: listSchedules(server.id) });
  } catch (err) { next(err); }
});

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  try {
    const server = getServer(req.params.id);
    if (!server) return next(new ApiError('Server not found', 404));

    const { action, hour, minute, days, enabled } = req.body as {
      action: string; hour: number; minute?: number; days?: number[]; enabled?: boolean;
    };

    if (!['start', 'stop', 'restart'].includes(action)) {
      return next(new ApiError('action must be "start", "stop", or "restart"', 400));
    }
    if (typeof hour !== 'number' || hour < 0 || hour > 23) {
      return next(new ApiError('hour must be 0–23', 400));
    }

    const schedule = createSchedule({
      id: nanoid(10),
      serverId: server.id,
      action: action as 'start' | 'stop' | 'restart',
      hour,
      minute: minute ?? 0,
      days: days ?? [0, 1, 2, 3, 4, 5, 6],
      enabled: enabled !== false,
    });

    res.status(201).json({ success: true, data: schedule });
  } catch (err) { next(err); }
});

router.patch('/:scheduleId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = getSchedule(req.params.scheduleId);
    if (!schedule || schedule.serverId !== req.params.id) {
      return next(new ApiError('Schedule not found', 404));
    }

    const updated = updateSchedule(schedule.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/:scheduleId', (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedule = getSchedule(req.params.scheduleId);
    if (!schedule || schedule.serverId !== req.params.id) {
      return next(new ApiError('Schedule not found', 404));
    }
    deleteSchedule(schedule.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;

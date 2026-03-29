import { ApiError } from '../errors';
import { Router, Request, Response, NextFunction } from 'express';
import { listJobs, getJob, deleteJob } from '../models/Job';

const router = Router();

// GET /api/jobs — list recent jobs
router.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, data: listJobs() });
});

// GET /api/jobs/:id
router.get('/:id', (req: Request, res: Response, next: NextFunction) => {
  const job = getJob(req.params.id);
  if (!job) return next(new ApiError('Job not found', 404));
  res.json({ success: true, data: job });
});

// DELETE /api/jobs/:id — dismiss a completed/failed job
router.delete('/:id', (req: Request, res: Response, next: NextFunction) => {
  const job = getJob(req.params.id);
  if (!job) return next(new ApiError('Job not found', 404));
  deleteJob(req.params.id);
  res.json({ success: true, data: null });
});

export default router;

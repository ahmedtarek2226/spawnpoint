import { getDb } from '../db/database';
import { nanoid } from 'nanoid';
import type { JobRecord, JobStatus, JobType } from '../types';

interface JobRow {
  id: string;
  type: string;
  status: string;
  label: string;
  server_id: string | null;
  progress: number;
  step: string;
  error: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: JobRow): JobRecord {
  return {
    id: row.id,
    type: row.type as JobType,
    status: row.status as JobStatus,
    label: row.label,
    serverId: row.server_id,
    progress: row.progress,
    step: row.step,
    error: row.error,
    result: row.result ? JSON.parse(row.result) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createJob(data: { id?: string; type: JobType; label: string; serverId?: string | null }): JobRecord {
  const db = getDb();
  const id = data.id ?? nanoid(10);
  db.run(
    `INSERT INTO jobs (id, type, status, label, server_id, progress, step)
     VALUES (?, ?, 'queued', ?, ?, 0, 'Queued')`,
    [id, data.type, data.label, data.serverId ?? null]
  );
  return getJob(id)!;
}

export function getJob(id: string): JobRecord | null {
  const db = getDb();
  const row = db.query<JobRow, [string]>('SELECT * FROM jobs WHERE id = ?').get(id);
  return row ? rowToRecord(row) : null;
}

export function listJobs(limit = 50): JobRecord[] {
  const db = getDb();
  const rows = db.query<JobRow, [number]>('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit);
  return rows.map(rowToRecord);
}

export function updateJob(id: string, patch: {
  status?: JobStatus;
  progress?: number;
  step?: string;
  error?: string;
  result?: unknown;
  serverId?: string;
}): JobRecord | null {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const vals: unknown[] = [];
  if (patch.status !== undefined)   { sets.push('status = ?');    vals.push(patch.status); }
  if (patch.progress !== undefined) { sets.push('progress = ?');  vals.push(patch.progress); }
  if (patch.step !== undefined)     { sets.push('step = ?');      vals.push(patch.step); }
  if (patch.error !== undefined)    { sets.push('error = ?');     vals.push(patch.error); }
  if (patch.result !== undefined)   { sets.push('result = ?');    vals.push(JSON.stringify(patch.result)); }
  if (patch.serverId !== undefined) { sets.push('server_id = ?'); vals.push(patch.serverId); }
  vals.push(id);
  db.run(`UPDATE jobs SET ${sets.join(', ')} WHERE id = ?`, vals);
  return getJob(id);
}

export function deleteJob(id: string): void {
  getDb().run('DELETE FROM jobs WHERE id = ?', [id]);
}

/** At startup, reset any jobs that were left in running/queued state (server crashed mid-job) */
export function resetStaleJobs(): void {
  getDb().run(
    `UPDATE jobs SET status = 'failed', error = 'Server restarted before job completed', updated_at = datetime('now')
     WHERE status IN ('running', 'queued')`
  );
}

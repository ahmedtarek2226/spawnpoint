import { getDb } from '../db/database';

export interface ServerSchedule {
  id: string;
  serverId: string;
  action: 'start' | 'stop';
  hour: number;
  minute: number;
  days: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  enabled: boolean;
  createdAt: string;
}

interface ScheduleRow {
  id: string;
  server_id: string;
  action: string;
  hour: number;
  minute: number;
  days: string;
  enabled: number;
  created_at: string;
}

function rowToSchedule(row: ScheduleRow): ServerSchedule {
  return {
    id: row.id,
    serverId: row.server_id,
    action: row.action as 'start' | 'stop',
    hour: row.hour,
    minute: row.minute,
    days: JSON.parse(row.days ?? '[0,1,2,3,4,5,6]'),
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export function listSchedules(serverId: string): ServerSchedule[] {
  return (getDb()
    .query('SELECT * FROM server_schedules WHERE server_id = $serverId ORDER BY created_at ASC')
    .all({ $serverId: serverId }) as ScheduleRow[])
    .map(rowToSchedule);
}

export function getAllEnabledSchedules(): ServerSchedule[] {
  return (getDb()
    .query('SELECT * FROM server_schedules WHERE enabled = 1')
    .all() as ScheduleRow[])
    .map(rowToSchedule);
}

export function getSchedule(id: string): ServerSchedule | undefined {
  const row = getDb()
    .query('SELECT * FROM server_schedules WHERE id = $id')
    .get({ $id: id }) as ScheduleRow | undefined;
  return row ? rowToSchedule(row) : undefined;
}

export function createSchedule(data: Omit<ServerSchedule, 'createdAt'>): ServerSchedule {
  getDb().query(`
    INSERT INTO server_schedules (id, server_id, action, hour, minute, days, enabled)
    VALUES ($id, $serverId, $action, $hour, $minute, $days, $enabled)
  `).run({
    $id: data.id,
    $serverId: data.serverId,
    $action: data.action,
    $hour: data.hour,
    $minute: data.minute,
    $days: JSON.stringify(data.days),
    $enabled: data.enabled ? 1 : 0,
  });
  return getSchedule(data.id)!;
}

export function updateSchedule(
  id: string,
  patch: Partial<Pick<ServerSchedule, 'action' | 'hour' | 'minute' | 'days' | 'enabled'>>,
): ServerSchedule | undefined {
  const fields: string[] = [];
  const params: Record<string, unknown> = { $id: id };

  if (patch.action !== undefined) { fields.push('action = $action'); params.$action = patch.action; }
  if (patch.hour !== undefined) { fields.push('hour = $hour'); params.$hour = patch.hour; }
  if (patch.minute !== undefined) { fields.push('minute = $minute'); params.$minute = patch.minute; }
  if (patch.days !== undefined) { fields.push('days = $days'); params.$days = JSON.stringify(patch.days); }
  if (patch.enabled !== undefined) { fields.push('enabled = $enabled'); params.$enabled = patch.enabled ? 1 : 0; }

  if (fields.length === 0) return getSchedule(id);
  getDb().query(`UPDATE server_schedules SET ${fields.join(', ')} WHERE id = $id`).run(params);
  return getSchedule(id);
}

export function deleteSchedule(id: string): void {
  getDb().query('DELETE FROM server_schedules WHERE id = $id').run({ $id: id });
}

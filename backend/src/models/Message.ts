import { getDb } from '../db/database';
import { nanoid } from 'nanoid';

export interface ServerMessage {
  id: string;
  serverId: string;
  type: 'join' | 'timed';
  content: string;
  intervalMinutes: number | null;
  enabled: boolean;
  createdAt: string;
}

interface MessageRow {
  id: string;
  server_id: string;
  type: string;
  content: string;
  interval_minutes: number | null;
  enabled: number;
  created_at: string;
}

function rowToMessage(row: MessageRow): ServerMessage {
  return {
    id: row.id,
    serverId: row.server_id,
    type: row.type as 'join' | 'timed',
    content: row.content,
    intervalMinutes: row.interval_minutes,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

export function listMessages(serverId: string): ServerMessage[] {
  return (
    getDb()
      .query('SELECT * FROM server_messages WHERE server_id = $serverId ORDER BY created_at ASC')
      .all({ $serverId: serverId }) as MessageRow[]
  ).map(rowToMessage);
}

export function getMessage(id: string): ServerMessage | undefined {
  const row = getDb()
    .query('SELECT * FROM server_messages WHERE id = $id')
    .get({ $id: id }) as MessageRow | undefined;
  return row ? rowToMessage(row) : undefined;
}

export function createMessage(
  serverId: string,
  data: { type: 'join' | 'timed'; content: string; intervalMinutes?: number | null }
): ServerMessage {
  const id = nanoid(10);
  getDb()
    .query(
      `INSERT INTO server_messages (id, server_id, type, content, interval_minutes, enabled)
       VALUES ($id, $serverId, $type, $content, $intervalMinutes, 1)`
    )
    .run({
      $id: id,
      $serverId: serverId,
      $type: data.type,
      $content: data.content,
      $intervalMinutes: data.intervalMinutes ?? null,
    });
  return getMessage(id)!;
}

export function updateMessage(
  id: string,
  patch: { content?: string; intervalMinutes?: number | null; enabled?: boolean }
): ServerMessage | undefined {
  const fields: string[] = [];
  const params: Record<string, unknown> = { $id: id };

  if (patch.content !== undefined) { fields.push('content = $content'); params.$content = patch.content; }
  if (patch.intervalMinutes !== undefined) { fields.push('interval_minutes = $intervalMinutes'); params.$intervalMinutes = patch.intervalMinutes; }
  if (patch.enabled !== undefined) { fields.push('enabled = $enabled'); params.$enabled = patch.enabled ? 1 : 0; }

  if (fields.length === 0) return getMessage(id);
  getDb().query(`UPDATE server_messages SET ${fields.join(', ')} WHERE id = $id`).run(params);
  return getMessage(id);
}

export function deleteMessage(id: string): void {
  getDb().query('DELETE FROM server_messages WHERE id = $id').run({ $id: id });
}

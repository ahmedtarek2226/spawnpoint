import { getDb } from '../db/database';
import { BackupRecord } from '../types';

interface BackupRow {
  id: string;
  server_id: string;
  label: string;
  file_path: string;
  size_bytes: number;
  type: string;
  created_at: string;
}

function rowToRecord(row: BackupRow): BackupRecord {
  return {
    id: row.id,
    serverId: row.server_id,
    label: row.label,
    filePath: row.file_path,
    sizeBytes: row.size_bytes,
    type: (row.type as BackupRecord['type']) ?? 'full',
    createdAt: row.created_at,
  };
}

export function listBackups(serverId: string): BackupRecord[] {
  return (getDb().query('SELECT * FROM backups WHERE server_id = $serverId ORDER BY created_at DESC').all({ $serverId: serverId }) as BackupRow[]).map(rowToRecord);
}

export function getBackup(id: string): BackupRecord | undefined {
  const row = getDb().query('SELECT * FROM backups WHERE id = $id').get({ $id: id }) as BackupRow | undefined;
  return row ? rowToRecord(row) : undefined;
}

export function createBackup(record: Omit<BackupRecord, 'createdAt'>): BackupRecord {
  getDb().query(`
    INSERT INTO backups (id, server_id, label, file_path, size_bytes, type)
    VALUES ($id, $serverId, $label, $filePath, $sizeBytes, $type)
  `).run({
    $id: record.id,
    $serverId: record.serverId,
    $label: record.label,
    $filePath: record.filePath,
    $sizeBytes: record.sizeBytes,
    $type: record.type,
  });
  return getBackup(record.id)!;
}

export function deleteBackup(id: string): void {
  getDb().query('DELETE FROM backups WHERE id = $id').run({ $id: id });
}

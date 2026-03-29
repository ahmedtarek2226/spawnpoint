import path from 'path';
import fs from 'fs';
import { nanoid } from 'nanoid';
import { listServers, updateServer } from '../models/Server';
import { listBackups, createBackup, deleteBackup } from '../models/Backup';
import { createBackupArchive } from './BackupService';
import { setBackingUp } from './DockerManager';
import { SERVERS_DIR, BACKUPS_DIR } from '../config';

let interval: NodeJS.Timeout | null = null;

export function startBackupScheduler(): void {
  if (interval) return;
  // Check every 5 minutes — backup schedules are hour-granularity so this is plenty
  interval = setInterval(tick, 5 * 60 * 1000);
  console.log('[BackupScheduler] Started');
}

async function tick(): Promise<void> {
  const servers = listServers();
  const now = Date.now();

  for (const server of servers) {
    if (!server.backupEnabled) continue;

    const lastAt = server.backupLastAt ? new Date(server.backupLastAt).getTime() : 0;
    const intervalMs = server.backupIntervalHours * 60 * 60 * 1000;

    if (now - lastAt < intervalMs) continue;

    setBackingUp(server.id, true);
    try {
      await runAutoBackup(server);
    } catch (err) {
      console.error(`[BackupScheduler] Auto-backup failed for "${server.name}":`, err);
    } finally {
      setBackingUp(server.id, false);
    }
  }
}

async function runAutoBackup(server: ReturnType<typeof listServers>[number]): Promise<void> {
  console.log(`[BackupScheduler] Running auto-backup for "${server.name}"`);

  const serverDir = path.join(SERVERS_DIR, server.id);
  const serverBackupDir = path.join(BACKUPS_DIR, server.id);
  fs.mkdirSync(serverBackupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const safeName = server.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filePath = path.join(serverBackupDir, `${safeName}_auto_${timestamp}.tar.gz`);

  const sizeBytes = await createBackupArchive(serverDir, filePath);
  const label = `Auto ${new Date().toLocaleString()}`;

  createBackup({
    id: nanoid(10),
    serverId: server.id,
    label,
    filePath,
    sizeBytes,
    type: 'full',
  });

  updateServer(server.id, { backupLastAt: new Date().toISOString() });

  // Prune oldest auto-backups over the retain limit
  const autoBackups = listBackups(server.id)
    .filter((b) => b.label.startsWith('Auto '))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const toDelete = autoBackups.slice(0, Math.max(0, autoBackups.length - server.backupRetainCount));
  for (const old of toDelete) {
    if (fs.existsSync(old.filePath)) fs.unlinkSync(old.filePath);
    deleteBackup(old.id);
    console.log(`[BackupScheduler] Pruned "${old.label}" for "${server.name}"`);
  }
}

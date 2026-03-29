/**
 * Background job runner.
 * Jobs are stored in SQLite and progress is broadcast over WebSocket.
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { nanoid } from 'nanoid';
import { createJob, updateJob, getJob, type JobRecord } from '../models/Job';
import { broadcastAll } from '../ws/wsServer';
import { importMrpack } from './MrpackImporter';
import { importCurseForgeModpack } from './CurseForgeModpackImporter';
import { cfGet } from './CurseForgeClient';
import { createServer, getServer, updateServer } from '../models/Server';
import { createBackup } from '../models/Backup';
import { createBackupArchive } from './BackupService';
import { stopServer, startServer, getServerRuntime } from './DockerManager';
import { SERVERS_DIR, BACKUPS_DIR } from '../config';
import { getHostDataDir } from './hostDataDir';
import type { JobType } from '../types';

type Progress = (progress: number, step: string) => void;

function emit(job: JobRecord): void {
  broadcastAll({ type: 'job_update', job });
}

async function run(jobId: string, fn: (progress: Progress) => Promise<unknown>): Promise<void> {
  const started = updateJob(jobId, { status: 'running', progress: 0, step: 'Starting…' });
  if (started) emit(started);

  try {
    const progress: Progress = (p, step) => {
      const updated = updateJob(jobId, { progress: p, step });
      if (updated) emit(updated);
    };
    const result = await fn(progress);
    const done = updateJob(jobId, { status: 'done', progress: 100, step: 'Complete', result });
    if (done) emit(done);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const failed = updateJob(jobId, { status: 'failed', step: 'Failed', error });
    if (failed) emit(failed);
  }
}

export function enqueueInstallModrinth(params: {
  packUrl: string;
  name?: string;
  port?: number;
  memoryMb?: number;
  javaVersion?: string;
  projectId?: string | null;
  versionId?: string | null;
}): JobRecord {
  const displayName = params.name ?? 'modpack';
  const job = createJob({ type: 'install_modpack' as JobType, label: `Install ${displayName}` });

  run(job.id, async (progress) => {
    progress(5, 'Downloading pack…');
    const tmpPath = path.join(os.tmpdir(), `mrpack-${nanoid(10)}.mrpack`);
    const resp = await fetch(params.packUrl, { headers: { 'User-Agent': 'Spawnpoint/1.0' } });
    if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
    fs.writeFileSync(tmpPath, Buffer.from(await resp.arrayBuffer()));

    progress(25, 'Installing mods…');
    const id = nanoid(10);
    const serverLocalDir = path.join(SERVERS_DIR, id);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);
    fs.mkdirSync(serverLocalDir, { recursive: true });

    let result;
    try {
      result = await importMrpack(tmpPath, serverLocalDir);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }

    progress(90, 'Creating server…');
    const serverName = params.name || result.name;
    const server = createServer({
      id,
      name: serverName,
      type: result.serverType,
      mcVersion: result.mcVersion,
      port: params.port ?? 25565,
      memoryMb: params.memoryMb ?? 4096,
      jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      javaVersion: params.javaVersion ?? '21',
      rconPassword: nanoid(24),
      hostDirectory,
      modpackSource: 'modrinth',
      modpackProjectId: params.projectId ?? null,
      modpackVersionId: params.versionId ?? null,
      modpackSlug: serverName,
    });

    // Store server ID in job record so frontend can navigate
    updateJob(job.id, { serverId: server.id });
    return { serverId: server.id };
  });

  return getJob(job.id)!;
}

export function enqueueInstallCurseForge(params: {
  projectId: number;
  fileId: number;
  name?: string;
  port?: number;
  memoryMb?: number;
  javaVersion?: string;
}): JobRecord {
  const displayName = params.name ?? 'modpack';
  const job = createJob({ type: 'install_modpack' as JobType, label: `Install ${displayName}` });

  run(job.id, async (progress) => {
    progress(5, 'Fetching download URL…');
    const fileResp = await cfGet<{ data: { downloadUrl: string | null; fileName: string } }>(
      `/mods/${params.projectId}/files/${params.fileId}`
    );
    if (!fileResp.data.downloadUrl) {
      throw new Error('This modpack file is not available for direct download from CurseForge.');
    }

    progress(15, 'Downloading pack…');
    const tmpPath = path.join(os.tmpdir(), `cf-modpack-${nanoid(10)}.zip`);
    const dlResp = await fetch(fileResp.data.downloadUrl, { headers: { 'User-Agent': 'Spawnpoint/1.0' } });
    if (!dlResp.ok) throw new Error(`Download failed: ${dlResp.status}`);
    fs.writeFileSync(tmpPath, Buffer.from(await dlResp.arrayBuffer()));

    progress(25, 'Installing mods…');
    const id = nanoid(10);
    const serverLocalDir = path.join(SERVERS_DIR, id);
    const hostDirectory = path.join(await getHostDataDir(), 'servers', id);
    fs.mkdirSync(serverLocalDir, { recursive: true });

    let result;
    try {
      result = await importCurseForgeModpack(tmpPath, serverLocalDir);
    } finally {
      if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    }

    progress(90, 'Creating server…');
    const serverName = params.name || result.name;
    const server = createServer({
      id,
      name: serverName,
      type: result.serverType,
      mcVersion: result.mcVersion,
      port: params.port ?? 25565,
      memoryMb: params.memoryMb ?? 4096,
      jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
      javaVersion: params.javaVersion ?? '21',
      rconPassword: nanoid(24),
      hostDirectory,
      modpackSource: 'curseforge',
      modpackProjectId: String(params.projectId),
      modpackVersionId: String(params.fileId),
      modpackSlug: serverName,
    });

    updateJob(job.id, { serverId: server.id });
    return { serverId: server.id };
  });

  return getJob(job.id)!;
}

export function enqueueUpdateModpack(params: {
  serverId: string;
  versionId: string;
}): JobRecord {
  const server = getServer(params.serverId);
  const label = server
    ? `Update ${server.modpackSlug ?? server.name}`
    : 'Update modpack';

  const job = createJob({ type: 'update_modpack' as JobType, label, serverId: params.serverId });

  run(job.id, async (progress) => {
    const sv = getServer(params.serverId);
    if (!sv) throw new Error('Server not found');
    if (!sv.modpackSource || !sv.modpackProjectId) throw new Error('No tracked modpack source');

    progress(5, 'Stopping server…');
    const rt = getServerRuntime(sv.id);
    const wasRunning = rt.status === 'running' || rt.status === 'starting';
    if (wasRunning) await stopServer(sv.id);

    progress(15, 'Creating backup…');
    const serverDir = path.join(SERVERS_DIR, sv.id);
    const backupId = nanoid(10);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
    const safeName = sv.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const backupPath = path.join(BACKUPS_DIR, `${safeName}_pre-update_${ts}.tar.gz`);
    let backupSizeBytes = 0;
    try {
      backupSizeBytes = await createBackupArchive(serverDir, backupPath);
      createBackup({
        id: backupId,
        serverId: sv.id,
        label: `Pre-update backup (${sv.modpackSlug ?? sv.modpackSource})`,
        filePath: backupPath,
        sizeBytes: backupSizeBytes,
        type: 'full',
      });
    } catch (backupErr) {
      console.error('[job-runner] Backup failed (continuing):', backupErr);
    }

    progress(30, 'Clearing mods…');
    const modsDir = path.join(serverDir, 'mods');
    if (fs.existsSync(modsDir)) {
      for (const f of fs.readdirSync(modsDir)) {
        const fp = path.join(modsDir, f);
        try { if (fs.statSync(fp).isFile()) fs.unlinkSync(fp); } catch { /* ignore */ }
      }
    }

    progress(40, 'Downloading new version…');
    const tmpBase = path.join(os.tmpdir(), `modpack-update-${nanoid(10)}`);
    let importResult: { mcVersion: string; serverType: string; modsDownloaded: number; modsSkipped: number };

    if (sv.modpackSource === 'modrinth') {
      const vResp = await fetch(`https://api.modrinth.com/v2/version/${params.versionId}`, {
        headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' },
      });
      if (!vResp.ok) throw new Error(`Modrinth version fetch failed: ${vResp.status}`);
      const vData = await vResp.json() as { files: { url: string; primary: boolean }[] };
      const file = vData.files.find(f => f.primary) ?? vData.files[0];
      if (!file) throw new Error('No downloadable file found for this version');

      const tmpPath = `${tmpBase}.mrpack`;
      const dlResp = await fetch(file.url, { headers: { 'User-Agent': 'Spawnpoint/1.0' } });
      if (!dlResp.ok) throw new Error(`Download failed: ${dlResp.status}`);
      fs.writeFileSync(tmpPath, Buffer.from(await dlResp.arrayBuffer()));

      progress(60, 'Installing mods…');
      try {
        importResult = await importMrpack(tmpPath, serverDir);
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }
    } else {
      const fileResp = await cfGet<{ data: { downloadUrl: string | null } }>(
        `/mods/${sv.modpackProjectId}/files/${params.versionId}`
      );
      if (!fileResp.data.downloadUrl) throw new Error('CurseForge: file not available for direct download');

      const tmpPath = `${tmpBase}.zip`;
      const dlResp = await fetch(fileResp.data.downloadUrl, { headers: { 'User-Agent': 'Spawnpoint/1.0' } });
      if (!dlResp.ok) throw new Error(`Download failed: ${dlResp.status}`);
      fs.writeFileSync(tmpPath, Buffer.from(await dlResp.arrayBuffer()));

      progress(60, 'Installing mods…');
      try {
        importResult = await importCurseForgeModpack(tmpPath, serverDir);
      } finally {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      }
    }

    progress(90, 'Saving changes…');
    const updated = updateServer(sv.id, {
      modpackVersionId: params.versionId,
      ...(importResult.mcVersion !== sv.mcVersion && { mcVersion: importResult.mcVersion }),
      ...(importResult.serverType !== sv.type && { type: importResult.serverType as never }),
    });

    if (wasRunning && updated) {
      progress(95, 'Restarting server…');
      await startServer(updated);
    }

    return {
      serverId: sv.id,
      backupCreated: backupSizeBytes > 0,
      backupId: backupSizeBytes > 0 ? backupId : null,
      modsDownloaded: importResult.modsDownloaded,
    };
  });

  return getJob(job.id)!;
}

import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { initDb } from './db/database';
import { listServers } from './models/Server';
import { syncContainerStates, setBroadcast, checkDockerAvailable, sendCommand } from './services/DockerManager';
import { init as initMessageScheduler } from './services/MessageScheduler';
import { startServerScheduler } from './services/ServerScheduler';
import { startBackupScheduler } from './services/BackupScheduler';
import { broadcastToServer, createWsServer } from './ws/wsServer';
import { errorHandler } from './middleware/errorHandler';
import { authMiddleware } from './middleware/auth';
import { PORT, PUBLIC_DIR, HOST_DATA_DIR, CORS_ORIGIN, APP_VERSION } from './config';

import authRouter from './routes/auth';
import serversRouter from './routes/servers';
import filesRouter from './routes/files';
import backupsRouter from './routes/backups';
import consoleRouter from './routes/console';
import prismRouter from './routes/prism';
import playersRouter from './routes/players';
import importBackupRouter from './routes/importBackup';
import messagesRouter from './routes/messages';
import schedulesRouter from './routes/schedules';
import modrinthRouter from './routes/modrinth';
import curseforgeServerRouter, { globalRouter as curseforgeGlobalRouter } from './routes/curseforge';
import imageProxyRouter from './routes/imageProxy';
import modpackUpdateRouter from './routes/modpackUpdate';
import jobsRouter from './routes/jobs';
import settingsRouter from './routes/settings';
import { resetStaleJobs } from './models/Job';

async function main(): Promise<void> {
  if (!path.isAbsolute(HOST_DATA_DIR)) {
    console.warn(`[warn] HOST_DATA_DIR="${HOST_DATA_DIR}" is not absolute — server containers may fail to start.`);
  } else {
    console.log(`[config] Host data dir: ${HOST_DATA_DIR}`);
  }

  initDb();
  resetStaleJobs();

  const app = express();
  if (CORS_ORIGIN) {
    const isWildcard = CORS_ORIGIN === '*';
    const allowed = isWildcard
      ? '*'
      : CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean);
    app.use(cors({
      origin: allowed,
      // credentials + wildcard is rejected by browsers and is a misconfiguration
      credentials: !isWildcard,
    }));
  }
  app.use(express.json({ limit: '50mb' }));

  // Image proxy (public — browser loads images without session cookies)
  app.use('/api/image-proxy', imageProxyRouter);

  // Health check (public)
  app.get('/api/health', async (_req, res) => {
    const dockerAvailable = await checkDockerAvailable();
    res.json({ success: true, data: { dockerAvailable, version: APP_VERSION } });
  });

  // Auth routes are public (login/logout/check)
  app.use('/api/auth', authRouter);

  // All other API routes require authentication
  app.use('/api', authMiddleware);

  // Protected API routes
  app.use('/api/servers', serversRouter);
  app.use('/api/servers/:id/files', filesRouter);
  app.use('/api/servers/:id/backups', backupsRouter);
  app.use('/api/servers/:id/console', consoleRouter);
  app.use('/api/servers/:id/players', playersRouter);
  app.use('/api/prism', prismRouter);
  app.use('/api/backups', importBackupRouter);
  app.use('/api/servers/:id/messages', messagesRouter);
  app.use('/api/servers/:id/schedules', schedulesRouter);
  app.use('/api/servers/:id/modrinth', modrinthRouter);
  app.use('/api/servers/:id/curseforge', curseforgeServerRouter);
  app.use('/api/curseforge', curseforgeGlobalRouter);
  app.use('/api/servers/:id/modpack', modpackUpdateRouter);
  app.use('/api/jobs', jobsRouter);
  app.use('/api/settings', settingsRouter);

  // Serve frontend (no auth — the SPA handles the login UI)
  if (fs.existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
    });
  }

  app.use(errorHandler);

  const server = http.createServer(app);
  createWsServer(server);

  setBroadcast(broadcastToServer);
  initMessageScheduler(sendCommand);
  startServerScheduler();
  startBackupScheduler();

  const dockerAvailable = await checkDockerAvailable();
  if (!dockerAvailable) {
    console.error('[docker] Docker daemon is unavailable — check that /var/run/docker.sock is mounted. Server controls will not work.');
  }

  const servers = listServers();
  await syncContainerStates(servers);

  server.listen(PORT, () => {
    console.log(`Spawnpoint running on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

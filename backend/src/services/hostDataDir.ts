/**
 * Resolves the HOST-side absolute path for the data directory.
 *
 * When the dashboard runs inside Docker, it needs to pass the HOST path when
 * creating bind mounts for MC server containers. This module auto-detects it
 * by inspecting the dashboard container via the Docker API — no env var needed.
 *
 * Priority:
 *   1. HOST_DATA_DIR env var (explicit override, useful on Docker Desktop)
 *   2. Docker API inspection of this container's mounts (Linux / standard Docker)
 *   3. path.resolve(DATA_DIR) — running directly on the host (dev mode)
 */

import fs from 'fs';
import path from 'path';
import Dockerode from 'dockerode';
import { DATA_DIR } from '../config';

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
let cached: string | null = null;

export async function getHostDataDir(): Promise<string> {
  if (cached) return cached;

  // 1. Explicit override
  const explicit = process.env.HOST_DATA_DIR ?? '';
  if (path.isAbsolute(explicit)) {
    cached = explicit;
    return explicit;
  }

  // 2. Inspect our own container — Docker knows the exact host source path
  if (fs.existsSync('/.dockerenv')) {
    try {
      const hostname = fs.readFileSync('/etc/hostname', 'utf8').trim();
      const containers = await docker.listContainers({ all: true });
      // Docker sets the container hostname to the first 12 chars of its ID
      const me = containers.find((c) => c.Id.startsWith(hostname) || c.Id === hostname);
      if (me) {
        const info = await docker.getContainer(me.Id).inspect();
        const dataDir = path.resolve(DATA_DIR);
        const mount = (info.Mounts as Array<{ Destination: string; Type: string; Source: string }>)
          .find((m) => m.Destination === dataDir && m.Type === 'bind');
        if (mount?.Source && path.isAbsolute(mount.Source)) {
          console.log(`[config] Host data dir (Docker inspect): ${mount.Source}`);
          cached = mount.Source;
          return mount.Source;
        }
      }
    } catch { /* Docker socket unavailable or inspection failed */ }
  }

  // 3. Running directly on the host — DATA_DIR is already the correct path
  const fallback = path.resolve(DATA_DIR);
  console.log(`[config] Host data dir (resolved): ${fallback}`);
  cached = fallback;
  return fallback;
}

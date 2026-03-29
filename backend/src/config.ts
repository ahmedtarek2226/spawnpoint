import path from 'path';
import fs from 'fs';

// import.meta.dir is /app/src in Docker — one level up is /app
const APP_ROOT = path.resolve(import.meta.dir, '..');

export const PORT = parseInt(process.env.PORT ?? '3000', 10);
export const DATA_DIR = process.env.DATA_DIR ?? path.join(APP_ROOT, 'data');
export const DB_PATH = path.join(DATA_DIR, 'mc.db');
export const JARS_DIR = path.join(DATA_DIR, 'jars');
export const SERVERS_DIR = path.join(DATA_DIR, 'servers');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
export const PUBLIC_DIR = path.join(APP_ROOT, 'public');

export const MC_IMAGE = 'itzg/minecraft-server';
export const RCON_PORT_INSIDE_CONTAINER = 25575;
export const CONSOLE_BUFFER_SIZE = 1000;
export const DEFAULT_JVM_FLAGS = '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200';

/**
 * Read /proc/self/mountinfo to find the HOST-side absolute path that is
 * bind-mounted to `containerPath`. This works on Linux/Docker without
 * requiring any user configuration.
 *
 * mountinfo line format:
 *   mountId parentId major:minor root mountPoint options [tags] - fsType source superOptions
 *
 * For a Docker bind mount `-v /host/path:/app/data`, the entry is:
 *   ... /host/path /app/data rw,... - ext4 /dev/sda1 ...
 * so parts[3] is the host path and parts[4] is the container mount point.
 */
function readHostBindPath(containerPath: string): string | null {
  try {
    const absPath = path.resolve(containerPath);
    const lines = fs.readFileSync('/proc/self/mountinfo', 'utf8').split('\n');
    for (const line of lines) {
      const parts = line.trim().split(' ');
      if (parts.length < 5) continue;
      const root = parts[3];
      const mountPoint = parts[4];
      if (mountPoint === absPath && root.startsWith('/')) {
        return root;
      }
    }
  } catch { /* /proc not available (not Linux, or running without Docker) */ }
  return null;
}

function resolveHostDataDir(): string {
  const explicit = process.env.HOST_DATA_DIR ?? '';

  // If an absolute path was provided explicitly, trust it
  if (path.isAbsolute(explicit)) return explicit;

  // Auto-detect from the kernel's mount table (works on Linux/Docker)
  const detected = readHostBindPath(DATA_DIR);
  if (detected) {
    console.log(`[config] Auto-detected host data dir: ${detected}`);
    return detected;
  }

  // Running directly on the host (not in Docker) — DATA_DIR is already the right path
  return path.resolve(explicit || DATA_DIR);
}

export const HOST_DATA_DIR = resolveHostDataDir();

export const DASHBOARD_USER = process.env.DASHBOARD_USER ?? '';
export const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD ?? '';

// CORS_ORIGIN: comma-separated list of allowed origins, or * for all.
// If unset, CORS is disabled (same-origin only — recommended for production).
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '';

export const APP_VERSION = process.env.BUILD_VERSION ?? '';

// Normalize the key: strip surrounding quotes and unescape $$ → $
// so the key works whether loaded via env_file: (literal) or environment: ($$-escaped).
export const CURSEFORGE_API_KEY = (process.env.CURSEFORGE_API_KEY ?? '')
  .replace(/^["']|["']$/g, '')
  .replace(/\$\$/g, '$');

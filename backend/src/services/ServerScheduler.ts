import { getAllEnabledSchedules } from '../models/Schedule';
import { getServer } from '../models/Server';
import { startServer, stopServer, getServerRuntime } from './DockerManager';

let interval: NodeJS.Timeout | null = null;
// Track the last minute each schedule fired to avoid double-firing
const fired = new Map<string, string>();

export function startServerScheduler(): void {
  if (interval) return;
  interval = setInterval(tick, 60 * 1000);
  console.log('[ServerScheduler] Started');
}

async function tick(): Promise<void> {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const hour = now.getHours();
  const minute = now.getMinutes();
  const key = `${now.toISOString().slice(0, 10)} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const schedules = getAllEnabledSchedules();
  for (const schedule of schedules) {
    if (schedule.hour !== hour || schedule.minute !== minute) continue;
    if (!schedule.days.includes(dayOfWeek)) continue;
    if (fired.get(schedule.id) === key) continue;

    fired.set(schedule.id, key);
    const server = getServer(schedule.serverId);
    if (!server) continue;

    const rt = getServerRuntime(server.id);
    try {
      if (schedule.action === 'start' && (rt.status === 'stopped' || rt.status === 'crashed')) {
        console.log(`[ServerScheduler] Starting "${server.name}" (schedule ${schedule.id})`);
        await startServer(server);
      } else if (schedule.action === 'stop' && rt.status === 'running') {
        console.log(`[ServerScheduler] Stopping "${server.name}" (schedule ${schedule.id})`);
        await stopServer(server.id);
      }
    } catch (err) {
      console.error(`[ServerScheduler] Failed to ${schedule.action} "${server.name}":`, err);
    }
  }
}

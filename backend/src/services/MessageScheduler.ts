import { listMessages } from '../models/Message';
import { ServerConfig } from '../types';

type SendFn = (config: ServerConfig, command: string) => Promise<void>;
let _send: SendFn = async () => {};

export function init(send: SendFn): void {
  _send = send;
}

const timedIntervals = new Map<string, NodeJS.Timeout[]>();

export function startScheduler(config: ServerConfig): void {
  stopScheduler(config.id);

  const msgs = listMessages(config.id).filter(
    (m) => m.type === 'timed' && m.enabled && m.intervalMinutes && m.intervalMinutes > 0
  );

  const intervals: NodeJS.Timeout[] = [];
  for (const msg of msgs) {
    const ms = msg.intervalMinutes! * 60 * 1000;
    const iv = setInterval(async () => {
      try {
        for (const line of msg.content.split('\n')) {
          if (line.trim()) await _send(config, `say ${line.trim()}`);
        }
      } catch { /* server may have stopped */ }
    }, ms);
    intervals.push(iv);
  }

  timedIntervals.set(config.id, intervals);
}

export function stopScheduler(serverId: string): void {
  const intervals = timedIntervals.get(serverId) ?? [];
  intervals.forEach(clearInterval);
  timedIntervals.delete(serverId);
}

export async function onPlayerJoin(config: ServerConfig, playerName: string): Promise<void> {
  const msgs = listMessages(config.id).filter((m) => m.type === 'join' && m.enabled);
  for (const msg of msgs) {
    for (const line of msg.content.split('\n')) {
      if (line.trim()) {
        try { await _send(config, `tell ${playerName} ${line.trim()}`); } catch { /* ignore */ }
      }
    }
  }
}

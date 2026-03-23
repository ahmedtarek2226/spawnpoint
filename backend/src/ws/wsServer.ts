import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { WsInbound, WsOutbound } from '../types';
import { getConsoleBuf, sendCommand } from '../services/DockerManager';
import { getServer } from '../models/Server';

const consoleSubs = new Map<string, Set<WebSocket>>();
const metricsSubs = new Map<string, Set<WebSocket>>();

function sub(map: Map<string, Set<WebSocket>>, serverId: string, ws: WebSocket): void {
  if (!map.has(serverId)) map.set(serverId, new Set());
  map.get(serverId)!.add(ws);
}

function unsub(map: Map<string, Set<WebSocket>>, serverId: string, ws: WebSocket): void {
  map.get(serverId)?.delete(ws);
}

function unsubAll(ws: WebSocket): void {
  for (const set of consoleSubs.values()) set.delete(ws);
  for (const set of metricsSubs.values()) set.delete(ws);
}

function send(ws: WebSocket, msg: WsOutbound): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export function broadcastToServer(serverId: string, msg: WsOutbound): void {
  const kind = msg.type === 'console_line' ? consoleSubs : metricsSubs;
  const set = (msg.type === 'console_line' || msg.type === 'status_change')
    ? consoleSubs.get(serverId)
    : metricsSubs.get(serverId);

  if (!set) return;
  for (const ws of set) send(ws, msg);

  // status_change also goes to metrics subscribers
  if (msg.type === 'status_change') {
    metricsSubs.get(serverId)?.forEach(ws => send(ws, msg));
  }
}

export function createWsServer(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      let msg: WsInbound;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      switch (msg.type) {
        case 'subscribe_console': {
          sub(consoleSubs, msg.serverId, ws);
          // Send history on subscribe
          const buf = getConsoleBuf(msg.serverId);
          for (const line of buf) {
            send(ws, { type: 'console_line', serverId: msg.serverId, line, timestamp: Date.now() });
          }
          break;
        }
        case 'unsubscribe_console':
          unsub(consoleSubs, msg.serverId, ws);
          break;
        case 'subscribe_metrics':
          sub(metricsSubs, msg.serverId, ws);
          break;
        case 'unsubscribe_metrics':
          unsub(metricsSubs, msg.serverId, ws);
          break;
        case 'console_command': {
          const config = getServer(msg.serverId);
          if (!config) {
            send(ws, { type: 'error', code: 'NOT_FOUND', message: 'Server not found' });
            break;
          }
          try {
            await sendCommand(config, msg.command);
          } catch (err) {
            send(ws, { type: 'error', code: 'COMMAND_FAILED', message: (err as Error).message });
          }
          break;
        }
      }
    });

    ws.on('close', () => unsubAll(ws));
    ws.on('error', () => unsubAll(ws));
  });

  return wss;
}

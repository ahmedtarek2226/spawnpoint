import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { WsInbound, WsOutbound } from '../types';
import { getConsoleBuf, sendCommand } from '../services/DockerManager';
import { getServer } from '../models/Server';
import { DASHBOARD_USER, DASHBOARD_PASSWORD } from '../config';
import { activeSessions } from '../services/sessionStore';
import { parseCookies, SESSION_COOKIE } from '../middleware/auth';

const consoleSubs = new Map<string, Set<WebSocket>>();
const metricsSubs = new Map<string, Set<WebSocket>>();
const allClients = new Set<WebSocket>();

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

export function broadcastAll(msg: WsOutbound): void {
  for (const ws of allClients) send(ws, msg);
}

export function broadcastToServer(serverId: string, msg: WsOutbound): void {
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
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    if (req.url !== '/ws') { socket.destroy(); return; }

    if (DASHBOARD_USER && DASHBOARD_PASSWORD) {
      const token = parseCookies(req.headers.cookie ?? '')[SESSION_COOKIE];
      if (!token || !activeSessions.has(token)) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    allClients.add(ws);

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

    ws.on('close', () => { allClients.delete(ws); unsubAll(ws); });
    ws.on('error', () => { allClients.delete(ws); unsubAll(ws); });
  });

  return wss;
}

import { useEffect, useRef } from 'react';
import { useServersStore } from '../stores/serversStore';
import { useJobStore } from '../stores/jobStore';

type MsgHandler = (msg: Record<string, unknown>) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const handlers = new Set<MsgHandler>();
const connectCallbacks = new Set<() => void>();

function getWsUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}/ws`;
}

function connect(): void {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  ws = new WebSocket(getWsUrl());

  ws.onopen = () => connectCallbacks.forEach((cb) => cb());

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      handlers.forEach((h) => h(msg));
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    ws = null;
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => ws?.close();
}

export function onWsConnect(cb: () => void): () => void {
  connectCallbacks.add(cb);
  return () => connectCallbacks.delete(cb);
}

export function sendWs(msg: unknown): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// Global store subscription handler
let storeHandlerRegistered = false;
function registerStoreHandler(): void {
  if (storeHandlerRegistered) return;
  storeHandlerRegistered = true;

  handlers.add((msg) => {
    const { updateStatus, updateMetrics, updateCrashDiagnosis, updateRuntime } = useServersStore.getState();
    if (msg.type === 'status_change') {
      updateStatus(msg.serverId as string, msg.status as never);
      updateRuntime(msg.serverId as string, {
        startedAt: msg.startedAt as number | undefined,
        stoppedAt: msg.stoppedAt as number | undefined,
      });
    } else if (msg.type === 'metrics_tick') {
      updateMetrics(msg.serverId as string, msg.metrics as never);
    } else if (msg.type === 'crash_diagnosis') {
      updateCrashDiagnosis(msg.serverId as string, msg.issues as never);
    } else if (msg.type === 'backup_status') {
      updateRuntime(msg.serverId as string, { backingUp: msg.backingUp as boolean });
    } else if (msg.type === 'job_update') {
      useJobStore.getState().upsertJob(msg.job as never);
    }
  });
}

export function initWs(): void {
  registerStoreHandler();
  connect();
}

// Hook for components that need console lines
export function useConsole(serverId: string, onLine: (line: string, ts: number) => void): void {
  const onLineRef = useRef(onLine);
  onLineRef.current = onLine;

  useEffect(() => {
    if (!serverId) return;

    const handler: MsgHandler = (msg) => {
      if (msg.type === 'console_line' && msg.serverId === serverId) {
        onLineRef.current(msg.line as string, msg.timestamp as number);
      }
    };

    handlers.add(handler);
    sendWs({ type: 'subscribe_console', serverId });
    sendWs({ type: 'subscribe_metrics', serverId });

    return () => {
      handlers.delete(handler);
      sendWs({ type: 'unsubscribe_console', serverId });
      sendWs({ type: 'unsubscribe_metrics', serverId });
    };
  }, [serverId]);
}

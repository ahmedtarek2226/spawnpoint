export const SERVER_TYPES = [
  'vanilla', 'paper', 'spigot', 'purpur',
  'forge', 'fabric', 'quilt', 'neoforge',
  'bungeecord', 'velocity',
] as const;

export type ServerType = typeof SERVER_TYPES[number];

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export const JAVA_VERSIONS = ['8', '11', '17', '21', '21-graal', '22'] as const;
export type JavaVersion = typeof JAVA_VERSIONS[number];

export interface ServerConfig {
  id: string;
  name: string;
  type: ServerType;
  mcVersion: string;
  port: number;
  jvmFlags: string;
  memoryMb: number;
  javaVersion: string;
  rconPassword: string;
  hostDirectory: string;
  tags: string[];
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupRetainCount: number;
  backupLastAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ServerMetrics {
  cpuPercent: number;
  ramMb: number;
  tps: number | null;
  playersOnline: number;
  playersMax: number;
}

export type CrashIssueType = 'client_only_mod' | 'java_version' | 'out_of_memory' | 'unknown';
export interface CrashIssue {
  type: CrashIssueType;
  message: string;
  modId?: string;
  modFile?: string;
  fixable: boolean;
}

export interface ServerRuntime {
  status: ServerStatus;
  containerId?: string;
  metrics: ServerMetrics;
  consoleBuf: string[];
  crashDiagnosis?: CrashIssue[];
  playersOnline: string[];
}

export type BackupType = 'full' | 'world';

export interface BackupRecord {
  id: string;
  serverId: string;
  label: string;
  filePath: string;
  sizeBytes: number;
  type: BackupType;
  createdAt: string;
}

// WebSocket message types
export type WsInbound =
  | { type: 'subscribe_console'; serverId: string }
  | { type: 'unsubscribe_console'; serverId: string }
  | { type: 'subscribe_metrics'; serverId: string }
  | { type: 'unsubscribe_metrics'; serverId: string }
  | { type: 'console_command'; serverId: string; command: string };

export type WsOutbound =
  | { type: 'console_line'; serverId: string; line: string; timestamp: number }
  | { type: 'status_change'; serverId: string; status: ServerStatus }
  | { type: 'metrics_tick'; serverId: string; metrics: ServerMetrics; timestamp: number }
  | { type: 'crash_diagnosis'; serverId: string; issues: CrashIssue[] }
  | { type: 'error'; code: string; message: string };

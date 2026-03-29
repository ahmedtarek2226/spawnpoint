import { create } from 'zustand';

export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';

export interface ServerMetrics {
  cpuPercent: number;
  ramMb: number;
  tps: number | null;
  playersOnline: number;
  playersMax: number;
}

export interface CrashIssue {
  type: 'client_only_mod' | 'java_version' | 'out_of_memory' | 'unknown';
  message: string;
  modId?: string;
  modFile?: string;
  fixable: boolean;
}

export interface ServerRuntime {
  status: ServerStatus;
  metrics: ServerMetrics;
  crashDiagnosis?: CrashIssue[];
  startedAt?: number;
  stoppedAt?: number;
  backingUp?: boolean;
}

export interface Server {
  id: string;
  name: string;
  type: string;
  mcVersion: string;
  port: number;
  memoryMb: number;
  jvmFlags: string;
  javaVersion: string;
  tags: string[];
  createdAt: string;
  hostDirectory: string;
  runtime: ServerRuntime;
  modpackSource?: 'modrinth' | 'curseforge' | null;
  modpackProjectId?: string | null;
  modpackVersionId?: string | null;
  modpackSlug?: string | null;
}

interface State {
  servers: Server[];
  setServers: (servers: Server[]) => void;
  updateRuntime: (id: string, runtime: Partial<ServerRuntime>) => void;
  updateMetrics: (id: string, metrics: ServerMetrics) => void;
  updateStatus: (id: string, status: ServerStatus) => void;
  updateCrashDiagnosis: (id: string, issues: CrashIssue[]) => void;
}

export const useServersStore = create<State>((set) => ({
  servers: [],
  setServers: (servers) => set({ servers }),
  updateRuntime: (id, runtime) =>
    set((s) => ({
      servers: s.servers.map((sv) =>
        sv.id === id ? { ...sv, runtime: { ...sv.runtime, ...runtime } } : sv
      ),
    })),
  updateMetrics: (id, metrics) =>
    set((s) => ({
      servers: s.servers.map((sv) =>
        sv.id === id ? { ...sv, runtime: { ...sv.runtime, metrics } } : sv
      ),
    })),
  updateStatus: (id, status) =>
    set((s) => ({
      servers: s.servers.map((sv) =>
        sv.id === id ? { ...sv, runtime: { ...sv.runtime, status } } : sv
      ),
    })),
  updateCrashDiagnosis: (id, issues) =>
    set((s) => ({
      servers: s.servers.map((sv) =>
        sv.id === id ? { ...sv, runtime: { ...sv.runtime, crashDiagnosis: issues } } : sv
      ),
    })),
}));

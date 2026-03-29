import { create } from 'zustand';

export type JobStatus = 'queued' | 'running' | 'done' | 'failed';

export interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  label: string;
  serverId: string | null;
  progress: number;
  step: string;
  error: string | null;
  result: { serverId?: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobNotification {
  id: string;
  label: string;
  status: 'done' | 'failed';
  error: string | null;
  serverId: string | null;
  resultServerId: string | null;
  timestamp: string;
}

const STORAGE_KEY = 'spawnpoint_notifications';

function loadPersisted(): { notifications: JobNotification[]; unseenCount: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { notifications: [], unseenCount: 0 };
    const parsed = JSON.parse(raw);
    return {
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      unseenCount: typeof parsed.unseenCount === 'number' ? parsed.unseenCount : 0,
    };
  } catch {
    return { notifications: [], unseenCount: 0 };
  }
}

function persist(notifications: JobNotification[], unseenCount: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      notifications: notifications.slice(0, 200),
      unseenCount,
    }));
  } catch { /* storage unavailable */ }
}

function toNotification(job: JobRecord): JobNotification {
  return {
    id: job.id,
    label: job.label,
    status: job.status as 'done' | 'failed',
    error: job.error,
    serverId: job.serverId,
    resultServerId: job.result?.serverId ?? null,
    timestamp: job.updatedAt,
  };
}

interface JobState {
  /** All jobs received this session — toasts are filtered from here */
  jobs: JobRecord[];
  /** Job IDs hidden from the toast panel (session-only; resets on reload) */
  dismissedToasts: string[];
  /** Persistent notification history (localStorage-backed) */
  notifications: JobNotification[];
  /** Badge count — notifications added since panel was last opened */
  unseenCount: number;

  /** Initial load from REST API. Done/failed jobs go to history only, not toasts. */
  setJobs: (jobs: JobRecord[]) => void;
  /** Real-time update from WebSocket */
  upsertJob: (job: JobRecord) => void;
  /** Hide a toast. Does not delete notification history. */
  dismissToast: (id: string) => void;
  deleteNotification: (id: string) => void;
  clearNotifications: () => void;
  markAllSeen: () => void;
}

const { notifications: initNotifications, unseenCount: initUnseen } = loadPersisted();

export const useJobStore = create<JobState>((set, get) => ({
  jobs: [],
  dismissedToasts: [],
  notifications: initNotifications,
  unseenCount: initUnseen,

  setJobs: (incomingJobs) => {
    const state = get();
    const existingIds = new Set(state.notifications.map((n) => n.id));

    // Add any done/failed jobs from REST load that aren't in history yet
    const newNotifs: JobNotification[] = [];
    for (const job of incomingJobs) {
      if ((job.status === 'done' || job.status === 'failed') && !existingIds.has(job.id)) {
        newNotifs.push(toNotification(job));
      }
    }

    // Suppress toasts for done/failed jobs loaded on init — user already saw them last session
    const suppressIds = incomingJobs
      .filter((j) => j.status === 'done' || j.status === 'failed')
      .map((j) => j.id);

    const updatedNotifications = [...newNotifs, ...state.notifications];
    // Don't inflate unseenCount for historical jobs from REST load
    persist(updatedNotifications, state.unseenCount);

    set({
      jobs: incomingJobs,
      dismissedToasts: [...state.dismissedToasts, ...suppressIds],
      notifications: updatedNotifications,
    });
  },

  upsertJob: (job) =>
    set((s) => {
      const existing = s.jobs.find((j) => j.id === job.id);
      const wasActive = !existing || existing.status === 'queued' || existing.status === 'running';
      const isTerminal = job.status === 'done' || job.status === 'failed';
      const isTransition = wasActive && isTerminal;

      let notifications = s.notifications;
      let unseenCount = s.unseenCount;

      if (isTransition && !s.notifications.find((n) => n.id === job.id)) {
        notifications = [toNotification(job), ...s.notifications];
        unseenCount = unseenCount + 1;
        persist(notifications, unseenCount);
      }

      return {
        jobs: existing
          ? s.jobs.map((j) => (j.id === job.id ? job : j))
          : [job, ...s.jobs],
        notifications,
        unseenCount,
      };
    }),

  dismissToast: (id) =>
    set((s) => ({ dismissedToasts: [...s.dismissedToasts, id] })),

  deleteNotification: (id) =>
    set((s) => {
      const notifications = s.notifications.filter((n) => n.id !== id);
      persist(notifications, s.unseenCount);
      return { notifications };
    }),

  clearNotifications: () =>
    set((s) => {
      persist([], 0);
      return { notifications: [], unseenCount: 0 };
    }),

  markAllSeen: () =>
    set((s) => {
      persist(s.notifications, 0);
      return { unseenCount: 0 };
    }),
}));

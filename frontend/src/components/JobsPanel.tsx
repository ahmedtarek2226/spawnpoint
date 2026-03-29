import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { useJobStore, type JobRecord } from '../stores/jobStore';
import { useServersStore } from '../stores/serversStore';
import { api } from '../api/client';
import type { Server } from '../stores/serversStore';

const AUTO_DISMISS_MS = 5000;

function JobItem({ job, onDismiss }: { job: JobRecord; onDismiss: () => void }) {
  const navigate = useNavigate();
  const setServers = useServersStore((s) => s.setServers);
  const navigatedRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  // When a job finishes with a new server, refresh the server list
  useEffect(() => {
    if (job.status === 'done' && job.result?.serverId && !navigatedRef.current) {
      api.get<Server[]>('/servers').then(setServers).catch(() => {});
    }
  }, [job.status]);

  // Auto-dismiss completed jobs after a few seconds
  useEffect(() => {
    if (job.status !== 'done') return;
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [job.status]);

  const isDone = job.status === 'done';
  const isFailed = job.status === 'failed';
  const isActive = job.status === 'running' || job.status === 'queued';

  function handleView() {
    const sid = job.result?.serverId ?? job.serverId;
    if (!sid) return;
    navigatedRef.current = true;
    onDismiss();
    navigate(`/servers/${sid}`);
  }

  return (
    <div className={`
      flex items-start gap-3 p-3 rounded-lg border text-sm
      ${isDone ? 'bg-green-950/40 border-green-800/40' : ''}
      ${isFailed ? 'bg-red-950/40 border-red-800/40' : ''}
      ${isActive ? 'bg-mc-panel border-mc-border' : ''}
    `}>
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isActive && <Loader2 size={15} className="text-mc-green animate-spin" />}
        {isDone && <CheckCircle2 size={15} className="text-green-400" />}
        {isFailed && <AlertCircle size={15} className="text-red-400" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-200 truncate">{job.label}</div>
        {isActive && (
          <>
            <div className="text-xs text-mc-muted mt-0.5 truncate">{job.step}</div>
            <div className="mt-1.5 h-1 bg-mc-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-mc-green rounded-full transition-all duration-500"
                style={{ width: `${job.progress}%` }}
              />
            </div>
          </>
        )}
        {isDone && (
          <div className="text-xs text-green-400/70 mt-0.5">Completed</div>
        )}
        {isFailed && (
          <div className="text-xs text-red-400/80 mt-0.5 line-clamp-2">{job.error ?? 'Unknown error'}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {isDone && (job.result?.serverId || job.serverId) && (
          <button
            onClick={handleView}
            className="text-mc-green hover:text-mc-green/80 transition-colors p-1 rounded"
            title="View server"
          >
            <ArrowRight size={14} />
          </button>
        )}
        {!isActive && (
          <button
            onClick={onDismiss}
            className="text-mc-muted hover:text-gray-300 transition-colors p-1 rounded"
            title="Dismiss"
          >
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function JobsPanel() {
  const { jobs, dismissedToasts, dismissToast } = useJobStore();

  const visible = jobs.filter((j) => !dismissedToasts.includes(j.id));
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 space-y-2 pointer-events-none">
      {visible.map((job) => (
        <div key={job.id} className="pointer-events-auto">
          <JobItem job={job} onDismiss={() => dismissToast(job.id)} />
        </div>
      ))}
    </div>
  );
}

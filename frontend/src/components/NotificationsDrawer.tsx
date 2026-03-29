import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CheckCircle2, AlertCircle, ArrowRight, Trash2 } from 'lucide-react';
import { useJobStore, type JobNotification } from '../stores/jobStore';

function timeAgo(ts: string): string {
  try {
    const diff = Date.now() - new Date(ts).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 60) return 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  } catch {
    return '';
  }
}

function NotifItem({ notif, onDelete }: { notif: JobNotification; onDelete: () => void }) {
  const navigate = useNavigate();
  const sid = notif.resultServerId ?? notif.serverId;
  const isDone = notif.status === 'done';

  return (
    <div className="flex items-start gap-2.5 px-3 py-2.5 hover:bg-white/5 rounded transition-colors group">
      <div className="flex-shrink-0 mt-0.5">
        {isDone
          ? <CheckCircle2 size={13} className="text-green-400" />
          : <AlertCircle size={13} className="text-red-400" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-200 truncate leading-snug">{notif.label}</div>
        {!isDone && notif.error && (
          <div className="text-xs text-red-400/80 mt-0.5 line-clamp-1">{notif.error}</div>
        )}
        <div className="text-xs text-mc-muted mt-0.5">{timeAgo(notif.timestamp)}</div>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {isDone && sid && (
          <button
            onClick={() => navigate(`/servers/${sid}`)}
            className="text-mc-muted hover:text-mc-green transition-colors p-1 rounded"
            title="Go to server"
          >
            <ArrowRight size={12} />
          </button>
        )}
        <button
          onClick={onDelete}
          className="text-mc-muted hover:text-red-400 transition-colors p-1 rounded"
          title="Remove"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsDrawer({ isOpen, onClose }: Props) {
  const { notifications, unseenCount, clearNotifications, deleteNotification, markAllSeen } = useJobStore();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && unseenCount > 0) markAllSeen();
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Use capture so we catch events before they bubble away
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  return (
    <div
      ref={panelRef}
      className={`
        fixed bottom-4 left-[232px] z-50 w-72
        bg-mc-panel border border-mc-border rounded-lg shadow-2xl
        flex flex-col overflow-hidden
        transition-all duration-150 origin-bottom-left
        ${isOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-mc-border">
        <span className="text-xs font-semibold uppercase tracking-wider text-mc-muted">Notifications</span>
        {notifications.length > 0 && (
          <button
            onClick={clearNotifications}
            className="flex items-center gap-1 text-xs text-mc-muted hover:text-red-400 transition-colors"
          >
            <Trash2 size={10} />
            Clear all
          </button>
        )}
      </div>

      {/* List */}
      <div className="overflow-y-auto max-h-80">
        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-mc-muted">No notifications</p>
          </div>
        ) : (
          <div className="py-1">
            {notifications.map((n) => (
              <NotifItem
                key={n.id}
                notif={n}
                onDelete={() => deleteNotification(n.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Plus, Trash2, X, MessageSquare, Clock, Pencil } from 'lucide-react';
import { api } from '../../api/client';

interface ServerMessage {
  id: string;
  type: 'join' | 'timed';
  content: string;
  intervalMinutes: number | null;
  enabled: boolean;
  createdAt: string;
}

const INTERVAL_OPTIONS = [
  { label: '5 min', value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '6 hours', value: 360 },
];

function AddForm({ type, serverId, onAdded }: {
  type: 'join' | 'timed';
  serverId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [intervalMinutes, setIntervalMinutes] = useState(30);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await api.post(`/servers/${serverId}/messages`, {
        type,
        content: content.trim(),
        ...(type === 'timed' ? { intervalMinutes } : {}),
      });
      setContent('');
      setOpen(false);
      onAdded();
    } catch { /* ignore */ }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-xs w-full justify-center border border-dashed border-mc-border hover:border-mc-green/50 hover:text-mc-green mt-2 py-2 transition-colors"
      >
        <Plus size={12} /> Add {type === 'join' ? 'login' : 'timed'} message
      </button>
    );
  }

  return (
    <div className="card p-3.5 mt-2 space-y-3 border-mc-green/20">
      <textarea
        className="input w-full font-mono text-xs resize-none"
        rows={3}
        placeholder={type === 'join' ? 'Welcome to the server!\nPlease read the rules.' : 'Remember to vote at vote.example.com!'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
      />
      {type === 'timed' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-mc-muted">Repeat every</span>
          <select className="input text-xs py-1.5" value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))}>
            {INTERVAL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={submit} className="btn-primary text-xs" disabled={saving || !content.trim()}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button onClick={() => { setOpen(false); setContent(''); }} className="btn-ghost text-xs">
          Cancel
        </button>
      </div>
    </div>
  );
}

function MessageCard({ msg, serverId, onUpdated, onDeleted }: {
  msg: ServerMessage;
  serverId: string;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(msg.content);
  const [intervalMinutes, setIntervalMinutes] = useState(msg.intervalMinutes ?? 30);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/servers/${serverId}/messages/${msg.id}`, {
        content,
        ...(msg.type === 'timed' ? { intervalMinutes } : {}),
      });
      setEditing(false);
      onUpdated();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function toggle() {
    await api.patch(`/servers/${serverId}/messages/${msg.id}`, { enabled: !msg.enabled }).catch(() => {});
    onUpdated();
  }

  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await api.delete(`/servers/${serverId}/messages/${msg.id}`).catch(() => {});
    onDeleted();
  }

  return (
    <div className={`card p-3.5 transition-opacity ${!msg.enabled ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <textarea
              className="input w-full font-mono text-xs resize-none"
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
          ) : (
            <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap break-words">
              {msg.content}
            </pre>
          )}
          {msg.type === 'timed' && (
            <div className="mt-2">
              {editing ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-mc-muted">Repeat every</span>
                  <select className="input text-xs py-1" value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))}>
                    {INTERVAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className="text-xs text-mc-muted flex items-center gap-1">
                  <Clock size={10} />
                  Every {INTERVAL_OPTIONS.find(o => o.value === msg.intervalMinutes)?.label ?? `${msg.intervalMinutes} min`}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-mc-muted hover:text-gray-300 p-1.5 transition-colors" title="Edit">
              <Pencil size={12} />
            </button>
          )}
          <button
            onClick={toggle}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none ${
              msg.enabled ? 'border-mc-green bg-mc-green' : 'border-mc-border bg-mc-border/40'
            }`}
            title={msg.enabled ? 'Disable' : 'Enable'}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 mt-[1px] ${
              msg.enabled ? 'translate-x-3.5' : 'translate-x-0.5'
            }`} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button onClick={remove} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded border border-red-700/50 hover:bg-red-900/30 transition-colors">
                Delete
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-mc-muted hover:text-gray-300 p-1 transition-colors">
                <X size={11} />
              </button>
            </div>
          ) : (
            <button onClick={remove} className="text-mc-muted hover:text-red-400 p-1.5 transition-colors" title="Delete">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="flex gap-2 mt-3 pt-2 border-t border-mc-border/40">
          <button onClick={save} className="btn-primary text-xs" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setEditing(false); setContent(msg.content); setIntervalMinutes(msg.intervalMinutes ?? 30); }} className="btn-ghost text-xs">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export default function MessagesTab({ serverId }: { serverId: string }) {
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const data = await api.get<ServerMessage[]>(`/servers/${serverId}/messages`);
      setMessages(data);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [serverId]);

  const joinMsgs = messages.filter((m) => m.type === 'join');
  const timedMsgs = messages.filter((m) => m.type === 'timed');

  if (loading) return <div className="p-6 text-mc-muted text-sm">Loading…</div>;

  return (
    <div className="p-4 space-y-6 max-w-2xl">
      {/* Login messages */}
      <div className="card border-l-2 border-mc-green overflow-visible">
        <div className="p-4 border-b border-mc-border/40">
          <div className="flex items-center gap-2 mb-0.5">
            <MessageSquare size={14} className="text-mc-green" />
            <h3 className="text-sm font-medium text-gray-200">Login Messages</h3>
            {joinMsgs.length > 0 && (
              <span className="text-xs bg-mc-green/20 text-mc-green px-1.5 py-0.5 rounded ml-auto">{joinMsgs.length}</span>
            )}
          </div>
          <p className="text-xs text-mc-muted leading-relaxed">
            Sent privately to a player when they join via <code className="font-mono bg-mc-dark px-1 py-0.5 rounded text-gray-300">/tell</code>. Supports multiple lines.
          </p>
        </div>
        <div className="p-4 space-y-2">
          {joinMsgs.length === 0 && (
            <div className="text-xs text-mc-muted/60 italic py-2">No login messages configured.</div>
          )}
          {joinMsgs.map((m) => (
            <MessageCard key={m.id} msg={m} serverId={serverId} onUpdated={load} onDeleted={load} />
          ))}
          <AddForm type="join" serverId={serverId} onAdded={load} />
        </div>
      </div>

      {/* Timed messages */}
      <div className="card border-l-2 border-blue-500 overflow-visible">
        <div className="p-4 border-b border-mc-border/40">
          <div className="flex items-center gap-2 mb-0.5">
            <Clock size={14} className="text-blue-400" />
            <h3 className="text-sm font-medium text-gray-200">Timed Messages</h3>
            {timedMsgs.length > 0 && (
              <span className="text-xs bg-blue-900/30 text-blue-300 border border-blue-700/30 px-1.5 py-0.5 rounded ml-auto">{timedMsgs.length}</span>
            )}
          </div>
          <p className="text-xs text-mc-muted leading-relaxed">
            Broadcast to all players on a repeating interval via <code className="font-mono bg-mc-dark px-1 py-0.5 rounded text-gray-300">/say</code>. Timers start when the server starts.
          </p>
        </div>
        <div className="p-4 space-y-2">
          {timedMsgs.length === 0 && (
            <div className="text-xs text-mc-muted/60 italic py-2">No timed messages configured.</div>
          )}
          {timedMsgs.map((m) => (
            <MessageCard key={m.id} msg={m} serverId={serverId} onUpdated={load} onDeleted={load} />
          ))}
          <AddForm type="timed" serverId={serverId} onAdded={load} />
        </div>
      </div>
    </div>
  );
}

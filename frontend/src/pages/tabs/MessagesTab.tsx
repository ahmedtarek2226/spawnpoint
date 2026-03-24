import { useState, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
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
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs w-full justify-center border border-dashed border-mc-border hover:border-mc-green mt-2">
        <Plus size={13} /> Add {type === 'join' ? 'login' : 'timed'} message
      </button>
    );
  }

  return (
    <div className="card p-3 mt-2 space-y-2">
      <textarea
        className="input w-full font-mono text-xs resize-none"
        rows={3}
        placeholder={type === 'join' ? 'Welcome to the server!\nPlease read the rules in #rules.' : 'Remember to vote at vote.example.com!'}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        autoFocus
      />
      {type === 'timed' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-mc-muted">Repeat every</span>
          <select className="input text-xs py-1" value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))}>
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
    if (!confirm('Delete this message?')) return;
    await api.delete(`/servers/${serverId}/messages/${msg.id}`).catch(() => {});
    onDeleted();
  }

  return (
    <div className={`card p-3 space-y-2 ${!msg.enabled ? 'opacity-50' : ''}`}>
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
            <pre
              className="font-mono text-xs text-gray-300 whitespace-pre-wrap break-words cursor-pointer hover:text-gray-100"
              onClick={() => setEditing(true)}
            >
              {msg.content}
            </pre>
          )}
          {msg.type === 'timed' && (
            <div className="mt-1">
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
                  <Clock size={11} /> Every {INTERVAL_OPTIONS.find(o => o.value === msg.intervalMinutes)?.label ?? `${msg.intervalMinutes} min`}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={toggle} className="text-mc-muted hover:text-mc-green p-1" title={msg.enabled ? 'Disable' : 'Enable'}>
            {msg.enabled ? <ToggleRight size={18} className="text-mc-green" /> : <ToggleLeft size={18} />}
          </button>
          <button onClick={remove} className="text-mc-muted hover:text-red-400 p-1" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {editing && (
        <div className="flex gap-2">
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

  if (loading) return <div className="p-4 text-mc-muted text-sm">Loading…</div>;

  return (
    <div className="p-4 space-y-6">
      {/* Login messages */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <MessageSquare size={14} className="text-mc-green" />
          <h3 className="text-sm font-medium text-gray-200">Login Messages</h3>
        </div>
        <p className="text-xs text-mc-muted mb-3">
          Sent privately to a player when they join via <code className="font-mono">/tell</code>. Supports multiple lines.
        </p>
        <div className="space-y-2">
          {joinMsgs.length === 0 && (
            <div className="text-xs text-mc-muted italic">No login messages yet.</div>
          )}
          {joinMsgs.map((m) => (
            <MessageCard key={m.id} msg={m} serverId={serverId} onUpdated={load} onDeleted={load} />
          ))}
        </div>
        <AddForm type="join" serverId={serverId} onAdded={load} />
      </div>

      {/* Timed messages */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Clock size={14} className="text-mc-green" />
          <h3 className="text-sm font-medium text-gray-200">Timed Messages</h3>
        </div>
        <p className="text-xs text-mc-muted mb-3">
          Broadcast to all players on a repeating interval via <code className="font-mono">/say</code>. Timers start when the server starts.
        </p>
        <div className="space-y-2">
          {timedMsgs.length === 0 && (
            <div className="text-xs text-mc-muted italic">No timed messages yet.</div>
          )}
          {timedMsgs.map((m) => (
            <MessageCard key={m.id} msg={m} serverId={serverId} onUpdated={load} onDeleted={load} />
          ))}
        </div>
        <AddForm type="timed" serverId={serverId} onAdded={load} />
      </div>
    </div>
  );
}

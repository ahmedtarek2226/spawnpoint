import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock } from 'lucide-react';
import { api } from '../../api/client';

interface Schedule {
  id: string;
  action: 'start' | 'stop';
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  createdAt: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function fmt12(hour: number, minute: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function DayPicker({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="flex gap-1">
      {DAY_LABELS.map((label, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(days.includes(i) ? days.filter(d => d !== i) : [...days, i].sort())}
          className={`text-xs w-8 h-7 rounded border transition-colors ${
            days.includes(i)
              ? 'border-mc-green bg-mc-green/15 text-mc-green'
              : 'border-mc-border text-mc-muted hover:border-gray-500'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AddForm({ serverId, onAdded }: { serverId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<'start' | 'stop'>('start');
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (days.length === 0) { setError('Select at least one day'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post(`/servers/${serverId}/schedules`, { action, hour, minute, days });
      setOpen(false);
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-sm w-full justify-center border border-dashed border-mc-border hover:border-mc-green/50">
        <Plus size={14} /> Add schedule
      </button>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="text-sm font-medium text-gray-300">New schedule</div>

      <div className="flex gap-2">
        {(['start', 'stop'] as const).map(a => (
          <button
            key={a}
            type="button"
            onClick={() => setAction(a)}
            className={`flex-1 py-1.5 text-sm rounded border transition-colors ${
              action === a
                ? a === 'start'
                  ? 'border-mc-green bg-mc-green/10 text-mc-green'
                  : 'border-red-600 bg-red-900/20 text-red-400'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            {a === 'start' ? '▶ Start' : '■ Stop'}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <label className="text-xs text-mc-muted w-10">Time</label>
        <select className="input text-xs py-1" value={hour} onChange={e => setHour(Number(e.target.value))}>
          {Array.from({ length: 24 }, (_, i) => (
            <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
          ))}
        </select>
        <span className="text-mc-muted">:</span>
        <select className="input text-xs py-1" value={minute} onChange={e => setMinute(Number(e.target.value))}>
          {[0, 15, 30, 45].map(m => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>
        <span className="text-xs text-mc-muted ml-1">{fmt12(hour, minute)}</span>
      </div>

      <div className="flex gap-2 items-start">
        <label className="text-xs text-mc-muted w-10 pt-1.5">Days</label>
        <div className="space-y-1.5">
          <DayPicker days={days} onChange={setDays} />
          <div className="flex gap-2">
            <button type="button" className="text-xs text-mc-muted hover:text-mc-green" onClick={() => setDays(ALL_DAYS)}>All</button>
            <button type="button" className="text-xs text-mc-muted hover:text-mc-green" onClick={() => setDays([1,2,3,4,5])}>Weekdays</button>
            <button type="button" className="text-xs text-mc-muted hover:text-mc-green" onClick={() => setDays([0,6])}>Weekends</button>
          </div>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2 justify-end">
        <button type="button" className="btn-ghost text-xs" onClick={() => setOpen(false)}>Cancel</button>
        <button type="button" className="btn-primary text-xs" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Add'}
        </button>
      </div>
    </div>
  );
}

function ScheduleRow({ schedule, serverId, onChanged }: {
  schedule: Schedule; serverId: string; onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await api.patch(`/servers/${serverId}/schedules/${schedule.id}`, { enabled: !schedule.enabled });
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await api.delete(`/servers/${serverId}/schedules/${schedule.id}`);
    onChanged();
  }

  const daysLabel = schedule.days.length === 7
    ? 'Every day'
    : schedule.days.length === 5 && !schedule.days.includes(0) && !schedule.days.includes(6)
      ? 'Weekdays'
      : schedule.days.length === 2 && schedule.days.includes(0) && schedule.days.includes(6)
        ? 'Weekends'
        : schedule.days.map(d => DAY_LABELS[d]).join(', ');

  return (
    <div className={`flex items-center gap-3 px-4 py-3 border-b border-mc-border/40 last:border-0 ${!schedule.enabled ? 'opacity-50' : ''}`}>
      <Clock size={14} className={schedule.action === 'start' ? 'text-mc-green flex-shrink-0' : 'text-red-400 flex-shrink-0'} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-200">
          <span className={schedule.action === 'start' ? 'text-mc-green' : 'text-red-400'}>
            {schedule.action === 'start' ? 'Start' : 'Stop'}
          </span>
          {' at '}
          <span className="font-mono">{fmt12(schedule.hour, schedule.minute)}</span>
        </div>
        <div className="text-xs text-mc-muted mt-0.5">{daysLabel}</div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
          schedule.enabled
            ? 'border-mc-green bg-mc-green/10 text-mc-green'
            : 'border-mc-border text-mc-muted hover:border-gray-500'
        }`}
      >
        {schedule.enabled ? 'On' : 'Off'}
      </button>
      <button onClick={remove} className="p-1 rounded hover:bg-red-900/30 text-mc-muted hover:text-red-400" title="Delete">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

export default function ScheduleTab({ serverId }: { serverId: string }) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api.get<Schedule[]>(`/servers/${serverId}/schedules`);
      setSchedules(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load schedules');
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [serverId]);

  if (loading) return <div className="p-6 text-mc-muted">Loading…</div>;

  return (
    <div className="p-4 max-w-xl space-y-4">
      <div>
        <h2 className="text-sm font-medium text-gray-300">Scheduled start / stop</h2>
        <p className="text-xs text-mc-muted mt-0.5">Automatically start or stop this server at set times.</p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
      )}

      {schedules.length > 0 && (
        <div className="card overflow-hidden">
          {schedules.map(s => (
            <ScheduleRow key={s.id} schedule={s} serverId={serverId} onChanged={load} />
          ))}
        </div>
      )}

      <AddForm serverId={serverId} onAdded={load} />
    </div>
  );
}

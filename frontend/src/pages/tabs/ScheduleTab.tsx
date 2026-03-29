import { useState, useEffect } from 'react';
import { Plus, Trash2, Clock, CalendarX, Play, Square, RotateCw, X } from 'lucide-react';
import { api } from '../../api/client';

interface Schedule {
  id: string;
  action: 'start' | 'stop' | 'restart';
  hour: number;
  minute: number;
  days: number[];
  enabled: boolean;
  createdAt: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const ACTION_CONFIG = {
  start:   { label: 'Start',   Icon: Play,     border: 'border-mc-green',  text: 'text-mc-green',  bg: 'bg-mc-green/10',   dot: 'bg-mc-green',   ring: 'ring-mc-green/40'  },
  stop:    { label: 'Stop',    Icon: Square,   border: 'border-red-500',   text: 'text-red-400',   bg: 'bg-red-900/20',    dot: 'bg-red-500',    ring: 'ring-red-500/40'   },
  restart: { label: 'Restart', Icon: RotateCw, border: 'border-amber-500', text: 'text-amber-400', bg: 'bg-amber-900/20',  dot: 'bg-amber-400',  ring: 'ring-amber-400/40' },
} as const;

function fmt24(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function fmtAmPm(hour: number) {
  return hour >= 12 ? 'PM' : 'AM';
}

function nextRun(schedule: Schedule): string {
  const now = new Date();
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);
    const dayOfWeek = candidate.getDay();
    if (!schedule.days.includes(dayOfWeek)) continue;
    candidate.setHours(schedule.hour, schedule.minute, 0, 0);
    if (candidate <= now) continue;
    const diffMs = candidate.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 60) return `in ${diffMins}m`;
    if (diffHours < 24) return `in ${diffHours}h ${diffMins % 60}m`;
    if (daysAhead === 1) return `tomorrow`;
    return DAY_LABELS[dayOfWeek];
  }
  return '';
}

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
        enabled ? 'border-mc-green bg-mc-green' : 'border-mc-border bg-mc-border/40'
      }`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${
        enabled ? 'translate-x-3.5' : 'translate-x-0.5'
      } mt-[1px]`} />
    </button>
  );
}

function DayDots({ days, action, onChange }: {
  days: number[];
  action: 'start' | 'stop' | 'restart';
  onChange?: (d: number[]) => void;
}) {
  const cfg = ACTION_CONFIG[action];
  return (
    <div className="flex gap-1.5">
      {DAY_LABELS.map((label, i) => {
        const active = days.includes(i);
        return (
          <button
            key={i}
            type="button"
            disabled={!onChange}
            onClick={() => onChange && onChange(active ? days.filter(d => d !== i) : [...days, i].sort())}
            className={`flex flex-col items-center gap-0.5 group ${onChange ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <span className={`text-[10px] font-medium transition-colors ${active ? cfg.text : 'text-mc-muted/40'}`}>
              {label[0]}
            </span>
            <span className={`w-4 h-4 rounded-full transition-all ${
              active
                ? `${cfg.dot} ring-2 ${cfg.ring}`
                : `bg-mc-border/30 ${onChange ? 'group-hover:bg-mc-border' : ''}`
            }`} />
          </button>
        );
      })}
    </div>
  );
}

function ScheduleCard({ schedule, serverId, onChanged }: {
  schedule: Schedule; serverId: string; onChanged: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const cfg = ACTION_CONFIG[schedule.action];
  const Icon = cfg.Icon;
  const next = schedule.enabled ? nextRun(schedule) : null;

  async function toggle() {
    setToggling(true);
    try {
      await api.patch(`/servers/${serverId}/schedules/${schedule.id}`, { enabled: !schedule.enabled });
      onChanged();
    } finally {
      setToggling(false);
    }
  }

  async function remove() {
    await api.delete(`/servers/${serverId}/schedules/${schedule.id}`);
    onChanged();
  }

  return (
    <div className={`bg-mc-dark border rounded-xl p-4 transition-opacity ${!schedule.enabled ? 'opacity-40' : ''} ${cfg.border}`}>
      {/* Top row */}
      <div className="flex items-center gap-3 mb-3">
        {/* Action pill */}
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.border} ${cfg.bg} ${cfg.text} flex-shrink-0`}>
          <Icon size={10} strokeWidth={2.5} />
          {cfg.label}
        </span>

        {/* Time */}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-mono font-bold text-gray-100 tracking-tight leading-none">
            {fmt24(schedule.hour, schedule.minute)}
          </span>
          <span className="text-xs text-mc-muted font-mono">{fmtAmPm(schedule.hour)}</span>
        </div>

        <div className="flex-1" />

        {/* Next run */}
        {next && (
          <span className="text-xs text-mc-muted flex items-center gap-1 flex-shrink-0">
            <Clock size={10} className="text-mc-green/50" />
            {next}
          </span>
        )}

        {/* Toggle */}
        <Toggle enabled={schedule.enabled} onChange={toggle} disabled={toggling} />

        {/* Delete */}
        <button
          onClick={remove}
          className="p-1 rounded-lg hover:bg-red-900/30 text-mc-muted hover:text-red-400 transition-colors flex-shrink-0"
          title="Delete"
        >
          <X size={13} />
        </button>
      </div>

      {/* Days */}
      <DayDots days={schedule.days} action={schedule.action} />
    </div>
  );
}

function AddForm({ serverId, onAdded }: { serverId: string; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<'start' | 'stop' | 'restart'>('start');
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
      setAction('start');
      setHour(8);
      setMinute(0);
      setDays([1, 2, 3, 4, 5]);
      onAdded();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-mc-border text-mc-muted hover:border-mc-green/50 hover:text-mc-green text-sm transition-colors"
      >
        <Plus size={14} /> Add schedule
      </button>
    );
  }

  const cfg = ACTION_CONFIG[action];

  return (
    <div className={`bg-mc-dark border rounded-xl p-4 space-y-4 ${cfg.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-200">New schedule</span>
        <button onClick={() => setOpen(false)} className="text-mc-muted hover:text-gray-300 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Action */}
      <div className="grid grid-cols-3 gap-2">
        {(['start', 'stop', 'restart'] as const).map(a => {
          const c = ACTION_CONFIG[a];
          const active = action === a;
          return (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              className={`flex items-center justify-center gap-2 py-2.5 text-xs font-medium rounded-lg border transition-colors ${
                active ? `${c.border} ${c.bg} ${c.text}` : 'border-mc-border text-mc-muted hover:border-gray-500 hover:text-gray-300'
              }`}
            >
              <c.Icon size={12} strokeWidth={2.5} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Time */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-mc-panel border border-mc-border rounded-lg px-3 py-2">
          <select
            className="bg-transparent text-gray-100 text-xl font-mono font-bold outline-none w-12 text-center"
            value={hour}
            onChange={e => setHour(Number(e.target.value))}
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
            ))}
          </select>
          <span className="text-gray-500 text-xl font-mono font-bold">:</span>
          <select
            className="bg-transparent text-gray-100 text-xl font-mono font-bold outline-none w-12 text-center"
            value={minute}
            onChange={e => setMinute(Number(e.target.value))}
          >
            {[0, 15, 30, 45].map(m => (
              <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
            ))}
          </select>
          <span className="text-mc-muted text-xs font-mono ml-1">{fmtAmPm(hour)}</span>
        </div>

        <div className="text-xs text-mc-muted space-y-0.5">
          <div className="flex gap-2">
            <button type="button" className="hover:text-mc-green transition-colors" onClick={() => setHour(8)}>Morning</button>
            <button type="button" className="hover:text-mc-green transition-colors" onClick={() => setHour(12)}>Noon</button>
            <button type="button" className="hover:text-mc-green transition-colors" onClick={() => setHour(20)}>Evening</button>
          </div>
        </div>
      </div>

      {/* Days */}
      <div className="space-y-2">
        <DayDots days={days} action={action} onChange={setDays} />
        <div className="flex gap-3 pt-1">
          <button type="button" className="text-xs text-mc-muted hover:text-mc-green transition-colors" onClick={() => setDays(ALL_DAYS)}>Every day</button>
          <button type="button" className="text-xs text-mc-muted hover:text-mc-green transition-colors" onClick={() => setDays([1,2,3,4,5])}>Weekdays</button>
          <button type="button" className="text-xs text-mc-muted hover:text-mc-green transition-colors" onClick={() => setDays([0,6])}>Weekends</button>
          {days.length > 0 && <button type="button" className="text-xs text-mc-muted hover:text-red-400 transition-colors ml-auto" onClick={() => setDays([])}>Clear</button>}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        className="btn-primary w-full text-sm"
        onClick={save}
        disabled={saving || days.length === 0}
      >
        {saving ? 'Saving…' : `Add ${cfg.label} at ${fmt24(hour, minute)}`}
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
    <div className="p-4 max-w-xl space-y-3">
      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-3 py-2 text-sm">{error}</div>
      )}

      {schedules.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <CalendarX size={36} className="text-mc-muted opacity-20" />
          <div>
            <p className="text-sm text-mc-muted">No schedules yet</p>
            <p className="text-xs text-mc-muted/50 mt-1">Automatically start, stop, or restart this server on a weekly schedule.</p>
          </div>
        </div>
      )}

      {schedules.map(s => (
        <ScheduleCard key={s.id} schedule={s} serverId={serverId} onChanged={load} />
      ))}

      <AddForm serverId={serverId} onAdded={load} />
    </div>
  );
}

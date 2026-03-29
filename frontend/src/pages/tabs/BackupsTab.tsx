import { useState, useEffect, useRef } from 'react';
import { Archive, RotateCw, Trash2, Download, Plus, Globe, HardDrive, Package, Upload, Clock, Loader2, CheckCircle2, FolderOpen, Copy, Check, X } from 'lucide-react';
import { api } from '../../api/client';
import { useServersStore } from '../../stores/serversStore';

interface Backup {
  id: string;
  label: string;
  sizeBytes: number;
  type: 'full' | 'world';
  createdAt: string;
}

interface ModpackInfo {
  name?: string;
  version?: string;
  mcVersion?: string;
  loader?: string;
  loaderVersion?: string;
}

interface BackupsData {
  backups: Backup[];
  worldDirs: string[];
  modpackInfo: ModpackInfo;
}

interface BackupSchedule {
  backupEnabled: boolean;
  backupIntervalHours: number;
  backupRetainCount: number;
  backupLastAt: string | null;
}

const INTERVAL_OPTIONS = [
  { label: 'Every 6 hours', value: 6 },
  { label: 'Every 12 hours', value: 12 },
  { label: 'Every 24 hours', value: 24 },
  { label: 'Every 2 days', value: 48 },
  { label: 'Every week', value: 168 },
];

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtRelative(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 30) return new Date(isoStr).toLocaleString();
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="p-1 rounded hover:bg-mc-border text-mc-muted hover:text-gray-300 transition-colors flex-shrink-0"
      title="Copy path"
    >
      {copied ? <Check size={12} className="text-mc-green" /> : <Copy size={12} />}
    </button>
  );
}

function PathRow({ label, path, note }: { label: string; path: string; note?: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-gray-400">{label}</div>
      <div className="flex items-center gap-2 bg-mc-dark border border-mc-border rounded-lg px-3 py-2">
        <FolderOpen size={13} className="text-mc-muted flex-shrink-0" />
        <span className="font-mono text-xs text-gray-200 flex-1 break-all">{path}</span>
        <CopyButton text={path} />
      </div>
      {note && <p className="text-xs text-mc-muted/70 pl-1">{note}</p>}
    </div>
  );
}

function WorldDirsCard({ serverId, worldDirs }: { serverId: string; worldDirs: string[] }) {
  const server = useServersStore((s) => s.servers.find((sv) => sv.id === serverId));
  const hostDir = server?.hostDirectory ?? '';

  const levelName = worldDirs[0] ?? 'world';
  const standard = new Set([levelName, `${levelName}_nether`, `${levelName}_the_end`]);
  const modDirs = worldDirs.filter((d) => !standard.has(d));

  return (
    <div className="card border-l-2 border-blue-500 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Globe size={13} className="text-blue-400 flex-shrink-0" />
        <span className="text-xs font-medium text-gray-300">World save locations</span>
        {modDirs.length > 0 && (
          <span className="ml-auto text-xs text-yellow-500/80 bg-yellow-900/20 border border-yellow-700/30 px-1.5 py-0.5 rounded">
            {modDirs.length} mod dim{modDirs.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {worldDirs.map((d) => {
          const isMod = !standard.has(d);
          return (
            <div key={d} className="flex items-center gap-2 group">
              <span className={`flex-shrink-0 text-xs ${isMod ? 'text-yellow-400' : 'text-blue-400'}`}>
                {isMod ? <Package size={11} /> : <Globe size={11} />}
              </span>
              <code className="flex-1 font-mono text-xs text-gray-300 bg-mc-dark border border-mc-border rounded px-2 py-1 truncate min-w-0">
                {hostDir ? `${hostDir}/${d}` : d}
              </code>
              {hostDir && <CopyButton text={`${hostDir}/${d}`} />}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-mc-muted">World backups include these folders. Full backups include everything.</p>
    </div>
  );
}

function SaveLocationsModal({ serverId, worldDirs, onClose }: {
  serverId: string;
  worldDirs: string[];
  onClose: () => void;
}) {
  const server = useServersStore((s) => s.servers.find((sv) => sv.id === serverId));
  if (!server) return null;

  const hostDir = server.hostDirectory;
  const levelName = worldDirs[0] ?? 'world';
  const standardDirs = new Set([levelName, `${levelName}_nether`, `${levelName}_the_end`]);
  const modDirs = worldDirs.filter((d) => !standardDirs.has(d));
  const standardFound = worldDirs.filter((d) => standardDirs.has(d));
  const isSplitDims = standardFound.includes(`${levelName}_nether`) || standardFound.includes(`${levelName}_the_end`);

  function dimNote(dir: string): string {
    if (dir.endsWith('_nether')) return 'Nether dimension — managed separately by Spigot/Paper.';
    if (dir.endsWith('_the_end')) return 'The End dimension — managed separately by Spigot/Paper.';
    if (!isSplitDims && modDirs.length === 0)
      return 'Overworld chunks, player data, level.dat. Nether lives at DIM-1/ and The End at DIM1/ inside this folder.';
    return 'Overworld chunks, player data, level.dat.';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-mc-panel border border-mc-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-mc-border">
          <Globe size={16} className="text-mc-green" />
          <div>
            <h2 className="text-sm font-semibold text-gray-200">World Save Locations</h2>
            <p className="text-xs text-mc-muted mt-0.5">Detected by scanning for <code className="font-mono text-gray-400">region/</code> folders on disk.</p>
          </div>
          <button onClick={onClose} className="ml-auto text-mc-muted hover:text-gray-300 transition-colors p-1">
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
          {worldDirs.length > 0 ? (
            <>
              {/* Standard dirs */}
              {standardFound.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Standard worlds</p>
                  {standardFound.map((dir) => (
                    <div key={dir} className="border border-mc-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-mc-dark border-b border-mc-border">
                        <Globe size={12} className="text-mc-green flex-shrink-0" />
                        <span className="text-xs font-semibold text-gray-300">{dir}/</span>
                      </div>
                      <div className="px-3 py-2.5 space-y-2">
                        <p className="text-xs text-mc-muted">{dimNote(dir)}</p>
                        <PathRow label="Host path" path={`${hostDir}/${dir}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Mod-added dimension dirs */}
              {modDirs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Mod dimensions</p>
                  {modDirs.map((dir) => (
                    <div key={dir} className="border border-yellow-700/40 rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-yellow-900/10 border-b border-yellow-700/30">
                        <Package size={12} className="text-yellow-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-gray-300">{dir}/</span>
                        <span className="ml-auto text-xs text-yellow-500/70">mod dimension</span>
                      </div>
                      <div className="px-3 py-2.5 space-y-2">
                        <p className="text-xs text-mc-muted">Custom dimension added by a mod. Contains its own chunk data.</p>
                        <PathRow label="Host path" path={`${hostDir}/${dir}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Note about world backup vs full backup */}
              <div className="bg-mc-dark border border-mc-border/50 rounded-lg px-3 py-2.5 text-xs text-mc-muted space-y-1.5">
                <p className="text-gray-300 font-medium">World backup vs Full backup</p>
                <p>A <span className="text-gray-300">World backup</span> captures all the folders listed above. A <span className="text-gray-300">Full backup</span> captures the entire server directory — use it if a mod stores save data outside these folders (e.g. in <code className="font-mono text-gray-400">config/</code> or a custom top-level folder without a <code className="font-mono text-gray-400">region/</code> subfolder).</p>
              </div>
            </>
          ) : (
            <div className="py-6 text-center space-y-2">
              <Globe size={28} className="text-mc-muted opacity-30 mx-auto" />
              <p className="text-sm text-mc-muted">No world folders found yet.</p>
              <p className="text-xs text-mc-muted/60">Start the server at least once to generate world data.</p>
              <div className="mt-4 border border-mc-border rounded-lg px-3 py-2.5 text-left">
                <p className="text-xs text-mc-muted mb-2">Once generated, the world will appear at:</p>
                <PathRow label="Expected location" path={`${hostDir}/world`} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BackupsTab({ serverId }: { serverId: string }) {
  const backingUp = useServersStore((s) => s.servers.find((sv) => sv.id === serverId)?.runtime.backingUp ?? false);
  const [data, setData] = useState<BackupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [baseLabel, setBaseLabel] = useState('');
  const [suggestedBase, setSuggestedBase] = useState('');
  const [backupType, setBackupType] = useState<'full' | 'world'>('world');
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [schedule, setSchedule] = useState<BackupSchedule>({
    backupEnabled: false,
    backupIntervalHours: 24,
    backupRetainCount: 5,
    backupLastAt: null,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [announceEnabled, setAnnounceEnabled] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState('World save starting, expect brief lag…');

  const label = baseLabel ? `${baseLabel}_${backupType}` : '';

  function deriveSuggested(mp: ModpackInfo): string {
    const raw = mp.name && mp.version
      ? `${mp.name} v${mp.version}`
      : mp.name ?? (mp.version ? `v${mp.version}` : (mp.mcVersion ? `MC ${mp.mcVersion}${mp.loader ? ` ${mp.loader}` : ''}` : ''));
    return raw.replace(/ /g, '_');
  }

  async function load(resetLabel = false) {
    try {
      const [d, srv] = await Promise.all([
        api.get<BackupsData>(`/servers/${serverId}/backups`),
        api.get<BackupSchedule & Record<string, unknown>>(`/servers/${serverId}`),
      ]);
      setData(d);
      setSchedule({
        backupEnabled: srv.backupEnabled ?? false,
        backupIntervalHours: srv.backupIntervalHours ?? 24,
        backupRetainCount: srv.backupRetainCount ?? 5,
        backupLastAt: srv.backupLastAt ?? null,
      });
      const suggested = deriveSuggested(d.modpackInfo);
      if (suggested) {
        setSuggestedBase(suggested);
        if (resetLabel || !baseLabel) setBaseLabel(suggested);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load backups');
    }
    setLoading(false);
  }

  async function saveSchedule(patch: Partial<BackupSchedule>) {
    const prev = schedule;
    const next = { ...schedule, ...patch };
    setSchedule(next);
    setSavingSchedule(true);
    try {
      await api.patch(`/servers/${serverId}`, {
        backupEnabled: next.backupEnabled,
        backupIntervalHours: next.backupIntervalHours,
        backupRetainCount: next.backupRetainCount,
      });
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2000);
    } catch (e: unknown) {
      setSchedule(prev);
      setError(e instanceof Error ? e.message : 'Failed to save schedule');
    }
    setSavingSchedule(false);
  }

  useEffect(() => { load(); }, [serverId]);

  async function create() {
    setCreating(true);
    setError('');
    try {
      await api.post(`/servers/${serverId}/backups`, {
        label: label || undefined,
        type: backupType,
        announceMessage: announceEnabled ? announceMessage : undefined,
      });
      setBaseLabel(suggestedBase);
      setSuccessToast('Backup created successfully');
      setTimeout(() => setSuccessToast(null), 3000);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    }
    setCreating(false);
  }

  async function restore(backup: Backup) {
    if (confirmRestoreId !== backup.id) { setConfirmRestoreId(backup.id); setConfirmDeleteId(null); return; }
    setConfirmRestoreId(null);
    setRestoring(backup.id);
    setError('');
    setRestoreSuccess(null);
    try {
      await api.post(`/servers/${serverId}/backups/${backup.id}/restore`);
      setRestoreSuccess(backup.label);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Restore failed');
    }
    setRestoring(null);
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/servers/${serverId}/backups/upload`, { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error?.message ?? 'Upload failed');
      setSuccessToast('Backup imported');
      setTimeout(() => setSuccessToast(null), 3000);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
    e.target.value = '';
  }

  async function remove(id: string) {
    if (confirmDeleteId !== id) { setConfirmDeleteId(id); setConfirmRestoreId(null); return; }
    setConfirmDeleteId(null);
    try {
      await api.delete(`/servers/${serverId}/backups/${id}`);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const backups = data?.backups ?? [];
  const worldDirs = data?.worldDirs ?? [];

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* In-progress banner */}
      {backingUp && (
        <div className="flex items-center gap-2.5 bg-mc-green/10 border border-mc-green/30 rounded-lg px-4 py-3 text-sm text-mc-green">
          <Loader2 size={14} className="animate-spin flex-shrink-0" />
          <span>Auto-backup in progress…</span>
        </div>
      )}

      {error && (
        <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-3 py-2 text-sm">{error}</div>
      )}
      {successToast && (
        <div className="flex items-center gap-2 bg-mc-green/10 border border-mc-green/30 rounded-lg px-3 py-2 text-sm text-mc-green">
          <CheckCircle2 size={14} className="flex-shrink-0" />
          {successToast}
        </div>
      )}

      {restoreSuccess && (
        <div className="flex items-center gap-2.5 bg-mc-green/10 border border-mc-green/30 rounded-lg px-4 py-3 text-sm text-mc-green">
          <CheckCircle2 size={15} className="flex-shrink-0" />
          <div>
            <span className="font-medium">Restore complete.</span>
            <span className="text-mc-green/70 ml-1">
              "{restoreSuccess}" has been restored. The server has been restarted if it was running.
            </span>
          </div>
          <button onClick={() => setRestoreSuccess(null)} className="ml-auto text-mc-green/50 hover:text-mc-green transition-colors flex-shrink-0">
            ×
          </button>
        </div>
      )}

      {/* World dirs */}
      {worldDirs.length > 0 && <WorldDirsCard serverId={serverId} worldDirs={worldDirs} />}

      {/* Auto-backup schedule */}
      <div className="card border-l-2 border-yellow-500 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-yellow-400" />
            <span className="text-sm font-medium text-gray-300">Auto-backup</span>
            {scheduleSaved && <span className="text-xs text-mc-green font-medium">Saved ✓</span>}
          </div>
          <Toggle
            enabled={schedule.backupEnabled}
            onChange={() => saveSchedule({ backupEnabled: !schedule.backupEnabled })}
            disabled={savingSchedule}
          />
        </div>

        {schedule.backupEnabled && (
          <div className="space-y-2.5 pt-2 border-t border-mc-border/40">
            <div className="flex items-center gap-3">
              <label className="text-xs text-mc-muted w-20 flex-shrink-0">Interval</label>
              <select
                className="input text-xs py-1.5 flex-1"
                value={schedule.backupIntervalHours}
                onChange={e => saveSchedule({ backupIntervalHours: Number(e.target.value) })}
              >
                {INTERVAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-mc-muted w-20 flex-shrink-0">Keep last</label>
              <select
                className="input text-xs py-1.5 flex-1"
                value={schedule.backupRetainCount}
                onChange={e => saveSchedule({ backupRetainCount: Number(e.target.value) })}
              >
                {[3, 5, 7, 10, 14, 30].map(n => (
                  <option key={n} value={n}>{n} backups</option>
                ))}
              </select>
            </div>
            {schedule.backupLastAt && (
              <p className="text-xs text-mc-muted">
                Last backup: {new Date(schedule.backupLastAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Create backup */}
      <div className="card border-l-2 border-mc-green p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Plus size={14} className="text-mc-green" />
          <span className="text-sm font-medium text-gray-300">Create backup</span>
        </div>

        <input
          className="input w-full"
          value={label}
          onChange={(e) => {
            const v = e.target.value.replace(/ /g, '_');
            const suffix = `_${backupType}`;
            setBaseLabel(v.endsWith(suffix) ? v.slice(0, -suffix.length) : v);
          }}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Label (optional)"
        />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setBackupType('world')}
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg text-sm border transition-colors ${
              backupType === 'world'
                ? 'border-mc-green bg-mc-green/10 text-mc-green'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            <Globe size={15} className="flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-xs">World save</div>
              <div className="text-xs opacity-60">World data only · fast</div>
            </div>
          </button>
          <button
            onClick={() => setBackupType('full')}
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-lg text-sm border transition-colors ${
              backupType === 'full'
                ? 'border-mc-green bg-mc-green/10 text-mc-green'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            <HardDrive size={15} className="flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium text-xs">Full backup</div>
              <div className="text-xs opacity-60">Everything · slower</div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Toggle enabled={announceEnabled} onChange={() => setAnnounceEnabled(v => !v)} />
          <span className="text-xs text-mc-muted">Announce in-game</span>
          {announceEnabled && (
            <input
              className="input flex-1 text-xs py-1.5"
              value={announceMessage}
              onChange={e => setAnnounceMessage(e.target.value)}
              placeholder="Message to broadcast…"
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={create} className="btn-primary flex-1" disabled={creating}>
            {creating
              ? <><Loader2 size={13} className="animate-spin" /> Creating…</>
              : <><Plus size={13} /> Create {backupType === 'world' ? 'world save' : 'full'} backup</>
            }
          </button>
          <input ref={uploadRef} type="file" accept=".tar.gz" className="hidden" onChange={onUpload} />
          <button onClick={() => uploadRef.current?.click()} className="btn-ghost" disabled={uploading} title="Import backup (.tar.gz)">
            <Upload size={13} /> {uploading ? 'Uploading…' : 'Import'}
          </button>
        </div>
      </div>

      {/* Backup list */}
      {loading ? (
        <div className="flex items-center gap-2 text-mc-muted text-sm py-4">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : backups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
          <Archive size={36} className="text-mc-muted opacity-30" />
          <div>
            <p className="text-sm text-mc-muted">No backups yet</p>
            <p className="text-xs text-mc-muted/60 mt-1">Create your first backup above</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-mc-border bg-mc-panel/40 flex items-center gap-2">
            <Archive size={13} className="text-mc-muted" />
            <span className="text-xs font-medium text-mc-muted">{backups.length} backup{backups.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
              <tr>
                <th className="text-left px-4 py-2.5">Label</th>
                <th className="text-left px-4 py-2.5 hidden sm:table-cell">Type</th>
                <th className="text-right px-4 py-2.5">Size</th>
                <th className="text-right px-4 py-2.5 hidden md:table-cell">Created</th>
                <th className="px-4 py-2.5 w-24" />
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-mc-border/40 hover:bg-mc-panel/40 transition-colors">
                  <td className="px-4 py-2.5 text-gray-200">{b.label}</td>
                  <td className="px-4 py-2.5 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border ${
                      b.type === 'world'
                        ? 'bg-blue-900/30 text-blue-300 border-blue-700/30'
                        : 'bg-mc-panel text-mc-muted border-mc-border'
                    }`}>
                      {b.type === 'world' ? <Globe size={10} /> : <HardDrive size={10} />}
                      {b.type === 'world' ? 'World' : 'Full'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-mc-muted text-xs">{fmtSize(b.sizeBytes)}</td>
                  <td className="px-4 py-2.5 text-right text-mc-muted text-xs hidden md:table-cell" title={new Date(b.createdAt).toLocaleString()}>
                    {fmtRelative(b.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-0.5 justify-end">
                      {confirmRestoreId === b.id ? (
                        <>
                          <button onClick={() => restore(b)} className="text-xs text-yellow-400 hover:text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-700/50 hover:bg-yellow-900/30 transition-colors whitespace-nowrap">
                            Restore?
                          </button>
                          <button onClick={() => setConfirmRestoreId(null)} className="p-1 text-mc-muted hover:text-gray-300 transition-colors">
                            <X size={11} />
                          </button>
                        </>
                      ) : confirmDeleteId === b.id ? (
                        <>
                          <button onClick={() => remove(b.id)} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded border border-red-700/50 hover:bg-red-900/30 transition-colors whitespace-nowrap">
                            Delete?
                          </button>
                          <button onClick={() => setConfirmDeleteId(null)} className="p-1 text-mc-muted hover:text-gray-300 transition-colors">
                            <X size={11} />
                          </button>
                        </>
                      ) : (
                        <>
                          <a
                            href={`/api/servers/${serverId}/backups/${b.id}/download`}
                            download
                            className="p-1.5 rounded hover:bg-mc-border text-mc-muted hover:text-gray-300 transition-colors"
                            title="Download"
                          >
                            <Download size={13} />
                          </a>
                          <button
                            onClick={() => restore(b)}
                            disabled={restoring === b.id}
                            className="p-1.5 rounded hover:bg-yellow-900/30 text-mc-muted hover:text-yellow-400 disabled:opacity-40 transition-colors"
                            title="Restore"
                          >
                            <RotateCw size={13} className={restoring === b.id ? 'animate-spin' : ''} />
                          </button>
                          <button
                            onClick={() => remove(b.id)}
                            className="p-1.5 rounded hover:bg-red-900/30 text-mc-muted hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

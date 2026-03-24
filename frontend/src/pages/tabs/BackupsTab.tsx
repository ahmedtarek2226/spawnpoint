import { useState, useEffect, useRef } from 'react';
import { Archive, RotateCw, Trash2, Download, Plus, Globe, HardDrive, Package, Upload, Clock } from 'lucide-react';
import { api } from '../../api/client';

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

function fmtSize(b: number) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const INTERVAL_OPTIONS = [
  { label: 'Every 6 hours', value: 6 },
  { label: 'Every 12 hours', value: 12 },
  { label: 'Every 24 hours', value: 24 },
  { label: 'Every 2 days', value: 48 },
  { label: 'Every week', value: 168 },
];

export default function BackupsTab({ serverId }: { serverId: string }) {
  const [data, setData] = useState<BackupsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [baseLabel, setBaseLabel] = useState('');
  const [suggestedBase, setSuggestedBase] = useState('');
  const [backupType, setBackupType] = useState<'full' | 'world'>('world');
  const [error, setError] = useState('');
  const [restoring, setRestoring] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [schedule, setSchedule] = useState<BackupSchedule>({
    backupEnabled: false,
    backupIntervalHours: 24,
    backupRetainCount: 5,
    backupLastAt: null,
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

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
    const next = { ...schedule, ...patch };
    setSchedule(next);
    setSavingSchedule(true);
    try {
      await api.patch(`/servers/${serverId}`, {
        backupEnabled: next.backupEnabled,
        backupIntervalHours: next.backupIntervalHours,
        backupRetainCount: next.backupRetainCount,
      });
    } catch (e: unknown) {
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
      });
      setBaseLabel(suggestedBase);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Backup failed');
    }
    setCreating(false);
  }

  async function restore(backup: Backup) {
    const typeLabel = backup.type === 'world' ? 'world data only' : 'entire server directory';
    if (!confirm(
      `Restore "${backup.label}"?\n\nThis will restore ${typeLabel}. ` +
      `The server will stop, files will be replaced, then restart if it was running.`
    )) return;
    setRestoring(backup.id);
    setError('');
    try {
      await api.post(`/servers/${serverId}/backups/${backup.id}/restore`);
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
      await fetch(`/api/servers/${serverId}/backups/upload`, { method: 'POST', body: form });
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
    e.target.value = '';
  }

  async function remove(id: string) {
    if (!confirm('Delete this backup?')) return;
    try {
      await api.delete(`/servers/${serverId}/backups/${id}`);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  const backups = data?.backups ?? [];
  const worldDirs = data?.worldDirs ?? [];
  const modpackInfo = data?.modpackInfo ?? {};

  function modpackSummary(): string | null {
    const parts: string[] = [];
    if (modpackInfo.name) parts.push(modpackInfo.name);
    if (modpackInfo.version) parts.push(`v${modpackInfo.version}`);
    if (!modpackInfo.name && modpackInfo.mcVersion) parts.push(`MC ${modpackInfo.mcVersion}`);
    if (modpackInfo.loader) {
      const loaderLabel = modpackInfo.loaderVersion
        ? `${modpackInfo.loader} ${modpackInfo.loaderVersion}`
        : modpackInfo.loader;
      parts.push(loaderLabel);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  }

  return (
    <div className="p-4 space-y-4">
      {/* World save info */}
      {worldDirs.length > 0 && (
        <div className="card p-3 flex items-start gap-3 text-sm">
          <Globe size={15} className="text-mc-green mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-gray-300 font-medium mb-1">World save directories</div>
            <div className="flex flex-wrap gap-1.5">
              {worldDirs.map((d) => (
                <span key={d} className="font-mono text-xs bg-mc-dark border border-mc-border rounded px-2 py-0.5 text-gray-300">
                  {d}/
                </span>
              ))}
            </div>
            <p className="text-mc-muted text-xs mt-1.5">
              World-save backups include only these directories. Full backups include everything (mods, configs, logs, world).
            </p>
          </div>
        </div>
      )}

      {/* Modpack info */}
      {modpackSummary() && (
        <div className="card p-3 flex items-center gap-3 text-sm">
          <Package size={15} className="text-mc-green flex-shrink-0" />
          <div className="min-w-0flex-1">
            <span className="text-gray-300 font-medium">{modpackInfo.name ?? 'Modpack'}</span>
            {modpackInfo.version && <span className="text-mc-green ml-2 font-mono text-xs">v{modpackInfo.version}</span>}
            {(modpackInfo.mcVersion || modpackInfo.loader) && (
              <span className="text-mc-muted text-xs ml-2">
                {[modpackInfo.mcVersion && `MC ${modpackInfo.mcVersion}`, modpackInfo.loader].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Auto-backup schedule */}
      <div className="card p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-mc-green" />
            <span className="text-sm font-medium text-gray-300">Auto backup</span>
          </div>
          <button
            onClick={() => saveSchedule({ backupEnabled: !schedule.backupEnabled })}
            disabled={savingSchedule}
            className={`text-xs px-3 py-1 rounded border transition-colors ${
              schedule.backupEnabled
                ? 'border-mc-green bg-mc-green/10 text-mc-green'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            {schedule.backupEnabled ? 'Enabled' : 'Disabled'}
          </button>
        </div>

        {schedule.backupEnabled && (
          <div className="space-y-2 pt-1 border-t border-mc-border">
            <div className="flex items-center gap-3">
              <label className="text-xs text-mc-muted w-24">Interval</label>
              <select
                className="input text-xs py-1 flex-1"
                value={schedule.backupIntervalHours}
                onChange={e => saveSchedule({ backupIntervalHours: Number(e.target.value) })}
              >
                {INTERVAL_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-mc-muted w-24">Keep last</label>
              <select
                className="input text-xs py-1 flex-1"
                value={schedule.backupRetainCount}
                onChange={e => saveSchedule({ backupRetainCount: Number(e.target.value) })}
              >
                {[3, 5, 7, 10, 14, 30].map(n => (
                  <option key={n} value={n}>{n} backups</option>
                ))}
              </select>
            </div>
            {schedule.backupLastAt && (
              <p className="text-xs text-mc-muted pt-0.5">
                Last auto backup: {new Date(schedule.backupLastAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
      )}

      {/* Create backup */}
      <div className="card p-3 space-y-3">
        <div className="text-sm font-medium text-gray-300">Create backup</div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={label}
            onChange={(e) => {
              const v = e.target.value.replace(/ /g, '_');
              const suffix = `_${backupType}`;
              setBaseLabel(v.endsWith(suffix) ? v.slice(0, -suffix.length) : v);
            }}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            placeholder="Label (optional)"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setBackupType('world')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded text-sm border transition-colors ${
              backupType === 'world'
                ? 'border-mc-green bg-mc-green/10 text-mc-green'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            <Globe size={14} />
            <div className="text-left">
              <div className="font-medium">World save</div>
              <div className="text-xs opacity-70">World data only · fast</div>
            </div>
          </button>
          <button
            onClick={() => setBackupType('full')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded text-sm border transition-colors ${
              backupType === 'full'
                ? 'border-mc-green bg-mc-green/10 text-mc-green'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            <HardDrive size={14} />
            <div className="text-left">
              <div className="font-medium">Full backup</div>
              <div className="text-xs opacity-70">Everything · slower</div>
            </div>
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={create} className="btn-primary flex-1" disabled={creating}>
            <Plus size={14} /> {creating ? 'Creating…' : `Create ${backupType === 'world' ? 'world save' : 'full'} backup`}
          </button>
          <input ref={uploadRef} type="file" accept=".tar.gz" className="hidden" onChange={onUpload} />
          <button onClick={() => uploadRef.current?.click()} className="btn-ghost" disabled={uploading} title="Import backup (.tar.gz)">
            <Upload size={14} /> {uploading ? 'Uploading…' : 'Import'}
          </button>
        </div>
      </div>

      {/* Backup list */}
      {loading ? (
        <div className="text-mc-muted text-sm">Loading…</div>
      ) : backups.length === 0 ? (
        <div className="card p-8 text-center text-mc-muted">
          <Archive size={32} className="mx-auto mb-2 opacity-40" />
          <div>No backups yet</div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
              <tr>
                <th className="text-left px-4 py-2">Label</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-right px-4 py-2">Size</th>
                <th className="text-right px-4 py-2">Created</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.id} className="border-b border-mc-border/40 hover:bg-mc-panel/40">
                  <td className="px-4 py-2 text-gray-200">{b.label}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${
                      b.type === 'world'
                        ? 'bg-blue-900/40 text-blue-300 border border-blue-700/40'
                        : 'bg-mc-panel text-mc-muted border border-mc-border'
                    }`}>
                      {b.type === 'world' ? <Globe size={10} /> : <HardDrive size={10} />}
                      {b.type === 'world' ? 'World' : 'Full'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-mc-muted text-xs">{fmtSize(b.sizeBytes)}</td>
                  <td className="px-4 py-2 text-right text-mc-muted text-xs">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1 justify-end">
                      <a
                        href={`/api/servers/${serverId}/backups/${b.id}/download`}
                        download
                        className="p-1 rounded hover:bg-mc-border text-mc-muted hover:text-gray-300"
                        title="Download"
                      >
                        <Download size={13} />
                      </a>
                      <button
                        onClick={() => restore(b)}
                        disabled={restoring === b.id}
                        className="p-1 rounded hover:bg-yellow-900/30 text-mc-muted hover:text-yellow-400 disabled:opacity-40"
                        title="Restore"
                      >
                        <RotateCw size={13} className={restoring === b.id ? 'animate-spin' : ''} />
                      </button>
                      <button
                        onClick={() => remove(b.id)}
                        className="p-1 rounded hover:bg-red-900/30 text-mc-muted hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
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

import { useState, useEffect } from 'react';
import { Save, Copy, X, Plus, Package, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, HardDrive, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useServersStore, type Server } from '../../stores/serversStore';
import { useJobStore, type JobRecord } from '../../stores/jobStore';

interface DiskUsage { serverFiles: number; backups: number; total: number; }
interface VersionCheck { current: string; latestRelease: string; latestSnapshot: string; hasUpdate: boolean; }

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function suggestJava(mcVersion: string): string | null {
  const parts = mcVersion.split('.').map(Number);
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  if (minor >= 21 || (minor === 20 && patch >= 5)) return '21';
  if (minor >= 17) return '17';
  if (minor >= 12) return '11';
  return '8';
}

const JAVA_VERSIONS = [
  { value: '8',        label: 'Java 8' },
  { value: '11',       label: 'Java 11' },
  { value: '17',       label: 'Java 17' },
  { value: '21',       label: 'Java 21 (recommended)' },
  { value: '21-graal', label: 'Java 21 GraalVM' },
  { value: '22',       label: 'Java 22' },
  { value: '25',       label: 'Java 25 (latest)' },
];

interface ModpackVersion {
  id: string;
  name: string;
  versionNumber: string;
  datePublished: string;
  isCurrent: boolean;
  downloadAvailable: boolean;
}

interface ModpackVersionsData {
  source: 'modrinth' | 'curseforge';
  slug: string | null;
  current: string | null;
  versions: ModpackVersion[];
}

function fmtRelDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ── row layout ────────────────────────────────────────────────────────────────

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-3.5 border-b border-mc-border/30 last:border-0 items-start">
      <div>
        <div className="text-sm text-gray-300">{label}</div>
        {hint && <div className="text-xs text-mc-muted mt-0.5 leading-snug">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const SECTION_COLORS: Record<string, string> = {
  General: 'text-mc-green',
  Performance: 'text-blue-400',
  Modpack: 'text-emerald-400',
  'Danger Zone': 'text-red-400',
};

function SectionHeader({ label }: { label: string }) {
  const color = SECTION_COLORS[label] ?? 'text-mc-muted';
  return (
    <div className="flex items-center gap-3 pt-6 pb-1 first:pt-2">
      <span className={`text-[10px] font-semibold tracking-widest uppercase whitespace-nowrap ${color}`}>{label}</span>
      <div className="flex-1 h-px bg-mc-border/40" />
    </div>
  );
}

// ── modpack versions ──────────────────────────────────────────────────────────

function ModpackVersions({ server }: { server: Server }) {
  const setServers = useServersStore((s) => s.setServers);
  const upsertJob = useJobStore((s) => s.upsertJob);
  const jobs = useJobStore((s) => s.jobs);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ModpackVersionsData | null>(null);
  const [fetchError, setFetchError] = useState('');
  const [updateJobId, setUpdateJobId] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState('');

  const updateJob: JobRecord | null = updateJobId ? (jobs.find(j => j.id === updateJobId) ?? null) : null;
  const updating = updateJob ? (updateJob.status === 'running' || updateJob.status === 'queued') : false;

  useEffect(() => {
    if (!updateJob) return;
    if (updateJob.status === 'done') {
      api.get<Server[]>('/servers').then(setServers).catch(() => {});
      checkVersions();
    }
  }, [updateJob?.status]);

  async function checkVersions() {
    setLoading(true);
    setFetchError('');
    setData(null);
    setOpen(true);
    try {
      const result = await api.get<ModpackVersionsData>(`/servers/${server.id}/modpack/versions`);
      setData(result);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Failed to fetch versions');
    } finally {
      setLoading(false);
    }
  }

  async function applyUpdate(versionId: string) {
    setUpdateError('');
    setUpdateJobId(null);
    try {
      const res = await api.post<{ jobId: string }>(`/servers/${server.id}/modpack/update`, { versionId });
      const job = await api.get<JobRecord>(`/jobs/${res.jobId}`);
      upsertJob(job);
      setUpdateJobId(res.jobId);
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  const isModrinth = server.modpackSource === 'modrinth';

  return (
    <div className="space-y-3">
      {/* Pack identity */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm text-gray-300 truncate">{server.modpackSlug ?? 'Unknown pack'}</span>
          {isModrinth
            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 uppercase tracking-wide font-semibold flex-shrink-0">Modrinth</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/40 border border-orange-700/50 text-orange-400 uppercase tracking-wide font-semibold flex-shrink-0">CurseForge</span>
          }
        </div>
        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
          onClick={open ? () => setOpen(false) : checkVersions}
          disabled={loading || updating}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {open ? 'Hide' : 'Check updates'}
        </button>
      </div>

      {server.modpackVersionId && (
        <div className="text-xs text-mc-muted font-mono">Current: <span className="text-gray-400">{server.modpackVersionId}</span></div>
      )}

      {updateJob && (
        <div className={`rounded-md p-3 text-sm border ${updateJob.status === 'failed' ? 'bg-red-950/40 border-red-800/40' : 'bg-mc-dark border-mc-border'}`}>
          {updating ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-yellow-400 text-xs">
                <Loader2 size={12} className="animate-spin flex-shrink-0" />
                <span>{updateJob.step}</span>
                <span className="ml-auto font-mono text-mc-muted">{updateJob.progress}%</span>
              </div>
              <div className="h-1 bg-mc-panel rounded-full overflow-hidden">
                <div className="h-full bg-yellow-500 rounded-full transition-all duration-500" style={{ width: `${updateJob.progress}%` }} />
              </div>
            </div>
          ) : updateJob.status === 'done' ? (
            <div className="flex items-center gap-2 text-green-400 text-xs"><CheckCircle2 size={12} /> Update applied successfully.</div>
          ) : (
            <div className="flex items-start gap-2 text-red-400 text-xs"><AlertCircle size={12} className="mt-0.5 flex-shrink-0" />{updateJob.error ?? 'Update failed'}</div>
          )}
        </div>
      )}

      {updateError && <div className="bg-red-900/20 border border-red-800/50 text-red-400 rounded-md px-3 py-2 text-xs">{updateError}</div>}
      {fetchError && <div className="bg-red-900/20 border border-red-800/50 text-red-400 rounded-md px-3 py-2 text-xs">{fetchError}</div>}

      {open && data && data.versions.length > 0 && (
        <div className="overflow-y-auto max-h-56 rounded-md border border-mc-border bg-mc-dark divide-y divide-mc-border/60">
          {data.versions.map((v, idx) => {
            const currentIdx = data.versions.findIndex(x => x.isCurrent);
            const isNewer = currentIdx === -1 || idx < currentIdx;
            return (
              <div key={v.id} className={`flex items-center gap-3 px-3 py-2 text-xs transition-colors ${v.isCurrent ? 'bg-green-950/30' : 'hover:bg-mc-panel/40'}`}>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-200 truncate">{v.name}</span>
                    {v.isCurrent && <span className="text-[10px] px-1.5 py-px rounded-full bg-green-900/40 border border-green-700/50 text-green-400 flex-shrink-0 uppercase tracking-wide font-semibold">current</span>}
                    {!v.isCurrent && isNewer && <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-900/30 border border-blue-800/40 text-blue-400 flex-shrink-0">newer</span>}
                  </div>
                  <div className="text-mc-muted">{fmtRelDate(v.datePublished)}</div>
                </div>
                {!v.isCurrent && (
                  v.downloadAvailable
                    ? <button type="button" className={`btn-ghost text-xs px-2.5 py-1 flex-shrink-0 ${isNewer ? 'text-mc-green hover:bg-mc-green/10' : 'hover:bg-white/5'}`} onClick={() => applyUpdate(v.id)} disabled={updating}>{isNewer ? 'Update' : 'Downgrade'}</button>
                    : <span className="text-mc-muted text-xs flex-shrink-0 italic">unavailable</span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && data && data.versions.length === 0 && !loading && (
        <p className="text-xs text-mc-muted">No versions found.</p>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function SettingsTab({ server }: { server: Server }) {
  const setServers = useServersStore((s) => s.setServers);
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: server.name,
    port: server.port,
    memoryMb: server.memoryMb,
    jvmFlags: server.jvmFlags,
    javaVersion: server.javaVersion ?? '21',
    tags: server.tags ?? [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [, setVersionCheck] = useState<VersionCheck | null>(null);

  useEffect(() => {
    api.get<DiskUsage>(`/servers/${server.id}/disk-usage`).then(setDiskUsage).catch(() => {});
    api.get<VersionCheck>(`/servers/${server.id}/version-check`).then(setVersionCheck).catch(() => {});
  }, [server.id]);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.patch(`/servers/${server.id}`, form);
      const servers = await api.get<Server[]>('/servers');
      setServers(servers);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !form.tags.includes(t)) set('tags', [...form.tags, t]);
    setTagInput('');
  }

  const javaSuggested = suggestJava(server.mcVersion);
  const selectedBase = form.javaVersion.replace('-graal', '');
  const javaWarning = javaSuggested && selectedBase !== javaSuggested;

  return (
    <div className="flex flex-col h-full">

      {/* Stats strip */}
      <div className="flex items-center border-b border-mc-border bg-mc-panel/30 flex-shrink-0 overflow-x-auto scrollbar-none">
        <StatChip label="Type" value={<span className="capitalize">{server.type}</span>} color="text-mc-green" />
        <StatChip label="MC" value={server.mcVersion} color="text-blue-400" />
        <StatChip label="Created" value={new Date(server.createdAt).toLocaleDateString()} />
        {diskUsage ? (
          <>
            <StatChip label="Server Files" value={fmtBytes(diskUsage.serverFiles)} icon={<HardDrive size={10} />} color="text-purple-400" />
            <StatChip label="Backups" value={fmtBytes(diskUsage.backups)} icon={<HardDrive size={10} />} color="text-purple-400" />
          </>
        ) : (
          <StatChip label="Disk" value="Loading…" />
        )}
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto">
        <form onSubmit={save} className="max-w-2xl mx-auto px-6 pb-24 pt-2">

          {/* ── General ──────────────────────────────────────── */}
          <SectionHeader label="General" />

          <SettingRow label="Name" hint="Displayed in the dashboard and header.">
            <input className="input w-full" value={form.name} onChange={e => set('name', e.target.value)} required />
          </SettingRow>

          <SettingRow label="Port" hint="TCP port the server listens on. Requires restart.">
            <input className="input w-full" type="number" min={1} max={65535} value={form.port} onChange={e => set('port', parseInt(e.target.value))} />
          </SettingRow>

          <SettingRow label="Tags" hint="Filter servers on the dashboard. Enter or comma to add.">
            <div className="space-y-2">
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium"
                      style={{ borderColor: tagColor(tag), color: tagColor(tag), backgroundColor: tagColor(tag) + '18' }}
                    >
                      {tag}
                      <button type="button" onClick={() => set('tags', form.tags.filter((t: string) => t !== tag))} className="opacity-50 hover:opacity-100 transition-opacity">
                        <X size={9} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Add tag…"
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(); } }}
                />
                <button type="button" className="btn-ghost px-3 flex-shrink-0" onClick={addTag}><Plus size={13} /></button>
              </div>
            </div>
          </SettingRow>

          {/* ── Performance ──────────────────────────────────── */}
          <SectionHeader label="Performance" />

          <SettingRow label="Memory" hint="Heap size in MB. Requires restart. 4096+ MB recommended for modpacks.">
            <div className="flex items-center gap-2">
              <input className="input flex-1" type="number" min={512} step={512} value={form.memoryMb} onChange={e => set('memoryMb', parseInt(e.target.value))} />
              <span className="text-xs text-mc-muted flex-shrink-0">MB</span>
            </div>
          </SettingRow>

          <SettingRow label="Java Version" hint={javaWarning ? undefined : 'Requires restart.'}>
            <div className="space-y-1.5">
              <select className="input w-full" value={form.javaVersion} onChange={e => set('javaVersion', e.target.value)}>
                {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
              {javaWarning && (
                <p className="text-xs text-yellow-400">
                  MC {server.mcVersion} recommends Java {javaSuggested}.{' '}
                  <button type="button" className="underline hover:text-yellow-300 transition-colors" onClick={() => set('javaVersion', javaSuggested!)}>Switch</button>
                </p>
              )}
            </div>
          </SettingRow>

          <SettingRow label="JVM Flags" hint="Advanced garbage collection and memory tuning flags.">
            <input className="input w-full font-mono text-xs" value={form.jvmFlags} onChange={e => set('jvmFlags', e.target.value)} />
          </SettingRow>

          {/* ── Modpack ──────────────────────────────────────── */}
          {server.modpackSource && (
            <>
              <SectionHeader label="Modpack" />
              <div className="py-3">
                <ModpackVersions server={server} />
              </div>
            </>
          )}

          {/* ── Danger Zone ──────────────────────────────────── */}
          <SectionHeader label="Danger Zone" />

          <div className="py-3">
            {!confirmDelete ? (
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-300">Delete this server</p>
                  <p className="text-xs text-mc-muted mt-0.5">Permanently removes all files, worlds, and configuration.</p>
                </div>
                <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger text-sm flex-shrink-0">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            ) : (
              <div className="rounded-md border border-red-800/50 bg-red-950/20 p-4 space-y-3">
                <p className="text-sm text-red-300">
                  Delete <span className="font-semibold">{server.name}</span>? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost text-sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</button>
                  <button
                    type="button"
                    className="btn-danger text-sm"
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        await api.delete(`/servers/${server.id}?wipe=true`);
                        const updated = await api.get<Server[]>('/servers');
                        setServers(updated);
                        navigate('/');
                      } catch (err: unknown) {
                        setError(err instanceof Error ? err.message : 'Delete failed');
                        setDeleting(false);
                        setConfirmDelete(false);
                      }
                    }}
                  >
                    {deleting ? <><Loader2 size={13} className="animate-spin" /> Deleting…</> : 'Yes, delete'}
                  </button>
                </div>
              </div>
            )}
          </div>

        </form>
      </div>

      {/* Sticky save bar */}
      <div className="flex-shrink-0 border-t border-mc-border bg-mc-panel px-6 py-3 flex items-center gap-3">
        <button type="submit" form="settings-form" className="btn-primary flex items-center gap-2 px-5" disabled={saving} onClick={save}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : saved ? <><CheckCircle2 size={14} /> Saved</> : <><Save size={14} /> Save</>}
        </button>
        <button
          type="button"
          className="btn-ghost flex items-center gap-2"
          disabled={duplicating}
          onClick={async () => {
            setDuplicating(true);
            try {
              const copy = await api.post<Server>(`/servers/${server.id}/duplicate`);
              const servers = await api.get<Server[]>('/servers');
              setServers(servers);
              navigate(`/servers/${copy.id}/settings`);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Duplicate failed');
            } finally {
              setDuplicating(false);
            }
          }}
        >
          {duplicating ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
          {duplicating ? 'Duplicating…' : 'Duplicate'}
        </button>
        {error && (
          <div className="flex items-center gap-1.5 text-xs text-red-400 ml-2">
            <AlertCircle size={12} /> {error}
          </div>
        )}
      </div>

    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function StatChip({ label, value, icon, color = 'text-gray-300' }: { label: string; value: React.ReactNode; icon?: React.ReactNode; color?: string }) {
  return (
    <div className="px-4 py-2.5 border-r border-mc-border flex items-center gap-2 flex-shrink-0">
      <span className="text-[10px] uppercase tracking-widest font-semibold text-mc-muted">{label}</span>
      <span className={`text-xs flex items-center gap-1 font-medium ${color}`}>{icon}{value}</span>
    </div>
  );
}

const TAG_PALETTE = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#facc15','#f87171'];
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}


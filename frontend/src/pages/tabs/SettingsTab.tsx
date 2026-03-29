import { useState, useEffect } from 'react';
import { Save, Copy, X, Plus, RefreshCw, Eye, EyeOff, Package, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, Cpu, Shield, Bell, Server as ServerIcon, Tag, Info, HardDrive, Trash2 } from 'lucide-react';
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

// ── section card shell ────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  accent,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`card p-0 overflow-hidden border-l-2 ${accent}`}>
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-mc-border/60">
        <span className="text-mc-muted">{icon}</span>
        <span className="text-[10px] font-semibold tracking-widest uppercase text-mc-muted">{title}</span>
      </div>
      <div className="p-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

// ── modpack section ───────────────────────────────────────────────────────────

function ModpackSection({ server }: { server: Server }) {
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

  if (!server.modpackSource) return null;

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
    <SectionCard
      icon={<Package size={13} />}
      title="Modpack"
      accent={isModrinth ? 'border-l-emerald-500' : 'border-l-orange-500'}
    >
      {/* Pack identity row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-200 truncate">
              {server.modpackSlug ?? 'Unknown pack'}
            </span>
            {isModrinth
              ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-900/40 border border-emerald-700/50 text-emerald-400 tracking-wide uppercase font-semibold flex-shrink-0">Modrinth</span>
              : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-900/40 border border-orange-700/50 text-orange-400 tracking-wide uppercase font-semibold flex-shrink-0">CurseForge</span>
            }
          </div>
          {server.modpackVersionId && (
            <div className="text-xs text-mc-muted font-mono mt-0.5">
              v <span className="text-gray-400">{server.modpackVersionId}</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5 flex-shrink-0"
          onClick={open ? () => setOpen(false) : checkVersions}
          disabled={loading || updating}
        >
          {loading
            ? <Loader2 size={12} className="animate-spin" />
            : open ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          }
          {open ? 'Hide versions' : 'Check for updates'}
        </button>
      </div>

      {/* Job progress */}
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
            <div className="flex items-center gap-2 text-green-400 text-xs">
              <CheckCircle2 size={12} />
              Update applied successfully.
            </div>
          ) : (
            <div className="flex items-start gap-2 text-red-400 text-xs">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              {updateJob.error ?? 'Update failed'}
            </div>
          )}
        </div>
      )}

      {updateError && (
        <div className="bg-red-900/20 border border-red-800/50 text-red-400 rounded-md px-3 py-2 text-xs">{updateError}</div>
      )}
      {fetchError && (
        <div className="bg-red-900/20 border border-red-800/50 text-red-400 rounded-md px-3 py-2 text-xs">{fetchError}</div>
      )}

      {/* Version list */}
      {open && data && data.versions.length > 0 && (
        <div className="overflow-y-auto max-h-64 rounded-md border border-mc-border bg-mc-dark divide-y divide-mc-border/60">
          {data.versions.map((v, idx) => {
            const currentIdx = data.versions.findIndex(x => x.isCurrent);
            const isNewer = currentIdx === -1 || idx < currentIdx;
            return (
              <div
                key={v.id}
                className={`flex items-center gap-3 px-3 py-2 text-xs transition-colors ${v.isCurrent ? 'bg-green-950/30' : 'hover:bg-mc-panel/40'}`}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-gray-200 truncate">{v.name}</span>
                    {v.isCurrent && (
                      <span className="text-[10px] px-1.5 py-px rounded-full bg-green-900/40 border border-green-700/50 text-green-400 flex-shrink-0 uppercase tracking-wide font-semibold">current</span>
                    )}
                    {!v.isCurrent && isNewer && (
                      <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-900/30 border border-blue-800/40 text-blue-400 flex-shrink-0">newer</span>
                    )}
                  </div>
                  <div className="text-mc-muted">{fmtRelDate(v.datePublished)}</div>
                </div>
                {!v.isCurrent && (
                  v.downloadAvailable ? (
                    <button
                      type="button"
                      className={`btn-ghost text-xs px-2.5 py-1 flex-shrink-0 transition-colors ${isNewer ? 'text-mc-green hover:bg-mc-green/10' : 'hover:bg-white/5'}`}
                      onClick={() => applyUpdate(v.id)}
                      disabled={updating}
                    >
                      {isNewer ? 'Update' : 'Downgrade'}
                    </button>
                  ) : (
                    <span className="text-mc-muted text-xs flex-shrink-0 italic">unavailable</span>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
      {open && data && data.versions.length === 0 && !loading && (
        <p className="text-xs text-mc-muted">No versions found.</p>
      )}
    </SectionCard>
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
    rconPassword: (server as unknown as Record<string, string>).rconPassword ?? '',
    discordWebhookUrl: (server as unknown as Record<string, string | null>).discordWebhookUrl ?? '',
  });
  const [showRcon, setShowRcon] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);
  const [versionCheck, setVersionCheck] = useState<VersionCheck | null>(null);

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
    if (t && !form.tags.includes(t)) { set('tags', [...form.tags, t]); }
    setTagInput('');
  }

  const javaSuggested = suggestJava(server.mcVersion);
  const selectedBase = form.javaVersion.replace('-graal', '');
  const javaWarning = javaSuggested && selectedBase !== javaSuggested;

  return (
    <div className="p-6">
      <form onSubmit={save}>
        {/* Two-column grid for main settings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-w-4xl">

          {/* ── General ──────────────────────────────────────── */}
          <SectionCard icon={<ServerIcon size={13} />} title="General" accent="border-l-mc-green">
            <div>
              <label className="label">Server Name</label>
              <input
                className="input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">Port</label>
              <input
                className="input"
                type="number"
                min={1}
                max={65535}
                value={form.port}
                onChange={e => set('port', parseInt(e.target.value))}
              />
              <p className="text-xs text-mc-muted mt-1">Requires restart to take effect.</p>
            </div>

            {/* Tags */}
            <div>
              <label className="label flex items-center gap-1.5">
                <Tag size={11} className="text-mc-muted" />
                Tags
              </label>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium"
                      style={{ borderColor: tagColor(tag), color: tagColor(tag), backgroundColor: tagColor(tag) + '18' }}
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => set('tags', form.tags.filter((t: string) => t !== tag))}
                        className="opacity-50 hover:opacity-100 transition-opacity ml-0.5"
                      >
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
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <button type="button" className="btn-ghost px-3 flex-shrink-0" onClick={addTag}>
                  <Plus size={13} />
                </button>
              </div>
              <p className="text-xs text-mc-muted mt-1">Enter or comma to add. Filters on dashboard.</p>
            </div>
          </SectionCard>

          {/* ── Performance ──────────────────────────────────── */}
          <SectionCard icon={<Cpu size={13} />} title="Performance" accent="border-l-blue-500">
            <div>
              <label className="label">Memory (MB)</label>
              <input
                className="input"
                type="number"
                min={512}
                step={512}
                value={form.memoryMb}
                onChange={e => set('memoryMb', parseInt(e.target.value))}
              />
              <p className="text-xs text-mc-muted mt-1">Requires restart. 4096+ MB recommended for modpacks.</p>
            </div>

            <div>
              <label className="label">Java Version</label>
              <select
                className="input"
                value={form.javaVersion}
                onChange={e => set('javaVersion', e.target.value)}
              >
                {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
              {javaWarning ? (
                <p className="text-xs text-yellow-400 mt-1">
                  MC {server.mcVersion} recommends Java {javaSuggested}.{' '}
                  <button
                    type="button"
                    className="underline hover:text-yellow-300 transition-colors"
                    onClick={() => set('javaVersion', javaSuggested!)}
                  >
                    Switch
                  </button>
                </p>
              ) : (
                <p className="text-xs text-mc-muted mt-1">Requires restart.</p>
              )}
            </div>

            <div>
              <label className="label">JVM Flags</label>
              <input
                className="input font-mono text-xs"
                value={form.jvmFlags}
                onChange={e => set('jvmFlags', e.target.value)}
              />
              <p className="text-xs text-mc-muted mt-1">Advanced: garbage collection and memory tuning.</p>
            </div>
          </SectionCard>

          {/* ── Security ─────────────────────────────────────── */}
          <SectionCard icon={<Shield size={13} />} title="Security" accent="border-l-yellow-500">
            <div>
              <label className="label">RCON Password</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    className="input w-full font-mono pr-8 text-sm"
                    type={showRcon ? 'text' : 'password'}
                    value={form.rconPassword}
                    onChange={e => set('rconPassword', e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mc-muted hover:text-gray-300 transition-colors"
                    onClick={() => setShowRcon((v) => !v)}
                  >
                    {showRcon ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-ghost px-3 flex-shrink-0"
                  title="Generate new password"
                  onClick={() => set('rconPassword', Array.from(crypto.getRandomValues(new Uint8Array(18))).map(b => b.toString(36)).join('').slice(0, 24))}
                >
                  <RefreshCw size={13} />
                </button>
              </div>
              <p className="text-xs text-mc-muted mt-1">Requires restart. Updates <code className="font-mono">server.properties</code> if it exists.</p>
            </div>
          </SectionCard>

          {/* ── Integrations ─────────────────────────────────── */}
          <SectionCard icon={<Bell size={13} />} title="Integrations" accent="border-l-purple-500">
            <div>
              <label className="label">Discord Webhook URL</label>
              <input
                className="input text-sm"
                type="url"
                placeholder="https://discord.com/api/webhooks/…"
                value={form.discordWebhookUrl ?? ''}
                onChange={e => set('discordWebhookUrl', e.target.value)}
              />
              <p className="text-xs text-mc-muted mt-1">
                Notifications for server start, stop, crash, player joins, and backups.
              </p>
            </div>
          </SectionCard>
        </div>

        {/* ── Modpack (full width, conditional) ────────────── */}
        {server.modpackSource && (
          <div className="max-w-4xl mt-4">
            <ModpackSection server={server} />
          </div>
        )}

        {/* ── Server Info strip ─────────────────────────────── */}
        <div className="max-w-4xl mt-4">
          <div className="card p-0 overflow-hidden border-l-2 border-l-slate-600">
            <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-mc-border/60">
              <Info size={13} className="text-mc-muted" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-mc-muted">Server Info</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-0 divide-x divide-y divide-mc-border/40">
              <InfoCell label="Type" value={<span className="capitalize">{server.type}</span>} />
              <InfoCell label="MC Version" value={server.mcVersion} />
              <InfoCell label="Created" value={new Date(server.createdAt).toLocaleDateString()} />
              {diskUsage ? (
                <InfoCell label="Disk Usage" value={
                  <span className="flex items-center gap-1.5">
                    <HardDrive size={11} className="text-mc-muted flex-shrink-0" />
                    {fmtBytes(diskUsage.total)}
                  </span>
                } />
              ) : (
                <InfoCell label="Disk Usage" value={<span className="text-mc-muted">Loading…</span>} />
              )}
              {diskUsage && (
                <>
                  <InfoCell label="Server Files" value={fmtBytes(diskUsage.serverFiles)} />
                  <InfoCell label="Backups" value={fmtBytes(diskUsage.backups)} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Error ─────────────────────────────────────────── */}
        {error && (
          <div className="max-w-4xl mt-4 bg-red-900/20 border border-red-800/50 text-red-400 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* ── Danger Zone ───────────────────────────────────── */}
        <div className="max-w-4xl mt-4">
          <div className="card p-0 overflow-hidden border-l-2 border-l-red-600">
            <div className="flex items-center gap-2 px-4 pt-3.5 pb-2.5 border-b border-mc-border/60">
              <Trash2 size={13} className="text-red-500" />
              <span className="text-[10px] font-semibold tracking-widest uppercase text-red-500/80">Danger Zone</span>
            </div>
            <div className="p-4">
              {!confirmDelete ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-300 font-medium">Delete this server</p>
                    <p className="text-xs text-mc-muted mt-0.5">Permanently removes all server files, worlds, and configuration.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="btn-danger text-sm flex-shrink-0"
                  >
                    <Trash2 size={13} /> Delete server
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-red-400">
                    Are you sure you want to delete <span className="font-semibold text-red-300">{server.name}</span>?
                    This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-ghost text-sm"
                      onClick={() => setConfirmDelete(false)}
                      disabled={deleting}
                    >
                      Cancel
                    </button>
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
                      {deleting ? <><Loader2 size={13} className="animate-spin" /> Deleting…</> : 'Yes, delete server'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────── */}
        <div className="max-w-4xl mt-5 flex items-center gap-3">
          <button
            type="submit"
            className="btn-primary flex items-center gap-2 px-6"
            disabled={saving}
          >
            {saving ? (
              <><Loader2 size={14} className="animate-spin" /> Saving…</>
            ) : saved ? (
              <><CheckCircle2 size={14} /> Saved</>
            ) : (
              <><Save size={14} /> Save Settings</>
            )}
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
            {duplicating ? 'Duplicating…' : 'Duplicate Server'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-semibold tracking-widest uppercase text-mc-muted mb-1">{label}</div>
      <div className="text-sm text-gray-300">{value}</div>
    </div>
  );
}

const TAG_PALETTE = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#facc15','#f87171'];
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

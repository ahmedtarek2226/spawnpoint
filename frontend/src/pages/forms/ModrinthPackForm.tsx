import { useState, useEffect } from 'react';
import { Search, Package, Download, ExternalLink, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, imgProxy } from '../../api/client';
import { useJobStore } from '../../stores/jobStore';
import type { JobRecord } from '../../stores/jobStore';
import { JAVA_VERSIONS, fmtDownloads, BackButton } from './shared';

interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads: number;
  categories: string[];
}

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  game_versions: string[];
  loaders: string[];
  files: { url: string; filename: string; primary: boolean }[];
}

const PACK_PAGE_SIZE = 20;

type PackStep = 'search' | 'configure';

export function ModrinthPackForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const [step, setStep] = useState<PackStep>('search');
  const upsertJob = useJobStore((s) => s.upsertJob);
  const jobs = useJobStore((s) => s.jobs);

  // Search state
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<ModrinthHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Selected pack + version
  const [selectedPack, setSelectedPack] = useState<ModrinthHit | null>(null);
  const [versions, setVersions] = useState<ModrinthVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState('');

  // Server settings
  const [name, setName] = useState('');
  const [port, setPort] = useState(25565);
  const [memoryMb, setMemoryMb] = useState(4096);
  const [memoryHint, setMemoryHint] = useState('');
  const [javaVersion, setJavaVersion] = useState('21');
  const [jobId, setJobId] = useState<string | null>(null);
  const [installError, setInstallError] = useState('');

  const activeJob: JobRecord | null = jobId ? (jobs.find(j => j.id === jobId) ?? null) : null;

  const totalPages = Math.ceil(total / PACK_PAGE_SIZE);

  // Auto-estimate memory and Java when a version is selected
  useEffect(() => {
    if (!selectedVersionId || !versions.length) return;
    const ver = versions.find(v => v.id === selectedVersionId);
    if (!ver) return;
    const file = ver.files.find(f => f.primary) ?? ver.files[0];
    if (!file?.url) return;

    let cancelled = false;
    setMemoryHint('Estimating…');
    api.get<{ modCount: number; suggestedMemoryMb: number; suggestedJavaVersion: string }>(
      `/prism/modpacks/estimate-memory?url=${encodeURIComponent(file.url)}`
    ).then(data => {
      if (cancelled) return;
      setMemoryMb(data.suggestedMemoryMb);
      setJavaVersion(data.suggestedJavaVersion);
      setMemoryHint(`${data.modCount} mods detected → ${data.suggestedMemoryMb} MB, Java ${data.suggestedJavaVersion}`);
    }).catch(() => {
      if (!cancelled) setMemoryHint('');
    });
    return () => { cancelled = true; };
  }, [selectedVersionId]);

  async function search(q: string, p: number) {
    setSearching(true);
    setSearchError('');
    try {
      const data = await api.get<{ hits: ModrinthHit[]; total: number }>(
        `/prism/modpacks/search?q=${encodeURIComponent(q)}&offset=${p * PACK_PAGE_SIZE}`
      );
      setHits(data.hits);
      setTotal(data.total);
      setPage(p);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    }
    setSearching(false);
  }

  useEffect(() => { search('', 0); }, []);

  async function selectPack(hit: ModrinthHit) {
    setSelectedPack(hit);
    setName(hit.title);
    setVersionsLoading(true);
    setVersions([]);
    setSelectedVersionId('');
    try {
      const vers = await api.get<ModrinthVersion[]>(`/prism/modpacks/versions/${hit.project_id}`);
      setVersions(vers);
      if (vers.length) setSelectedVersionId(vers[0].id);
    } catch { /* ignore */ }
    setVersionsLoading(false);
    setStep('configure');
  }

  // Navigate when job completes
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status === 'done' && activeJob.result?.serverId) {
      onDone(activeJob.result.serverId);
    }
  }, [activeJob?.status]);

  async function install(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPack || !selectedVersionId) return;
    const ver = versions.find(v => v.id === selectedVersionId);
    if (!ver) return;
    const file = ver.files.find(f => f.primary) ?? ver.files[0];
    if (!file) { setInstallError('No downloadable file found for this version'); return; }

    setInstallError('');
    try {
      const res = await fetch('/api/prism/install-from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packUrl: file.url, name, port, memoryMb, javaVersion, projectId: selectedPack.project_id, versionId: selectedVersionId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Install failed');
      const job = await api.get<JobRecord>(`/jobs/${json.data.jobId}`);
      upsertJob(job);
      setJobId(json.data.jobId);
    } catch (err: unknown) {
      setInstallError(err instanceof Error ? err.message : 'Install failed');
    }
  }

  if (step === 'configure' && selectedPack) {
    return (
      <div className="p-6 max-w-2xl">
        <button onClick={() => setStep('search')} className="flex items-center gap-1.5 text-sm text-mc-muted hover:text-gray-200 mb-6 transition-colors">
          <ChevronLeft size={16} /> Back to search
        </button>
        <h1 className="text-2xl font-bold mb-1">Configure Server</h1>
        <p className="text-mc-muted text-sm mb-6">Installing from Modrinth modpack</p>

        {/* Pack summary */}
        <div className="card p-4 flex items-start gap-3 mb-6">
          {selectedPack.icon_url ? (
            <img src={imgProxy(selectedPack.icon_url)} alt="" className="w-12 h-12 rounded flex-shrink-0 object-cover" />
          ) : (
            <div className="w-12 h-12 rounded bg-mc-dark flex items-center justify-center flex-shrink-0">
              <Package size={20} className="text-mc-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-200">{selectedPack.title}</div>
            <p className="text-xs text-mc-muted mt-0.5 line-clamp-2">{selectedPack.description}</p>
          </div>
          <a
            href={`https://modrinth.com/modpack/${selectedPack.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost p-1.5 text-xs flex-shrink-0"
            title="View on Modrinth"
          >
            <ExternalLink size={13} />
          </a>
        </div>

        <form onSubmit={install} className="space-y-5">
          <div>
            <label className="label">Version</label>
            {versionsLoading ? (
              <div className="flex items-center gap-2 text-mc-muted text-sm"><Loader2 size={14} className="animate-spin" /> Loading versions…</div>
            ) : (
              <select className="input" value={selectedVersionId} onChange={e => setSelectedVersionId(e.target.value)}>
                {versions.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.version_number}) — {v.game_versions.slice(0, 3).join(', ')}{v.game_versions.length > 3 ? '…' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="label">Server Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Port</label>
              <input className="input" type="number" min={1} max={65535} value={port} onChange={e => setPort(parseInt(e.target.value))} />
            </div>
            <div>
              <label className="label">Memory (MB)</label>
              <input className="input" type="number" min={512} step={512} value={memoryMb} onChange={e => setMemoryMb(parseInt(e.target.value))} />
              {memoryHint && <p className="text-xs text-mc-muted mt-1">{memoryHint}</p>}
            </div>
            <div>
              <label className="label">Java Version</label>
              <select className="input" value={javaVersion} onChange={e => setJavaVersion(e.target.value)}>
                {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
            </div>
          </div>

          {activeJob && (
            <div className={`rounded p-4 text-sm border ${activeJob.status === 'failed' ? 'bg-red-950/40 border-red-800/40' : 'bg-mc-green/10 border-mc-green/40'}`}>
              {activeJob.status === 'running' || activeJob.status === 'queued' ? (
                <>
                  <div className="flex items-center gap-2 text-mc-green mb-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span className="font-medium">{activeJob.step}</span>
                  </div>
                  <div className="h-1.5 bg-mc-dark rounded-full overflow-hidden">
                    <div className="h-full bg-mc-green rounded-full transition-all duration-500" style={{ width: `${activeJob.progress}%` }} />
                  </div>
                </>
              ) : activeJob.status === 'done' ? (
                <div className="flex items-center gap-2 text-mc-green">
                  <CheckCircle2 size={14} />
                  <span className="font-medium">Install complete! Redirecting…</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-red-400">
                  <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>{activeJob.error ?? 'Install failed'}</span>
                </div>
              )}
            </div>
          )}

          {installError && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{installError}</div>
          )}

          <button type="submit" className="btn-primary w-full" disabled={!!activeJob || versionsLoading || !selectedVersionId}>
            {activeJob && (activeJob.status === 'running' || activeJob.status === 'queued') ? (
              <><Loader2 size={14} className="animate-spin" /> Installing…</>
            ) : (
              <><Download size={14} /> Create Server</>
            )}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl h-full flex flex-col">
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-bold mb-1">Browse Modrinth Modpacks</h1>
      <p className="text-mc-muted text-sm mb-4">Select a modpack to create a server. Server-compatible mods are downloaded automatically.</p>

      <form onSubmit={(e) => { e.preventDefault(); search(query, 0); }} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
          <input
            className="input pl-8 w-full"
            placeholder="Search modpacks…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary text-sm" disabled={searching}>
          {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
          Search
        </button>
      </form>

      {searchError && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm mb-3">{searchError}</div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {searching && !hits.length ? (
          <div className="text-center py-12 text-mc-muted text-sm">
            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
            Searching…
          </div>
        ) : hits.length === 0 ? (
          <div className="card p-8 text-center text-mc-muted text-sm">No modpacks found</div>
        ) : (
          <>
            {total > 0 && <div className="text-xs text-mc-muted">{total.toLocaleString()} modpacks found</div>}
            {hits.map((hit) => (
              <button
                key={hit.project_id}
                onClick={() => selectPack(hit)}
                className="card p-4 flex items-start gap-3 w-full text-left hover:border-mc-green/50 transition-colors group"
              >
                {hit.icon_url ? (
                  <img src={imgProxy(hit.icon_url)} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-mc-dark flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-mc-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200 group-hover:text-mc-green transition-colors">{hit.title}</span>
                    <span className="text-xs text-mc-muted flex items-center gap-1">
                      <Download size={10} /> {fmtDownloads(hit.downloads)}
                    </span>
                  </div>
                  <p className="text-xs text-mc-muted mt-0.5 line-clamp-2">{hit.description}</p>
                </div>
                <ChevronRight size={16} className="text-mc-muted group-hover:text-mc-green transition-colors flex-shrink-0 mt-1" />
              </button>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  className="btn-ghost p-1.5"
                  disabled={page === 0 || searching}
                  onClick={() => search(query, page - 1)}
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-mc-muted">Page {page + 1} of {totalPages}</span>
                <button
                  className="btn-ghost p-1.5"
                  disabled={page >= totalPages - 1 || searching}
                  onClick={() => search(query, page + 1)}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import { Package, Upload, Trash2, Search, Download, ExternalLink, ChevronLeft, ChevronRight, Loader2, Lock } from 'lucide-react';
import { api, uploadFiles } from '../../api/client';

interface Entry { name: string; path: string; size: number; mtime: string; }

interface ModrinthHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads: number;
  follows: number;
  latest_version?: string;
  versions: string[];
  categories: string[];
}

interface ModrinthVersion {
  id: string;
  name: string;
  version_number: string;
  files: { url: string; filename: string; primary: boolean; size: number }[];
}

interface CfHit {
  id: number;
  name: string;
  summary: string;
  downloadCount: number;
  logo?: { url: string };
  links?: { websiteUrl: string };
  allowModDistribution: boolean | null;
  latestFilesIndexes: { fileId: number; gameVersion: string; filename: string }[];
}

interface CfFile {
  id: number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  gameVersions: string[];
}

function fmtSize(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PAGE_SIZE = 20;

type View = 'installed' | 'modrinth' | 'curseforge';

export default function ModsTab({ serverId }: { serverId: string }) {
  const [mods, setMods] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [cfEnabled, setCfEnabled] = useState(false);

  // Modrinth browser
  const [view, setView] = useState<View>('installed');
  const [mrQuery, setMrQuery] = useState('');
  const [mrResults, setMrResults] = useState<ModrinthHit[]>([]);
  const [mrTotal, setMrTotal] = useState(0);
  const [mrPage, setMrPage] = useState(0);
  const [mrLoading, setMrLoading] = useState(false);
  const [mrError, setMrError] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installedMrIds, setInstalledMrIds] = useState<Set<string>>(new Set());
  const [mrIdsLoaded, setMrIdsLoaded] = useState(false);

  // CurseForge browser
  const [cfQuery, setCfQuery] = useState('');
  const [cfResults, setCfResults] = useState<CfHit[]>([]);
  const [cfTotal, setCfTotal] = useState(0);
  const [cfPage, setCfPage] = useState(0);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');
  const [cfInstalling, setCfInstalling] = useState<number | null>(null);
  const [installedCfIds, setInstalledCfIds] = useState<Set<number>>(new Set());
  const [cfIdsLoaded, setCfIdsLoaded] = useState(false);

  useEffect(() => {
    loadInstalled();
    api.get<{ enabled: boolean }>('/curseforge/status')
      .then((d) => setCfEnabled(d.enabled))
      .catch(() => {});
  }, [serverId]);

  async function loadInstalled() {
    setLoading(true);
    try {
      const data = await api.get<Entry[]>(`/servers/${serverId}/files/mods`);
      setMods(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function remove(entry: Entry) {
    if (!confirm(`Remove ${entry.name}?`)) return;
    await api.delete(`/servers/${serverId}/files`, { path: entry.path });
    loadInstalled();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(`/servers/${serverId}/files/upload`, files);
    loadInstalled();
    e.target.value = '';
  }

  // ── Modrinth ────────────────────────────────────────────────────────────────

  async function searchModrinth(query: string, page: number) {
    setMrLoading(true);
    setMrError('');
    try {
      const data = await api.get<{ hits: ModrinthHit[]; total: number }>(
        `/servers/${serverId}/modrinth/search?q=${encodeURIComponent(query)}&offset=${page * PAGE_SIZE}`
      );
      setMrResults(data.hits);
      setMrTotal(data.total);
      setMrPage(page);
    } catch (err: unknown) {
      setMrError(err instanceof Error ? err.message : 'Search failed');
    }
    setMrLoading(false);
  }

  async function installModrinth(hit: ModrinthHit) {
    setInstalling(hit.project_id);
    setMrError('');
    try {
      const versions = await api.get<ModrinthVersion[]>(
        `/servers/${serverId}/modrinth/versions/${hit.project_id}`
      );
      if (!versions.length) throw new Error('No compatible version found for your MC version and loader');
      const latest = versions[0];
      const file = latest.files.find((f) => f.primary) ?? latest.files[0];
      if (!file) throw new Error('No downloadable file found');
      await api.post(`/servers/${serverId}/modrinth/install`, { fileUrl: file.url, fileName: file.filename });
      setInstalledMrIds((prev) => new Set(prev).add(hit.project_id));
      loadInstalled();
      api.get<Record<string, string>>(`/servers/${serverId}/modrinth/installed-ids`)
        .then((data) => setInstalledMrIds(new Set(Object.keys(data))))
        .catch(() => {});
    } catch (err: unknown) {
      setMrError(err instanceof Error ? err.message : 'Install failed');
    }
    setInstalling(null);
  }

  // ── CurseForge ──────────────────────────────────────────────────────────────

  async function searchCurseForge(query: string, page: number) {
    setCfLoading(true);
    setCfError('');
    try {
      const data = await api.get<{ hits: CfHit[]; total: number }>(
        `/servers/${serverId}/curseforge/search?q=${encodeURIComponent(query)}&offset=${page * PAGE_SIZE}`
      );
      setCfResults(data.hits);
      setCfTotal(data.total);
      setCfPage(page);
    } catch (err: unknown) {
      setCfError(err instanceof Error ? err.message : 'Search failed');
    }
    setCfLoading(false);
  }

  async function installCurseForge(hit: CfHit) {
    setCfInstalling(hit.id);
    setCfError('');
    try {
      const files = await api.get<CfFile[]>(`/servers/${serverId}/curseforge/versions/${hit.id}`);
      if (!files.length) throw new Error('No compatible version found');
      const latest = files[0];
      if (!latest.downloadUrl) throw new Error('Author has disabled third-party downloads for this mod. Visit CurseForge to download manually.');
      await api.post(`/servers/${serverId}/curseforge/install`, { fileUrl: latest.downloadUrl, fileName: latest.fileName });
      setInstalledCfIds((prev) => new Set(prev).add(hit.id));
      loadInstalled();
      api.get<Record<number, string>>(`/servers/${serverId}/curseforge/installed-ids`)
        .then((data) => setInstalledCfIds(new Set(Object.keys(data).map(Number))))
        .catch(() => {});
    } catch (err: unknown) {
      setCfError(err instanceof Error ? err.message : 'Install failed');
    }
    setCfInstalling(null);
  }

  const mrTotalPages = Math.ceil(mrTotal / PAGE_SIZE);
  const cfTotalPages = Math.ceil(cfTotal / PAGE_SIZE);

  function TabButton({ id, label, icon }: { id: View; label: string; icon: React.ReactNode }) {
    const isActive = view === id;
    const isLocked = id === 'curseforge' && !cfEnabled;
    return (
      <button
        onClick={async () => {
          if (isLocked) return;
          setView(id);
          if (id === 'modrinth' && !mrResults.length) searchModrinth('', 0);
          if (id === 'modrinth' && !mrIdsLoaded) {
            setMrIdsLoaded(true);
            api.get<Record<string, string>>(`/servers/${serverId}/modrinth/installed-ids`)
              .then((d) => setInstalledMrIds(new Set(Object.keys(d))))
              .catch(() => {});
          }
          if (id === 'curseforge' && !cfResults.length) searchCurseForge('', 0);
          if (id === 'curseforge' && !cfIdsLoaded) {
            setCfIdsLoaded(true);
            api.get<Record<number, string>>(`/servers/${serverId}/curseforge/installed-ids`)
              .then((d) => setInstalledCfIds(new Set(Object.keys(d).map(Number))))
              .catch(() => {});
          }
        }}
        title={isLocked ? 'Set CURSEFORGE_API_KEY in your environment to unlock' : undefined}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t transition-colors border-b-2 -mb-px ${
          isActive
            ? 'border-mc-green text-mc-green bg-mc-green/5'
            : isLocked
              ? 'border-transparent text-mc-muted/40 cursor-not-allowed'
              : 'border-transparent text-mc-muted hover:text-gray-300'
        }`}
      >
        {icon}
        {label}
        {isLocked && <Lock size={11} className="text-mc-muted/40" />}
      </button>
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-mc-border w-full pb-0">
          <TabButton id="installed" label="Installed" icon={<Package size={13} />} />
          <span className={`flex items-center text-xs px-1 rounded mb-2 mt-auto ${view === 'installed' ? 'bg-mc-green/20 text-mc-green' : 'bg-mc-panel text-mc-muted'}`}>
            {mods.length}
          </span>
          <TabButton id="modrinth" label="Browse Modrinth" icon={<Search size={13} />} />
          <TabButton id="curseforge" label="Browse CurseForge" icon={<Search size={13} />} />
          <div className="ml-auto flex gap-2 mb-1">
            <input ref={fileRef} type="file" multiple accept=".jar" className="hidden" onChange={onUpload} />
            <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">
              <Upload size={14} /> Upload .jar
            </button>
          </div>
        </div>
      </div>

      {/* Installed mods */}
      {view === 'installed' && (
        <>
          {mods.length > 0 && (
            <div className="flex items-center gap-1.5 bg-mc-dark border border-mc-border rounded px-2 py-1.5">
              <Search size={13} className="text-mc-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter installed…"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="bg-transparent text-sm text-gray-300 placeholder-mc-muted outline-none flex-1"
              />
            </div>
          )}
          {loading ? (
            <div className="text-mc-muted text-sm">Loading…</div>
          ) : mods.length === 0 ? (
            <div className="card p-8 text-center text-mc-muted">
              <Package size={32} className="mx-auto mb-2 opacity-40" />
              <div>No mods or plugins installed.</div>
              <div className="text-xs mt-1">Upload .jar files or browse Modrinth to install.</div>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2">Name</th>
                    <th className="text-right px-4 py-2">Size</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {mods.filter(m => !localSearch || m.name.toLowerCase().includes(localSearch.toLowerCase())).map((mod) => (
                    <tr key={mod.path} className="border-b border-mc-border/40 hover:bg-mc-panel/40">
                      <td className="px-4 py-2 flex items-center gap-2 font-mono text-xs">
                        <Package size={13} className="text-mc-muted flex-shrink-0" />
                        {mod.name}
                      </td>
                      <td className="px-4 py-2 text-right text-mc-muted text-xs">{fmtSize(mod.size)}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => remove(mod)} className="p-1 rounded hover:bg-red-900/30 text-mc-muted hover:text-red-400">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modrinth browser */}
      {view === 'modrinth' && (
        <div className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); searchModrinth(mrQuery, 0); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
              <input className="input pl-8 w-full" placeholder="Search Modrinth…" value={mrQuery} onChange={(e) => setMrQuery(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary text-sm" disabled={mrLoading}>
              {mrLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Search
            </button>
          </form>
          <div className="text-xs text-yellow-400/80 bg-yellow-900/20 border border-yellow-800/40 rounded px-3 py-2">
            Most mods also need to be installed on each player's client. Server-side only mods (e.g. performance, anti-cheat) are the exception.
          </div>
          {mrError && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{mrError}</div>}
          <ModResults
            results={mrResults}
            loading={mrLoading}
            installedIds={installedMrIds}
            installing={installing}
            onInstall={(hit) => installModrinth(hit as ModrinthHit)}
            getId={(h) => (h as ModrinthHit).project_id}
            getSlug={(h) => (h as ModrinthHit).slug}
            getTitle={(h) => (h as ModrinthHit).title}
            getDesc={(h) => (h as ModrinthHit).description}
            getIcon={(h) => (h as ModrinthHit).icon_url}
            getDownloads={(h) => (h as ModrinthHit).downloads}
            getLinkHref={(h) => `https://modrinth.com/mod/${(h as ModrinthHit).slug}`}
            getDownloadAvailable={() => true}
            total={mrTotal}
            page={mrPage}
            totalPages={mrTotalPages}
            onPage={(p) => searchModrinth(mrQuery, p)}
          />
        </div>
      )}

      {/* CurseForge browser */}
      {view === 'curseforge' && (
        <div className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); searchCurseForge(cfQuery, 0); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
              <input className="input pl-8 w-full" placeholder="Search CurseForge…" value={cfQuery} onChange={(e) => setCfQuery(e.target.value)} />
            </div>
            <button type="submit" className="btn-primary text-sm" disabled={cfLoading}>
              {cfLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Search
            </button>
          </form>
          <div className="text-xs text-yellow-400/80 bg-yellow-900/20 border border-yellow-800/40 rounded px-3 py-2">
            Most mods also need to be installed on each player's client. Server-side only mods (e.g. performance, anti-cheat) are the exception.
          </div>
          {cfError && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{cfError}</div>}
          <ModResults
            results={cfResults}
            loading={cfLoading}
            installedIds={installedCfIds}
            installing={cfInstalling !== null ? String(cfInstalling) : null}
            onInstall={(hit) => installCurseForge(hit as CfHit)}
            getId={(h) => String((h as CfHit).id)}
            getSlug={(h) => String((h as CfHit).id)}
            getTitle={(h) => (h as CfHit).name}
            getDesc={(h) => (h as CfHit).summary}
            getIcon={(h) => (h as CfHit).logo?.url}
            getDownloads={(h) => (h as CfHit).downloadCount}
            getLinkHref={(h) => (h as CfHit).links?.websiteUrl ?? `https://www.curseforge.com/minecraft/mc-mods/${(h as CfHit).id}`}
            getDownloadAvailable={(h) => (h as CfHit).allowModDistribution !== false}
            total={cfTotal}
            page={cfPage}
            totalPages={cfTotalPages}
            onPage={(p) => searchCurseForge(cfQuery, p)}
          />
        </div>
      )}
    </div>
  );
}

// ── Shared results renderer ───────────────────────────────────────────────────

interface ModResultsProps {
  results: unknown[];
  loading: boolean;
  installedIds: Set<string | number>;
  installing: string | null;
  onInstall: (hit: unknown) => void;
  getId: (h: unknown) => string;
  getSlug: (h: unknown) => string;
  getTitle: (h: unknown) => string;
  getDesc: (h: unknown) => string;
  getIcon: (h: unknown) => string | undefined;
  getDownloads: (h: unknown) => number;
  getLinkHref: (h: unknown) => string;
  getDownloadAvailable: (h: unknown) => boolean;
  total: number;
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}

function ModResults({
  results, loading, installedIds, installing,
  onInstall, getId, getTitle, getDesc, getIcon, getDownloads, getLinkHref, getDownloadAvailable,
  total, page, totalPages, onPage,
}: ModResultsProps) {
  if (loading && !results.length) {
    return (
      <div className="text-center py-12 text-mc-muted text-sm">
        <Loader2 size={24} className="animate-spin mx-auto mb-2" /> Searching…
      </div>
    );
  }
  if (!results.length && !loading) {
    return <div className="card p-8 text-center text-mc-muted text-sm">Enter a search term to browse</div>;
  }
  return (
    <>
      {total > 0 && <div className="text-xs text-mc-muted">{total.toLocaleString()} results</div>}
      <div className="space-y-2">
        {results.map((hit) => {
          const id = getId(hit);
          const isInstalled = installedIds.has(id) || installedIds.has(Number(id));
          const isInstalling = installing === id;
          const canDownload = getDownloadAvailable(hit);
          return (
            <div key={id} className={`card p-4 flex items-start gap-3 ${isInstalled ? 'border-mc-green/40' : ''}`}>
              {getIcon(hit) ? (
                <img src={getIcon(hit)} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded bg-mc-dark flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-mc-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-200">{getTitle(hit)}</span>
                  {isInstalled && <span className="text-xs bg-mc-green/20 text-mc-green border border-mc-green/30 px-1.5 py-0.5 rounded">✓ Installed</span>}
                  <span className="text-xs text-mc-muted flex items-center gap-1"><Download size={10} /> {fmtDownloads(getDownloads(hit))}</span>
                </div>
                <p className="text-xs text-mc-muted mt-0.5 line-clamp-2">{getDesc(hit)}</p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a href={getLinkHref(hit)} target="_blank" rel="noreferrer" className="btn-ghost p-1.5 text-xs" title="View page">
                  <ExternalLink size={13} />
                </a>
                {canDownload ? (
                  <button
                    className={`text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${isInstalled ? 'bg-mc-green/20 text-mc-green border border-mc-green/30 cursor-default' : 'btn-primary'}`}
                    disabled={!!installing || isInstalled}
                    onClick={() => !isInstalled && onInstall(hit)}
                  >
                    {isInstalling ? <><Loader2 size={12} className="animate-spin" /> Installing…</>
                      : isInstalled ? <>✓ Installed</>
                      : <><Download size={12} /> Install</>}
                  </button>
                ) : (
                  <a href={getLinkHref(hit)} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded btn-ghost flex items-center gap-1.5" title="Third-party download disabled by author">
                    <ExternalLink size={12} /> CurseForge
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button className="btn-ghost p-1.5" disabled={page === 0 || loading} onClick={() => onPage(page - 1)}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-mc-muted">Page {page + 1} of {totalPages}</span>
          <button className="btn-ghost p-1.5" disabled={page >= totalPages - 1 || loading} onClick={() => onPage(page + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}

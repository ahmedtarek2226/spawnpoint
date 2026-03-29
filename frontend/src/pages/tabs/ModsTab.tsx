import { useState, useEffect, useRef } from 'react';
import { Package, Upload, Trash2, X, Search, Download, ExternalLink, ChevronLeft, ChevronRight, Loader2, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { api, uploadFiles, imgProxy } from '../../api/client';
import { useServersStore } from '../../stores/serversStore';

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

interface MissingMod {
  projectId: number;
  fileId: number;
  name: string;
  slug: string;
  url: string;
}

function fmtSize(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtRelative(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 30) return new Date(isoStr).toLocaleDateString();
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function parseVersion(name: string): string {
  let base = name.replace(/\.jar$/i, '');
  base = base.replace(/^\[[\d.x]+\]\s*/, '');
  base = base.replace(/\s*\(\d+\)\s*$/, '');
  const vMatch = base.match(/[ _-]v(\d+\.\d+[\w.+\-]*)/i);
  if (vMatch) return vMatch[1];
  const isMc = (s: string) => /^1\.(1[6-9]|2[0-4])(\.\d+)?$/.test(s);
  const tokens = base.split(/[-_]/);
  const dotted = tokens.filter(t => /^\d+\.\d+/.test(t));
  const modVer = dotted.find(t => !isMc(t));
  return modVer ?? dotted[0] ?? '';
}

function fmtDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PAGE_SIZE = 20;

type View = 'installed' | 'modrinth' | 'curseforge';

/** Returns true if an installed jar filename looks like it matches a CurseForge slug.
 *  Handles cases where the slug has extra suffix words (e.g. "more-overlays-updated"
 *  vs filename "moreoverlays-1.24.4.jar") by also checking whether the filename stem
 *  appears inside the slug. */
function slugMatchesFilename(filename: string, slug: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const nFile = norm(filename);
  const nSlug = norm(slug);
  // Forward: slug contained in filename (most common case)
  if (nFile.includes(nSlug)) return true;
  // Reverse: filename stem (first hyphen-separated token, before version numbers)
  // contained in slug — catches "moreoverlays" inside "moreoverlaysupdated"
  const stem = norm(filename.replace(/\.jar$/i, '').split(/[-_]/)[0]);
  return stem.length >= 6 && nSlug.includes(stem);
}

export default function ModsTab({ serverId }: { serverId: string }) {
  const [mods, setMods] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [cfEnabled, setCfEnabled] = useState(false);

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

  const [cfQuery, setCfQuery] = useState('');
  const [cfResults, setCfResults] = useState<CfHit[]>([]);
  const [cfTotal, setCfTotal] = useState(0);
  const [cfPage, setCfPage] = useState(0);
  const [cfLoading, setCfLoading] = useState(false);
  const [cfError, setCfError] = useState('');
  const [cfInstalling, setCfInstalling] = useState<number | null>(null);
  const [installedCfIds, setInstalledCfIds] = useState<Set<number>>(new Set());
  const [cfIdsLoaded, setCfIdsLoaded] = useState(false);

  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null);
  const [missingMods, setMissingMods] = useState<MissingMod[]>([]);
  const [missingLoading, setMissingLoading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  const server = useServersStore((s) => s.servers.find((sv) => sv.id === serverId));
  const modsDir = ['paper', 'spigot', 'purpur'].includes(server?.type ?? '') ? 'plugins' : 'mods';

  useEffect(() => {
    loadInstalled();
    api.get<{ enabled: boolean }>('/curseforge/status')
      .then((d) => setCfEnabled(d.enabled))
      .catch(() => {});
    loadMissingMods();
  }, [serverId]);

  async function loadInstalled() {
    setLoading(true);
    try {
      const data = await api.get<Entry[]>(`/servers/${serverId}/files/mods`);
      setMods(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  async function loadMissingMods() {
    setMissingLoading(true);
    try {
      const data = await api.get<MissingMod[]>(`/servers/${serverId}/files/mods/missing`);
      setMissingMods(data);
    } catch { /* empty */ }
    setMissingLoading(false);
  }

  async function remove(entry: Entry) {
    if (confirmRemovePath !== entry.path) { setConfirmRemovePath(entry.path); return; }
    setConfirmRemovePath(null);
    await api.delete(`/servers/${serverId}/files`, { path: entry.path });
    loadInstalled();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError('');
    try {
      await uploadFiles(`/servers/${serverId}/files/upload`, files, { path: modsDir });
      const count = files.length;
      setUploadToast(`Uploaded ${count} file${count !== 1 ? 's' : ''}`);
      setTimeout(() => setUploadToast(null), 3000);
      loadInstalled();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
    setUploading(false);
    e.target.value = '';
  }

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

  const filteredMods = mods.filter(m => !localSearch || m.name.toLowerCase().includes(localSearch.toLowerCase()));

  async function searchInCF(name: string) {
    setView('curseforge');
    setCfQuery(name);
    searchCurseForge(name, 0);
    if (!cfIdsLoaded) {
      setCfIdsLoaded(true);
      api.get<Record<number, string>>(`/servers/${serverId}/curseforge/installed-ids`)
        .then((d) => setInstalledCfIds(new Set(Object.keys(d).map(Number))))
        .catch(() => {});
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="border-b border-mc-border bg-mc-panel/30 px-3 flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-shrink-0">
        <button
          onClick={() => setView('installed')}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-t border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
            view === 'installed' ? 'border-mc-green text-mc-green bg-mc-green/5' : 'border-transparent text-mc-muted hover:text-gray-300'
          }`}
        >
          <Package size={12} />
          Installed
          <span className={`min-w-[18px] text-center text-xs px-1 rounded ${view === 'installed' ? 'bg-mc-green/20 text-mc-green' : 'bg-mc-dark text-mc-muted'}`}>
            {mods.length}
          </span>
        </button>

        <button
          onClick={async () => {
            setView('modrinth');
            if (!mrResults.length) searchModrinth('', 0);
            if (!mrIdsLoaded) {
              setMrIdsLoaded(true);
              api.get<Record<string, string>>(`/servers/${serverId}/modrinth/installed-ids`)
                .then((d) => setInstalledMrIds(new Set(Object.keys(d))))
                .catch(() => {});
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-t border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
            view === 'modrinth' ? 'border-mc-green text-mc-green bg-mc-green/5' : 'border-transparent text-mc-muted hover:text-gray-300'
          }`}
        >
          <Search size={12} />
          Modrinth
        </button>

        <button
          onClick={async () => {
            if (!cfEnabled) return;
            setView('curseforge');
            if (!cfResults.length) searchCurseForge('', 0);
            if (!cfIdsLoaded) {
              setCfIdsLoaded(true);
              api.get<Record<number, string>>(`/servers/${serverId}/curseforge/installed-ids`)
                .then((d) => setInstalledCfIds(new Set(Object.keys(d).map(Number))))
                .catch(() => {});
            }
          }}
          title={!cfEnabled ? 'Set CURSEFORGE_API_KEY in your environment to unlock' : undefined}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-t border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
            view === 'curseforge'
              ? 'border-mc-green text-mc-green bg-mc-green/5'
              : !cfEnabled
                ? 'border-transparent text-mc-muted/40 cursor-not-allowed'
                : 'border-transparent text-mc-muted hover:text-gray-300'
          }`}
        >
          <Search size={12} />
          CurseForge
          {!cfEnabled && <Lock size={10} className="text-mc-muted/40" />}
        </button>

        <div className="ml-auto flex items-center gap-1 mb-1 flex-shrink-0">
          <input ref={fileRef} type="file" multiple accept=".jar,.zip" className="hidden" onChange={onUpload} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs" disabled={uploading}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Upload .jar/.zip'}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Installed mods */}
        {view === 'installed' && (
          <>
            {uploadError && (
              <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-3 py-2 text-sm">
                {uploadError}
              </div>
            )}
            {uploadToast && (
              <div className="bg-mc-green/10 border border-mc-green/30 text-mc-green rounded-lg px-3 py-2 text-sm">
                {uploadToast}
              </div>
            )}

            {(() => {
              const needsDownload = missingMods.filter(
                (mod) => !mods.some((m) => slugMatchesFilename(m.name, mod.slug))
              );
              if (needsDownload.length === 0) return null;
              return (
                <div className="border border-orange-700/40 bg-orange-900/15 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-orange-700/30">
                    <AlertTriangle size={13} className="text-orange-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-orange-300">
                      {needsDownload.length} mod{needsDownload.length !== 1 ? 's' : ''} require manual download
                    </span>
                    <span className="text-xs text-orange-400/70 ml-1">— distribution disabled by author</span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => needsDownload.forEach((mod) => window.open(mod.url, '_blank'))}
                        className="text-xs px-2 py-1 rounded text-orange-300 hover:bg-orange-500/15 border border-orange-700/50 hover:border-orange-600/60 flex items-center gap-1 transition-colors"
                        title="Open all CurseForge pages in new tabs"
                      >
                        <ExternalLink size={11} />
                        Open All
                      </button>
                      <button
                        onClick={loadMissingMods}
                        disabled={missingLoading}
                        className="text-orange-400/60 hover:text-orange-300 transition-colors p-0.5"
                        title="Refresh"
                      >
                        <RefreshCw size={11} className={missingLoading ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>
                  <div className="divide-y divide-orange-700/20">
                    {needsDownload.map((mod) => (
                      <div key={mod.projectId} className="flex items-center gap-3 px-3 py-2">
                        <Package size={13} className="text-orange-400/60 flex-shrink-0" />
                        <span className="text-sm text-gray-300 flex-1 min-w-0 truncate">{mod.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <a
                            href={mod.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded text-mc-muted hover:text-gray-200 border border-mc-border hover:border-mc-border/80 flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink size={11} />
                            CurseForge
                          </a>
                          {cfEnabled && (
                            <button
                              onClick={() => searchInCF(mod.name)}
                              className="text-xs px-2 py-1 rounded text-mc-green hover:bg-mc-green/10 border border-mc-green/30 hover:border-mc-green/50 flex items-center gap-1 transition-colors"
                            >
                              <Search size={11} />
                              Search
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {mods.length > 0 && (
              <div className="flex items-center gap-2 bg-mc-dark border border-mc-border rounded-lg px-3 py-2">
                <Search size={13} className="text-mc-muted flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Filter installed mods…"
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="bg-transparent text-sm text-gray-300 placeholder-mc-muted outline-none flex-1"
                />
                {localSearch && (
                  <span className="text-xs text-mc-muted">{filteredMods.length}/{mods.length}</span>
                )}
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-mc-muted">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading…</span>
              </div>
            ) : mods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Package size={36} className="text-mc-muted opacity-30 mb-3" />
                <p className="text-sm text-mc-muted">No mods or plugins installed</p>
                <p className="text-xs text-mc-muted/60 mt-1">Upload .jar files or browse Modrinth to install</p>
              </div>
            ) : filteredMods.length === 0 ? (
              <div className="card p-6 text-center text-mc-muted text-sm">No mods match your filter</div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                    <tr>
                      <th className="text-left px-4 py-2.5">Name</th>
                      <th className="text-right px-4 py-2.5 hidden sm:table-cell">Version</th>
                      <th className="text-right px-4 py-2.5 hidden md:table-cell">Updated</th>
                      <th className="text-right px-4 py-2.5">Size</th>
                      <th className="px-4 py-2.5 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMods.map((mod) => (
                      <tr key={mod.path} className="border-b border-mc-border/40 hover:bg-mc-panel/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <Package size={13} className="text-mc-muted flex-shrink-0" />
                            <span className="font-mono text-xs text-gray-200 truncate max-w-64">{mod.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-mc-muted text-xs font-mono hidden sm:table-cell">
                          {parseVersion(mod.name) || <span className="opacity-40">—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right text-mc-muted text-xs hidden md:table-cell" title={new Date(mod.mtime).toLocaleString()}>
                          {fmtRelative(mod.mtime)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-mc-muted text-xs">{fmtSize(mod.size)}</td>
                        <td className="px-4 py-2.5 text-right">
                          {confirmRemovePath === mod.path ? (
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => remove(mod)} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded border border-red-700/50 hover:bg-red-900/30 transition-colors">
                                Remove?
                              </button>
                              <button onClick={() => setConfirmRemovePath(null)} className="p-1 text-mc-muted hover:text-gray-300 transition-colors">
                                <X size={11} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => remove(mod)}
                              className="p-1 rounded hover:bg-red-900/30 text-mc-muted hover:text-red-400 transition-colors"
                              title="Remove mod"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
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
          <>
            <form onSubmit={(e) => { e.preventDefault(); searchModrinth(mrQuery, 0); }} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
                <input className="input pl-9 w-full" placeholder="Search Modrinth mods…" value={mrQuery} onChange={(e) => setMrQuery(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary text-sm" disabled={mrLoading}>
                {mrLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Search
              </button>
            </form>
            <div className="text-xs text-yellow-400/70 bg-yellow-900/15 border border-yellow-800/30 rounded-lg px-3 py-2">
              Most mods also need to be installed on each player's client. Server-side only mods (e.g. performance, anti-cheat) are the exception.
            </div>
            {mrError && <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-3 py-2 text-sm">{mrError}</div>}
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
          </>
        )}

        {/* CurseForge browser */}
        {view === 'curseforge' && (
          <>
            <form onSubmit={(e) => { e.preventDefault(); searchCurseForge(cfQuery, 0); }} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
                <input className="input pl-9 w-full" placeholder="Search CurseForge mods…" value={cfQuery} onChange={(e) => setCfQuery(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary text-sm" disabled={cfLoading}>
                {cfLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Search
              </button>
            </form>
            <div className="text-xs text-yellow-400/70 bg-yellow-900/15 border border-yellow-800/30 rounded-lg px-3 py-2">
              Most mods also need to be installed on each player's client. Server-side only mods (e.g. performance, anti-cheat) are the exception.
            </div>
            {cfError && <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-3 py-2 text-sm">{cfError}</div>}
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
          </>
        )}
      </div>
    </div>
  );
}

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
      <div className="flex flex-col items-center justify-center py-16 gap-2 text-mc-muted">
        <Loader2 size={24} className="animate-spin" />
        <span className="text-sm">Searching…</span>
      </div>
    );
  }
  if (!results.length && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Search size={36} className="text-mc-muted opacity-30 mb-3" />
        <p className="text-sm text-mc-muted">Enter a search term to browse</p>
      </div>
    );
  }
  return (
    <>
      {total > 0 && (
        <div className="text-xs text-mc-muted px-1">
          {total.toLocaleString()} results
        </div>
      )}
      <div className="space-y-2">
        {results.map((hit) => {
          const id = getId(hit);
          const isInstalled = installedIds.has(id) || installedIds.has(Number(id));
          const isInstalling = installing === id;
          const canDownload = getDownloadAvailable(hit);
          return (
            <div key={id} className={`card p-3.5 flex items-start gap-3 transition-colors ${isInstalled ? 'border-mc-green/30 bg-mc-green/5' : 'hover:bg-mc-panel/40'}`}>
              {getIcon(hit) ? (
                <img src={imgProxy(getIcon(hit))} alt="" className="w-10 h-10 rounded-lg flex-shrink-0 object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-mc-dark border border-mc-border flex items-center justify-center flex-shrink-0">
                  <Package size={18} className="text-mc-muted" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm text-gray-200">{getTitle(hit)}</span>
                  {isInstalled && (
                    <span className="text-xs bg-mc-green/20 text-mc-green border border-mc-green/30 px-1.5 py-0.5 rounded">
                      ✓ Installed
                    </span>
                  )}
                </div>
                <p className="text-xs text-mc-muted mt-0.5 line-clamp-2">{getDesc(hit)}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-mc-muted flex items-center gap-1">
                    <Download size={10} className="text-mc-muted/60" />
                    {fmtDownloads(getDownloads(hit))}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a href={getLinkHref(hit)} target="_blank" rel="noreferrer" className="btn-ghost p-1.5 text-xs" title="View page">
                  <ExternalLink size={13} />
                </a>
                {canDownload ? (
                  <button
                    className={`text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                      isInstalled
                        ? 'bg-mc-green/20 text-mc-green border border-mc-green/30 cursor-default'
                        : 'btn-primary'
                    }`}
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
        <div className="flex items-center justify-center gap-3 pt-2">
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

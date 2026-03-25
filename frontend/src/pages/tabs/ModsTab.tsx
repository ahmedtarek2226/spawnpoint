import { useState, useEffect, useRef } from 'react';
import { Package, Upload, Trash2, Search, Download, ExternalLink, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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

function fmtSize(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PAGE_SIZE = 20;

export default function ModsTab({ serverId }: { serverId: string }) {
  const [mods, setMods] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [localSearch, setLocalSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Modrinth browser
  const [view, setView] = useState<'installed' | 'browse'>('installed');
  const [mrQuery, setMrQuery] = useState('');
  const [mrResults, setMrResults] = useState<ModrinthHit[]>([]);
  const [mrTotal, setMrTotal] = useState(0);
  const [mrPage, setMrPage] = useState(0);
  const [mrLoading, setMrLoading] = useState(false);
  const [mrError, setMrError] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [idsLoaded, setIdsLoaded] = useState(false);

  async function loadInstalled() {
    setLoading(true);
    try {
      const data = await api.get<Entry[]>(`/servers/${serverId}/files/mods`);
      setMods(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  useEffect(() => { loadInstalled(); }, [serverId]);

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

  async function install(hit: ModrinthHit) {
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
      setInstalledIds((prev) => new Set(prev).add(hit.project_id));
      loadInstalled();
      // Re-sync from server hashes in background
      api.get<Record<string, string>>(`/servers/${serverId}/modrinth/installed-ids`)
        .then((data) => setInstalledIds(new Set(Object.keys(data))))
        .catch(() => {});
    } catch (err: unknown) {
      setMrError(err instanceof Error ? err.message : 'Install failed');
    }
    setInstalling(null);
  }

  const totalPages = Math.ceil(mrTotal / PAGE_SIZE);

  return (
    <div className="p-4 space-y-4 h-full overflow-y-auto">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-mc-border w-full pb-0">
          <button
            onClick={() => setView('installed')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t transition-colors border-b-2 -mb-px ${
              view === 'installed' ? 'border-mc-green text-mc-green bg-mc-green/5' : 'border-transparent text-mc-muted hover:text-gray-300'
            }`}
          >
            <Package size={13} /> Installed
            <span className={`text-xs px-1 rounded ${view === 'installed' ? 'bg-mc-green/20 text-mc-green' : 'bg-mc-panel text-mc-muted'}`}>
              {mods.length}
            </span>
          </button>
          <button
            onClick={async () => {
            setView('browse');
            if (!mrResults.length) searchModrinth('', 0);
            if (!idsLoaded) {
              setIdsLoaded(true);
              try {
                const data = await api.get<Record<string, string>>(`/servers/${serverId}/modrinth/installed-ids`);
                setInstalledIds(new Set(Object.keys(data)));
              } catch { /* best-effort */ }
            }
          }}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t transition-colors border-b-2 -mb-px ${
              view === 'browse' ? 'border-mc-green text-mc-green bg-mc-green/5' : 'border-transparent text-mc-muted hover:text-gray-300'
            }`}
          >
            <Search size={13} /> Browse Modrinth
          </button>
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
              <div>
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
            </div>
          )}
        </>
      )}

      {/* Modrinth browser */}
      {view === 'browse' && (
        <div className="space-y-3">
          <form onSubmit={(e) => { e.preventDefault(); searchModrinth(mrQuery, 0); }} className="flex gap-2">
            <div className="relative flex-1">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
              <input
                className="input pl-8 w-full"
                placeholder="Search Modrinth…"
                value={mrQuery}
                onChange={(e) => setMrQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary text-sm" disabled={mrLoading}>
              {mrLoading ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              Search
            </button>
          </form>

          <div className="text-xs text-yellow-400/80 bg-yellow-900/20 border border-yellow-800/40 rounded px-3 py-2">
            Most mods also need to be installed on each player's client. Server-side only mods (e.g. performance, anti-cheat) are the exception.
          </div>

          {mrError && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{mrError}</div>
          )}

          {mrLoading && !mrResults.length ? (
            <div className="text-center py-12 text-mc-muted text-sm">
              <Loader2 size={24} className="animate-spin mx-auto mb-2" />
              Searching…
            </div>
          ) : mrResults.length === 0 && !mrLoading ? (
            <div className="card p-8 text-center text-mc-muted text-sm">
              Enter a search term to browse Modrinth
            </div>
          ) : (
            <>
              {mrTotal > 0 && (
                <div className="text-xs text-mc-muted">{mrTotal.toLocaleString()} results</div>
              )}
              <div className="space-y-2">
                {mrResults.map((hit) => {
                  const isInstalled = installedIds.has(hit.project_id);
                  const isInstalling = installing === hit.project_id;
                  return (
                    <div key={hit.project_id} className={`card p-4 flex items-start gap-3 ${isInstalled ? 'border-mc-green/40' : ''}`}>
                      {hit.icon_url ? (
                        <img src={hit.icon_url} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-mc-dark flex items-center justify-center flex-shrink-0">
                          <Package size={18} className="text-mc-muted" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-200">{hit.title}</span>
                          {isInstalled && (
                            <span className="text-xs bg-mc-green/20 text-mc-green border border-mc-green/30 px-1.5 py-0.5 rounded">✓ Installed</span>
                          )}
                          <span className="text-xs text-mc-muted flex items-center gap-1">
                            <Download size={10} /> {fmtDownloads(hit.downloads)}
                          </span>
                        </div>
                        <p className="text-xs text-mc-muted mt-0.5 line-clamp-2">{hit.description}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <a
                          href={`https://modrinth.com/mod/${hit.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-ghost p-1.5 text-xs"
                          title="View on Modrinth"
                        >
                          <ExternalLink size={13} />
                        </a>
                        <button
                          className={`text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                            isInstalled
                              ? 'bg-mc-green/20 text-mc-green border border-mc-green/30 cursor-default'
                              : 'btn-primary'
                          }`}
                          disabled={!!installing || isInstalled}
                          onClick={() => !isInstalled && install(hit)}
                        >
                          {isInstalling ? (
                            <><Loader2 size={12} className="animate-spin" /> Installing…</>
                          ) : isInstalled ? (
                            <>✓ Installed</>
                          ) : (
                            <><Download size={12} /> Install</>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    className="btn-ghost p-1.5"
                    disabled={mrPage === 0 || mrLoading}
                    onClick={() => searchModrinth(mrQuery, mrPage - 1)}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className="text-xs text-mc-muted">Page {mrPage + 1} of {totalPages}</span>
                  <button
                    className="btn-ghost p-1.5"
                    disabled={mrPage >= totalPages - 1 || mrLoading}
                    onClick={() => searchModrinth(mrQuery, mrPage + 1)}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Upload, Archive, ChevronLeft, Package, Search, Download, ExternalLink, ChevronRight, Loader2, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, uploadPrismExport, imgProxy } from '../api/client';
import { useServersStore } from '../stores/serversStore';
import { useJobStore } from '../stores/jobStore';
import type { Server as ServerType } from '../stores/serversStore';
import type { JobRecord } from '../stores/jobStore';

// ── shared constants ────────────────────────────────────────────────────────

const JAVA_VERSIONS = [
  { value: '8',        label: 'Java 8' },
  { value: '11',       label: 'Java 11' },
  { value: '17',       label: 'Java 17' },
  { value: '21',       label: 'Java 21 (recommended)' },
  { value: '21-graal', label: 'Java 21 GraalVM' },
  { value: '22',       label: 'Java 22' },
  { value: '25',       label: 'Java 25 (latest)' },
];

const SERVER_TYPES = ['vanilla', 'paper', 'spigot', 'purpur', 'fabric', 'forge', 'neoforge', 'quilt', 'bungeecord', 'velocity'] as const;
const TYPE_LABELS: Record<string, string> = {
  vanilla: 'Vanilla', paper: 'Paper', spigot: 'Spigot', purpur: 'Purpur',
  fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt',
  bungeecord: 'BungeeCord', velocity: 'Velocity',
};
const POPULAR_VERSIONS = ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9'];

type Mode = 'pick' | 'new' | 'prism' | 'mrpack' | 'modrinth-pack' | 'cf-pack' | 'backup';

// ── root component ───────────────────────────────────────────────────────────

export default function CreateServer() {
  const navigate = useNavigate();
  const setServers = useServersStore((s) => s.setServers);
  const [mode, setMode] = useState<Mode>('pick');
  const [cfEnabled, setCfEnabled] = useState(false);

  useEffect(() => {
    api.get<{ enabled: boolean }>('/curseforge/status')
      .then((d) => setCfEnabled(d.enabled))
      .catch(() => {});
  }, []);

  async function refresh() {
    const servers = await api.get<ServerType[]>('/servers');
    setServers(servers);
  }

  if (mode === 'new')           return <NewForm           onBack={() => setMode('pick')} onDone={async (id) => { await refresh(); navigate(`/servers/${id}`); }} />;
  if (mode === 'prism')         return <PrismForm         onBack={() => setMode('pick')} onDone={async (id) => { await refresh(); navigate(`/servers/${id}`); }} />;
  if (mode === 'mrpack')        return <MrpackForm        onBack={() => setMode('pick')} onDone={async (id) => { await refresh(); navigate(`/servers/${id}`); }} />;
  if (mode === 'modrinth-pack') return <ModrinthPackForm  onBack={() => setMode('pick')} onDone={async (id) => { await refresh(); navigate(`/servers/${id}`); }} />;
  if (mode === 'cf-pack')       return <CurseForgePackForm onBack={() => setMode('pick')} onDone={async (id) => { await refresh(); navigate(`/servers/${id}`); }} />;
  if (mode === 'backup')        return <BackupForm        onBack={() => setMode('pick')} onDone={async (id) => { await refresh(); navigate(`/servers/${id}`); }} />;

  return (
    <div className="p-6 max-w-2xl">
      {/* Header */}
      <div className="mb-8">
        <div className="text-xs font-mono tracking-widest uppercase text-mc-muted mb-1">spawnpoint</div>
        <h1 className="text-3xl font-bold tracking-tight">Add Server</h1>
        <p className="text-mc-muted text-sm mt-1 font-mono">Configure your next world.</p>
      </div>

      {/* Hero: New Server */}
      <button
        onClick={() => setMode('new')}
        className="w-full card p-5 text-left group relative overflow-hidden mb-6 hover:border-mc-green/50 transition-all duration-200"
        style={{ background: 'linear-gradient(135deg, #242424 0%, #1d261d 100%)' }}
      >
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: 'linear-gradient(#5da832 1px, transparent 1px), linear-gradient(90deg, #5da832 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }} />
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-lg border border-mc-green/30 bg-mc-green/10 text-mc-green group-hover:bg-mc-green/20 group-hover:border-mc-green/50 transition-all duration-200 flex-shrink-0">
            <Server size={26} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="font-bold text-base text-gray-100 group-hover:text-mc-green transition-colors duration-200">New Server</span>
              <span className="text-xs text-mc-green border border-mc-green/30 rounded px-1.5 py-px font-mono leading-none">recommended</span>
            </div>
            <div className="text-sm text-mc-muted">Start from scratch — choose server type, MC version, memory and Java.</div>
          </div>
          <ChevronRight size={18} className="text-mc-muted group-hover:text-mc-green group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
        </div>
      </button>

      {/* Browse & Install */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-mono tracking-widest uppercase text-mc-muted whitespace-nowrap">Browse &amp; Install</span>
          <div className="flex-1 h-px bg-mc-border" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('modrinth-pack')}
            className="card p-4 text-left group hover:border-emerald-500/40 transition-all duration-200"
          >
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 transition-colors duration-200 w-fit mb-3">
              <Search size={17} />
            </div>
            <div className="font-semibold text-sm text-gray-200 group-hover:text-emerald-400 transition-colors duration-200 mb-1">Modrinth</div>
            <div className="text-xs text-mc-muted leading-relaxed">Browse thousands of modpacks — no file download needed.</div>
          </button>

          <button
            onClick={() => cfEnabled ? setMode('cf-pack') : undefined}
            disabled={!cfEnabled}
            className={`card p-4 text-left group transition-all duration-200 ${cfEnabled ? 'hover:border-orange-500/40 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
          >
            <div className={`p-2 rounded-md bg-orange-500/10 text-orange-400 w-fit mb-3 transition-colors duration-200 ${cfEnabled ? 'group-hover:bg-orange-500/20' : ''}`}>
              {cfEnabled ? <Search size={17} /> : <Lock size={17} />}
            </div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`font-semibold text-sm text-gray-200 transition-colors duration-200 ${cfEnabled ? 'group-hover:text-orange-400' : ''}`}>CurseForge</span>
              {!cfEnabled && <span className="text-xs text-mc-muted font-mono border border-mc-border rounded px-1 leading-none py-px">locked</span>}
            </div>
            <div className="text-xs text-mc-muted leading-relaxed">
              {cfEnabled ? 'ATM, FTB, RLCraft and thousands more.' : 'Add data/curseforge.key to unlock.'}
            </div>
          </button>
        </div>
      </div>

      {/* Import */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-mono tracking-widest uppercase text-mc-muted">Import</span>
          <div className="flex-1 h-px bg-mc-border" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <button
            onClick={() => setMode('prism')}
            className="card p-4 text-left group hover:border-blue-400/40 transition-all duration-200"
          >
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors duration-200 w-fit mb-3">
              <Upload size={17} />
            </div>
            <div className="font-semibold text-sm text-gray-200 group-hover:text-blue-400 transition-colors duration-200 mb-1">Prism Launcher</div>
            <div className="text-xs text-mc-muted leading-relaxed">Upload a Prism export .zip — version and mods auto-detected.</div>
          </button>

          <button
            onClick={() => setMode('mrpack')}
            className="card p-4 text-left group hover:border-blue-400/40 transition-all duration-200"
          >
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition-colors duration-200 w-fit mb-3">
              <Package size={17} />
            </div>
            <div className="font-semibold text-sm text-gray-200 group-hover:text-blue-400 transition-colors duration-200 mb-1">.mrpack File</div>
            <div className="text-xs text-mc-muted leading-relaxed">Upload a Modrinth modpack file directly.</div>
          </button>
        </div>

        <button
          onClick={() => setMode('backup')}
          className="w-full card p-4 text-left group hover:border-slate-500/40 transition-all duration-200 flex items-center gap-4"
        >
          <div className="p-2 rounded-md bg-slate-500/10 text-slate-400 group-hover:bg-slate-500/20 transition-colors duration-200 flex-shrink-0">
            <Archive size={17} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-200 group-hover:text-slate-300 transition-colors duration-200">Restore from Backup</div>
            <div className="text-xs text-mc-muted mt-0.5">Restore a full .tar.gz backup as a new server.</div>
          </div>
          <ChevronRight size={16} className="text-mc-muted group-hover:text-slate-400 group-hover:translate-x-0.5 transition-all duration-200 flex-shrink-0" />
        </button>
      </div>

      <button onClick={() => navigate('/')} className="btn-ghost text-xs">Cancel</button>
    </div>
  );
}

// ── back button ──────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-mc-muted hover:text-gray-200 mb-6 transition-colors">
      <ChevronLeft size={16} /> Back
    </button>
  );
}

// ── new server form ──────────────────────────────────────────────────────────

function NewForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const [form, setForm] = useState({
    name: '', type: 'paper', mcVersion: '1.21.4',
    port: 25565, memoryMb: 2048,
    jvmFlags: '-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200',
    javaVersion: '21',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const server = await api.post<ServerType>('/servers', form);
      onDone(server.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-bold mb-6">New Server</h1>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label">Server Name</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Survival Server" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Server Type</label>
            <select className="input" value={form.type} onChange={e => set('type', e.target.value)}>
              {SERVER_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Minecraft Version</label>
            <input className="input" list="mc-versions" value={form.mcVersion} onChange={e => set('mcVersion', e.target.value)} placeholder="1.21.4" required />
            <datalist id="mc-versions">
              {POPULAR_VERSIONS.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" min={1} max={65535} value={form.port} onChange={e => set('port', parseInt(e.target.value))} required />
          </div>
          <div>
            <label className="label">Memory (MB)</label>
            <input className="input" type="number" min={512} step={512} value={form.memoryMb} onChange={e => set('memoryMb', parseInt(e.target.value))} required />
          </div>
          <div>
            <label className="label">Java Version</label>
            <select className="input" value={form.javaVersion} onChange={e => set('javaVersion', e.target.value)}>
              {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">JVM Flags</label>
          <input className="input" value={form.jvmFlags} onChange={e => set('jvmFlags', e.target.value)} />
          <p className="text-xs text-mc-muted mt-1">Additional JVM arguments passed to Java</p>
        </div>

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating…' : 'Create Server'}
        </button>
      </form>
    </div>
  );
}

// ── prism import form ────────────────────────────────────────────────────────

function PrismForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [port, setPort] = useState(25565);
  const [memoryMb, setMemoryMb] = useState(2048);
  const [javaVersion, setJavaVersion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ mcVersion: string; serverType: string; loaderVersion?: string; javaVersion: string; mods: string[]; modsFound: number } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.zip$/, ''));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const data = await uploadPrismExport(file, { name: name || undefined, port, memoryMb, javaVersion }) as { server: ServerType; importInfo: typeof result };
      setResult(data.importInfo);
      setTimeout(() => onDone(data.server.id), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-bold mb-2">Import from Prism Launcher</h1>
      <p className="text-mc-muted text-sm mb-6">
        Export an instance from Prism Launcher (<strong className="text-gray-300">Right-click → Export Instance</strong>), then upload the .zip here.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${file ? 'border-mc-green/60 bg-mc-green/5' : 'border-mc-border hover:border-gray-500'}`}
        >
          <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onFile} />
          <Upload size={32} className="mx-auto mb-2 text-mc-muted" />
          {file ? (
            <div>
              <div className="font-medium text-mc-green">{file.name}</div>
              <div className="text-xs text-mc-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
          ) : (
            <div>
              <div className="text-gray-300">Click to select Prism export .zip</div>
            </div>
          )}
        </div>

        <div>
          <label className="label">Server Name (optional)</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Auto-detected from export" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" min={1} max={65535} value={port} onChange={e => setPort(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Memory (MB)</label>
            <input className="input" type="number" min={512} step={512} value={memoryMb} onChange={e => setMemoryMb(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Java Version</label>
            <select className="input" value={javaVersion} onChange={e => setJavaVersion(e.target.value)}>
              <option value="">Auto-detect</option>
              {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </div>
        </div>

        {result && (
          <div className="bg-mc-green/10 border border-mc-green/40 rounded p-4 text-sm space-y-1">
            <div className="font-medium text-mc-green">Import successful! Redirecting…</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
              <span className="text-mc-muted">Type</span><span className="text-white capitalize">{result.serverType}</span>
              <span className="text-mc-muted">MC Version</span><span className="text-white">{result.mcVersion}</span>
              {result.loaderVersion && <><span className="text-mc-muted">Loader</span><span className="text-white">{result.loaderVersion}</span></>}
              <span className="text-mc-muted">Java</span><span className="text-white">Java {result.javaVersion}</span>
              <span className="text-mc-muted">Mods</span><span className="text-white">{result.modsFound}</span>
            </div>
          </div>
        )}

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>}

        <button type="submit" className="btn-primary w-full" disabled={!file || loading}>
          {loading ? 'Importing…' : 'Import Server'}
        </button>
      </form>
    </div>
  );
}

// ── mrpack import form ───────────────────────────────────────────────────────

function MrpackForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [port, setPort] = useState(25565);
  const [memoryMb, setMemoryMb] = useState(2048);
  const [javaVersion, setJavaVersion] = useState('21');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; versionId: string; mcVersion: string; serverType: string; loaderVersion?: string; modsDownloaded: number; modsSkipped: number } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.mrpack$/, ''));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('export', file);
      form.append('name', name);
      form.append('port', String(port));
      form.append('memoryMb', String(memoryMb));
      form.append('javaVersion', javaVersion);

      const res = await fetch('/api/prism/import-mrpack', { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Import failed');

      setResult(json.data.importInfo);
      setTimeout(() => onDone(json.data.server.id), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-bold mb-2">Import Modrinth Pack</h1>
      <p className="text-mc-muted text-sm mb-6">
        Upload a <strong className="text-gray-300">.mrpack</strong> file. Server-compatible mods are downloaded automatically. Client-only mods are skipped.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${file ? 'border-mc-green/60 bg-mc-green/5' : 'border-mc-border hover:border-gray-500'}`}
        >
          <input ref={fileRef} type="file" accept=".mrpack" className="hidden" onChange={onFile} />
          <Package size={32} className="mx-auto mb-2 text-mc-muted" />
          {file ? (
            <div>
              <div className="font-medium text-mc-green">{file.name}</div>
              <div className="text-xs text-mc-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
          ) : (
            <div>
              <div className="text-gray-300">Click to select a .mrpack file</div>
            </div>
          )}
        </div>

        <div>
          <label className="label">Server Name (optional)</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Auto-detected from pack" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" min={1} max={65535} value={port} onChange={e => setPort(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Memory (MB)</label>
            <input className="input" type="number" min={512} step={512} value={memoryMb} onChange={e => setMemoryMb(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Java Version</label>
            <select className="input" value={javaVersion} onChange={e => setJavaVersion(e.target.value)}>
              {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </div>
        </div>

        {result && (
          <div className="bg-mc-green/10 border border-mc-green/40 rounded p-4 text-sm space-y-1">
            <div className="font-medium text-mc-green">Import successful! Redirecting…</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
              <span className="text-mc-muted">Pack</span><span className="text-white">{result.name} {result.versionId}</span>
              <span className="text-mc-muted">MC Version</span><span className="text-white">{result.mcVersion}</span>
              <span className="text-mc-muted">Type</span><span className="text-white capitalize">{result.serverType}{result.loaderVersion ? ` ${result.loaderVersion}` : ''}</span>
              <span className="text-mc-muted">Mods downloaded</span><span className="text-white">{result.modsDownloaded}</span>
              <span className="text-mc-muted">Mods skipped (client-only)</span><span className="text-white">{result.modsSkipped}</span>
            </div>
          </div>
        )}

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>}

        <button type="submit" className="btn-primary w-full" disabled={!file || loading}>
          {loading ? 'Importing…' : 'Import Pack'}
        </button>
      </form>
    </div>
  );
}

// ── modrinth modpack browser form ────────────────────────────────────────────

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

function fmtDownloads(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

const PACK_PAGE_SIZE = 20;

type PackStep = 'search' | 'configure';

function ModrinthPackForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
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
      // Seed the store with the initial job state
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

// ── curseforge modpack browser form ──────────────────────────────────────────

interface CfPackHit {
  id: number;
  name: string;
  summary: string;
  downloadCount: number;
  logo?: { url: string };
  links?: { websiteUrl: string };
  latestFilesIndexes: { fileId: number; gameVersion: string; filename: string; releaseType: number }[];
}

interface CfPackFile {
  id: number;
  displayName: string;
  fileName: string;
  downloadUrl: string | null;
  gameVersions: string[];
  releaseType: number; // 1=release, 2=beta, 3=alpha
}

const RELEASE_LABEL: Record<number, string> = { 1: 'Release', 2: 'Beta', 3: 'Alpha' };

const CF_PACK_PAGE_SIZE = 20;

function CurseForgePackForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const [step, setStep] = useState<'search' | 'configure'>('search');
  const upsertJob = useJobStore((s) => s.upsertJob);
  const jobs = useJobStore((s) => s.jobs);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<CfPackHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selectedPack, setSelectedPack] = useState<CfPackHit | null>(null);
  const [files, setFiles] = useState<CfPackFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);

  const [name, setName] = useState('');
  const [port, setPort] = useState(25565);
  const [memoryMb, setMemoryMb] = useState(4096);
  const [memoryHint, setMemoryHint] = useState('');
  const [javaVersion, setJavaVersion] = useState('21');
  const [jobId, setJobId] = useState<string | null>(null);
  const [installError, setInstallError] = useState('');

  const activeJob: JobRecord | null = jobId ? (jobs.find(j => j.id === jobId) ?? null) : null;

  const totalPages = Math.ceil(total / CF_PACK_PAGE_SIZE);

  // Auto-estimate memory and Java when a file version is selected
  useEffect(() => {
    if (!selectedFileId || !selectedPack) return;
    let cancelled = false;
    setMemoryHint('Estimating…');
    api.get<{ modCount: number; suggestedMemoryMb: number; suggestedJavaVersion: string }>(
      `/curseforge/modpacks/${selectedPack.id}/files/${selectedFileId}/estimate-memory`
    ).then(data => {
      if (cancelled) return;
      setMemoryMb(data.suggestedMemoryMb);
      setJavaVersion(data.suggestedJavaVersion);
      setMemoryHint(`${data.modCount} mods detected → ${data.suggestedMemoryMb} MB, Java ${data.suggestedJavaVersion}`);
    }).catch(() => {
      if (!cancelled) setMemoryHint('');
    });
    return () => { cancelled = true; };
  }, [selectedFileId]);

  async function search(q: string, p: number) {
    setSearching(true);
    setSearchError('');
    try {
      const data = await api.get<{ hits: CfPackHit[]; total: number }>(
        `/curseforge/modpacks/search?q=${encodeURIComponent(q)}&offset=${p * CF_PACK_PAGE_SIZE}`
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

  async function selectPack(hit: CfPackHit) {
    setSelectedPack(hit);
    setName(hit.name);
    setFilesLoading(true);
    setFiles([]);
    setSelectedFileId(null);
    try {
      const data = await api.get<CfPackFile[]>(`/curseforge/modpacks/versions/${hit.id}`);
      // Only release files by default, fall back to all
      const releases = data.filter(f => f.releaseType === 1);
      const list = releases.length ? releases : data;
      setFiles(list);
      if (list.length) setSelectedFileId(list[0].id);
    } catch { /* ignore */ }
    setFilesLoading(false);
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
    if (!selectedPack || !selectedFileId) return;
    const file = files.find(f => f.id === selectedFileId);
    if (!file) return;
    if (!file.downloadUrl) {
      setInstallError('This modpack file is not available for direct download. Please download it manually from CurseForge and use the .zip import option.');
      return;
    }

    setInstallError('');
    try {
      const res = await fetch('/api/prism/install-from-curseforge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedPack.id, fileId: selectedFileId, name, port, memoryMb, javaVersion }),
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
        <p className="text-mc-muted text-sm mb-6">Installing from CurseForge modpack</p>

        <div className="card p-4 flex items-start gap-3 mb-6">
          {selectedPack.logo?.url ? (
            <img src={imgProxy(selectedPack.logo.url)} alt="" className="w-12 h-12 rounded flex-shrink-0 object-cover" />
          ) : (
            <div className="w-12 h-12 rounded bg-mc-dark flex items-center justify-center flex-shrink-0">
              <Package size={20} className="text-mc-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-gray-200">{selectedPack.name}</div>
            <p className="text-xs text-mc-muted mt-0.5 line-clamp-2">{selectedPack.summary}</p>
          </div>
          {selectedPack.links?.websiteUrl && (
            <a href={selectedPack.links.websiteUrl} target="_blank" rel="noreferrer" className="btn-ghost p-1.5 flex-shrink-0" title="View on CurseForge">
              <ExternalLink size={13} />
            </a>
          )}
        </div>

        <form onSubmit={install} className="space-y-5">
          <div>
            <label className="label">Version</label>
            {filesLoading ? (
              <div className="flex items-center gap-2 text-mc-muted text-sm"><Loader2 size={14} className="animate-spin" /> Loading versions…</div>
            ) : (
              <select className="input" value={selectedFileId ?? ''} onChange={e => setSelectedFileId(Number(e.target.value))}>
                {files.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.displayName} — {RELEASE_LABEL[f.releaseType] ?? 'Unknown'} — {f.gameVersions.slice(0, 3).join(', ')}{f.gameVersions.length > 3 ? '…' : ''}
                    {!f.downloadUrl ? ' (no direct download)' : ''}
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

          {installError && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{installError}</div>}

          <button type="submit" className="btn-primary w-full" disabled={!!activeJob || filesLoading || !selectedFileId}>
            {activeJob && (activeJob.status === 'running' || activeJob.status === 'queued')
              ? <><Loader2 size={14} className="animate-spin" /> Installing…</>
              : <><Download size={14} /> Create Server</>}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl h-full flex flex-col">
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-bold mb-1">Browse CurseForge Modpacks</h1>
      <p className="text-mc-muted text-sm mb-4">ATM, FTB, RLCraft, Vault Hunters, SkyFactory and more. Server-side mods are downloaded automatically.</p>

      <form onSubmit={(e) => { e.preventDefault(); search(query, 0); }} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
          <input className="input pl-8 w-full" placeholder="Search modpacks…" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <button type="submit" className="btn-primary text-sm" disabled={searching}>
          {searching ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />} Search
        </button>
      </form>

      {searchError && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm mb-3">{searchError}</div>}

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {searching && !hits.length ? (
          <div className="text-center py-12 text-mc-muted text-sm">
            <Loader2 size={24} className="animate-spin mx-auto mb-2" /> Searching…
          </div>
        ) : hits.length === 0 ? (
          <div className="card p-8 text-center text-mc-muted text-sm">No modpacks found</div>
        ) : (
          <>
            {total > 0 && <div className="text-xs text-mc-muted">{total.toLocaleString()} modpacks found</div>}
            {hits.map((hit) => (
              <button
                key={hit.id}
                onClick={() => selectPack(hit)}
                className="card p-4 flex items-start gap-3 w-full text-left hover:border-mc-green/50 transition-colors group"
              >
                {hit.logo?.url ? (
                  <img src={imgProxy(hit.logo.url)} alt="" className="w-10 h-10 rounded flex-shrink-0 object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-mc-dark flex items-center justify-center flex-shrink-0">
                    <Package size={18} className="text-mc-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-200 group-hover:text-mc-green transition-colors">{hit.name}</span>
                    <span className="text-xs text-mc-muted flex items-center gap-1"><Download size={10} /> {fmtDownloads(hit.downloadCount)}</span>
                  </div>
                  <p className="text-xs text-mc-muted mt-0.5 line-clamp-2">{hit.summary}</p>
                </div>
                <ChevronRight size={16} className="text-mc-muted group-hover:text-mc-green transition-colors flex-shrink-0 mt-1" />
              </button>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <button className="btn-ghost p-1.5" disabled={page === 0 || searching} onClick={() => search(query, page - 1)}>
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs text-mc-muted">Page {page + 1} of {totalPages}</span>
                <button className="btn-ghost p-1.5" disabled={page >= totalPages - 1 || searching} onClick={() => search(query, page + 1)}>
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

// ── backup import form ───────────────────────────────────────────────────────

function BackupForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [port, setPort] = useState(25565);
  const [memoryMb, setMemoryMb] = useState(2048);
  const [javaVersion, setJavaVersion] = useState('21');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [detected, setDetected] = useState<{ mcVersion?: string; loader?: string; loaderVersion?: string; name?: string; version?: string } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.tar\.gz$/, ''));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const form = new FormData();
      form.append('backup', file);
      form.append('name', name);
      form.append('port', String(port));
      form.append('memoryMb', String(memoryMb));
      form.append('javaVersion', javaVersion);

      const res = await fetch('/api/backups/import-as-server', { method: 'POST', body: form });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Import failed');

      setDetected(json.data.detected);
      setTimeout(() => onDone(json.data.server.id), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <BackButton onClick={onBack} />
      <h1 className="text-2xl font-bold mb-2">Import from Backup</h1>
      <p className="text-mc-muted text-sm mb-6">
        Upload a <strong className="text-gray-300">.tar.gz</strong> full backup to create a new server with all files restored.
      </p>

      <form onSubmit={submit} className="space-y-5">
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${file ? 'border-mc-green/60 bg-mc-green/5' : 'border-mc-border hover:border-gray-500'}`}
        >
          <input ref={fileRef} type="file" accept=".tar.gz" className="hidden" onChange={onFile} />
          <Archive size={32} className="mx-auto mb-2 text-mc-muted" />
          {file ? (
            <div>
              <div className="font-medium text-mc-green">{file.name}</div>
              <div className="text-xs text-mc-muted mt-1">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
            </div>
          ) : (
            <div>
              <div className="text-gray-300">Click to select a .tar.gz backup</div>
              <div className="text-xs text-mc-muted mt-1">Full backups only</div>
            </div>
          )}
        </div>

        <div>
          <label className="label">Server Name</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Auto-detected from backup" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" min={1} max={65535} value={port} onChange={e => setPort(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Memory (MB)</label>
            <input className="input" type="number" min={512} step={512} value={memoryMb} onChange={e => setMemoryMb(parseInt(e.target.value))} />
          </div>
          <div>
            <label className="label">Java Version</label>
            <select className="input" value={javaVersion} onChange={e => setJavaVersion(e.target.value)}>
              {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
          </div>
        </div>

        {detected && (
          <div className="bg-mc-green/10 border border-mc-green/40 rounded p-4 text-sm space-y-1">
            <div className="font-medium text-mc-green">Import successful! Redirecting…</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
              {detected.mcVersion && <><span className="text-mc-muted">MC Version</span><span className="text-white">{detected.mcVersion}</span></>}
              {detected.loader && <><span className="text-mc-muted">Loader</span><span className="text-white capitalize">{detected.loader}{detected.loaderVersion ? ` ${detected.loaderVersion}` : ''}</span></>}
              {detected.name && <><span className="text-mc-muted">Modpack</span><span className="text-white">{detected.name}{detected.version ? ` v${detected.version}` : ''}</span></>}
            </div>
          </div>
        )}

        {error && <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>}

        <button type="submit" className="btn-primary w-full" disabled={!file || loading}>
          {loading ? 'Importing…' : 'Import Server'}
        </button>
      </form>
    </div>
  );
}

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Package } from 'lucide-react';
import { uploadPrismExport } from '../api/client';
import { api } from '../api/client';
import { useServersStore } from '../stores/serversStore';
import type { Server } from '../stores/serversStore';

const JAVA_VERSIONS = [
  { value: '8',        label: 'Java 8' },
  { value: '11',       label: 'Java 11' },
  { value: '17',       label: 'Java 17' },
  { value: '21',       label: 'Java 21 (recommended)' },
  { value: '21-graal', label: 'Java 21 GraalVM' },
  { value: '22',       label: 'Java 22 (latest)' },
];

export default function ImportPrism() {
  const navigate = useNavigate();
  const setServers = useServersStore((s) => s.setServers);
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
      const data = await uploadPrismExport(file, { name: name || undefined, port, memoryMb, javaVersion }) as { server: Server; importInfo: typeof result };
      setResult(data.importInfo);
      const servers = await api.get<Server[]>('/servers');
      setServers(servers);
      setTimeout(() => navigate(`/servers/${data.server.id}`), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Package size={24} className="text-mc-green" />
        <h1 className="text-2xl font-bold">Import from Prism Launcher</h1>
      </div>

      <p className="text-mc-muted text-sm mb-6">
        Export an instance from Prism Launcher (<strong className="text-gray-300">Right-click → Export Instance</strong>), then upload the .zip here.
        Mods and configs will be copied automatically and the correct server type will be detected.
      </p>

      <form onSubmit={submit} className="space-y-5">
        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            file ? 'border-mc-green/60 bg-mc-green/5' : 'border-mc-border hover:border-gray-500'
          }`}
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
              <div className="text-xs text-mc-muted mt-1">or drag and drop</div>
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
              <option value="">Auto-detect from export</option>
              {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
            <p className="text-xs text-mc-muted mt-1">Detected from instance.cfg</p>
          </div>
        </div>

        {result && (
          <div className="bg-mc-green/10 border border-mc-green/40 rounded p-4 text-sm space-y-2">
            <div className="font-medium text-mc-green">Import successful! Redirecting…</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <span className="text-mc-muted">Type</span>
              <span className="text-white capitalize">{result.serverType}</span>
              <span className="text-mc-muted">MC Version</span>
              <span className="text-white">{result.mcVersion}</span>
              {result.loaderVersion && <>
                <span className="text-mc-muted">Loader</span>
                <span className="text-white">{result.loaderVersion}</span>
              </>}
              <span className="text-mc-muted">Java Version</span>
              <span className="text-white">Java {result.javaVersion}</span>
              <span className="text-mc-muted">Mods detected</span>
              <span className="text-white">{result.modsFound}</span>
            </div>
            {result.mods.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs text-mc-muted cursor-pointer hover:text-gray-300 select-none">
                  Show mods ({result.mods.length})
                </summary>
                <div className="mt-2 max-h-48 overflow-y-auto bg-mc-dark rounded p-2 space-y-0.5">
                  {result.mods.map((mod) => (
                    <div key={mod} className="text-xs font-mono text-gray-300 truncate">{mod}</div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/')} className="btn-ghost">Cancel</button>
          <button type="submit" className="btn-primary" disabled={!file || loading}>
            {loading ? 'Importing…' : 'Import Server'}
          </button>
        </div>
      </form>
    </div>
  );
}

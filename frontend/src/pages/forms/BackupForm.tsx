import { useState, useRef } from 'react';
import { Archive } from 'lucide-react';
import { JAVA_VERSIONS, BackButton } from './shared';

export function BackupForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
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

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../api/client';
import { useServersStore, type Server } from '../../stores/serversStore';

interface DiskUsage { serverFiles: number; backups: number; total: number; }

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

const JAVA_VERSIONS = [
  { value: '8',        label: 'Java 8' },
  { value: '11',       label: 'Java 11' },
  { value: '17',       label: 'Java 17' },
  { value: '21',       label: 'Java 21 (recommended)' },
  { value: '21-graal', label: 'Java 21 GraalVM' },
  { value: '22',       label: 'Java 22 (latest)' },
];

export default function SettingsTab({ server }: { server: Server }) {
  const setServers = useServersStore((s) => s.setServers);
  const [form, setForm] = useState({
    name: server.name,
    port: server.port,
    memoryMb: server.memoryMb,
    jvmFlags: server.jvmFlags,
    javaVersion: server.javaVersion ?? '21',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [diskUsage, setDiskUsage] = useState<DiskUsage | null>(null);

  useEffect(() => {
    api.get<DiskUsage>(`/servers/${server.id}/disk-usage`).then(setDiskUsage).catch(() => {});
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

  return (
    <div className="p-6 max-w-xl">
      <form onSubmit={save} className="space-y-5">
        <div>
          <label className="label">Server Name</label>
          <input className="input" value={form.name} onChange={e => set('name', e.target.value)} required />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Port</label>
            <input className="input" type="number" min={1} max={65535} value={form.port} onChange={e => set('port', parseInt(e.target.value))} />
            <p className="text-xs text-mc-muted mt-1">Requires restart</p>
          </div>
          <div>
            <label className="label">Memory (MB)</label>
            <input className="input" type="number" min={512} step={512} value={form.memoryMb} onChange={e => set('memoryMb', parseInt(e.target.value))} />
            <p className="text-xs text-mc-muted mt-1">Requires restart</p>
          </div>
          <div>
            <label className="label">Java Version</label>
            <select className="input" value={form.javaVersion} onChange={e => set('javaVersion', e.target.value)}>
              {JAVA_VERSIONS.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
            </select>
            <p className="text-xs text-mc-muted mt-1">Requires restart</p>
          </div>
        </div>

        <div>
          <label className="label">JVM Flags</label>
          <input className="input" value={form.jvmFlags} onChange={e => set('jvmFlags', e.target.value)} />
        </div>

        <div className="pt-2 border-t border-mc-border text-xs text-mc-muted space-y-1">
          <div>Type: <span className="text-gray-300">{server.type}</span></div>
          <div>MC Version: <span className="text-gray-300">{server.mcVersion}</span></div>
          <div>Created: <span className="text-gray-300">{new Date(server.createdAt).toLocaleString()}</span></div>
          {diskUsage && (
            <div className="pt-1 space-y-0.5">
              <div>Server files: <span className="text-gray-300">{fmtBytes(diskUsage.serverFiles)}</span></div>
              <div>Backups: <span className="text-gray-300">{fmtBytes(diskUsage.backups)}</span></div>
              <div>Total: <span className="text-gray-300">{fmtBytes(diskUsage.total)}</span></div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
        )}

        <button type="submit" className="btn-primary" disabled={saving}>
          <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

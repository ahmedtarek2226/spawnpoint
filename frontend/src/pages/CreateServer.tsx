import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useServersStore } from '../stores/serversStore';
import type { Server } from '../stores/serversStore';

const SERVER_TYPES = ['vanilla', 'paper', 'spigot', 'purpur', 'fabric', 'forge', 'neoforge', 'quilt', 'bungeecord', 'velocity'] as const;

const TYPE_LABELS: Record<string, string> = {
  vanilla: 'Vanilla', paper: 'Paper', spigot: 'Spigot', purpur: 'Purpur',
  fabric: 'Fabric', forge: 'Forge', neoforge: 'NeoForge', quilt: 'Quilt',
  bungeecord: 'BungeeCord', velocity: 'Velocity',
};

const POPULAR_VERSIONS = ['1.21.4', '1.21.3', '1.21.1', '1.20.6', '1.20.4', '1.20.1', '1.19.4', '1.18.2', '1.16.5', '1.12.2', '1.8.9'];

const JAVA_VERSIONS = [
  { value: '8',       label: 'Java 8' },
  { value: '11',      label: 'Java 11' },
  { value: '17',      label: 'Java 17' },
  { value: '21',      label: 'Java 21 (recommended)' },
  { value: '21-graal',label: 'Java 21 GraalVM' },
  { value: '22',      label: 'Java 22 (latest)' },
];

export default function CreateServer() {
  const navigate = useNavigate();
  const setServers = useServersStore((s) => s.setServers);

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
      await api.post('/servers', form);
      const servers = await api.get<Server[]>('/servers');
      setServers(servers);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
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
              {SERVER_TYPES.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Minecraft Version</label>
            <input
              className="input"
              list="mc-versions"
              value={form.mcVersion}
              onChange={e => set('mcVersion', e.target.value)}
              placeholder="1.21.4"
              required
            />
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

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/')} className="btn-ghost">Cancel</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating…' : 'Create Server'}
          </button>
        </div>
      </form>
    </div>
  );
}

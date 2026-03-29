import { useState } from 'react';
import { api } from '../../api/client';
import type { Server as ServerType } from '../../stores/serversStore';
import { JAVA_VERSIONS, SERVER_TYPES, TYPE_LABELS, POPULAR_VERSIONS, BackButton } from './shared';

export function NewForm({ onBack, onDone }: { onBack: () => void; onDone: (id: string) => void }) {
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

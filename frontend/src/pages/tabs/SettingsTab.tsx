import { useState, useEffect } from 'react';
import { Save, Copy, X, Plus, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useServersStore, type Server } from '../../stores/serversStore';

interface DiskUsage { serverFiles: number; backups: number; total: number; }

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function suggestJava(mcVersion: string): string | null {
  const parts = mcVersion.split('.').map(Number);
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  if (minor >= 21 || (minor === 20 && patch >= 5)) return '21';
  if (minor >= 17) return '17';
  if (minor >= 12) return '11';
  return '8';
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
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: server.name,
    port: server.port,
    memoryMb: server.memoryMb,
    jvmFlags: server.jvmFlags,
    javaVersion: server.javaVersion ?? '21',
    tags: server.tags ?? [] as string[],
    rconPassword: (server as unknown as Record<string, string>).rconPassword ?? '',
    discordWebhookUrl: (server as unknown as Record<string, string | null>).discordWebhookUrl ?? '',
  });
  const [showRcon, setShowRcon] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
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
            {(() => {
              const suggested = suggestJava(server.mcVersion);
              const selectedBase = form.javaVersion.replace('-graal', '');
              if (suggested && selectedBase !== suggested) {
                return (
                  <p className="text-xs text-yellow-400 mt-1">
                    MC {server.mcVersion} recommends Java {suggested}.{' '}
                    <button type="button" className="underline hover:text-yellow-300" onClick={() => set('javaVersion', suggested)}>
                      Switch
                    </button>
                  </p>
                );
              }
              return <p className="text-xs text-mc-muted mt-1">Requires restart</p>;
            })()}
          </div>
        </div>

        <div>
          <label className="label">Tags</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {form.tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border"
                style={{ borderColor: tagColor(tag), color: tagColor(tag), backgroundColor: tagColor(tag) + '22' }}>
                {tag}
                <button type="button" onClick={() => set('tags', form.tags.filter(t => t !== tag))} className="opacity-60 hover:opacity-100">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Add tag…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => {
                if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                  e.preventDefault();
                  const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
                  if (!form.tags.includes(t)) set('tags', [...form.tags, t]);
                  setTagInput('');
                }
              }}
            />
            <button type="button" className="btn-ghost px-3" onClick={() => {
              const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
              if (t && !form.tags.includes(t)) { set('tags', [...form.tags, t]); setTagInput(''); }
            }}>
              <Plus size={14} />
            </button>
          </div>
          <p className="text-xs text-mc-muted mt-1">Press Enter or comma to add. Used to filter servers on the dashboard.</p>
        </div>

        <div>
          <label className="label">RCON Password</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                className="input w-full font-mono pr-8"
                type={showRcon ? 'text' : 'password'}
                value={form.rconPassword}
                onChange={e => set('rconPassword', e.target.value)}
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-mc-muted hover:text-gray-300"
                onClick={() => setShowRcon((v) => !v)}
              >
                {showRcon ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost px-3 text-xs flex-shrink-0"
              title="Regenerate password"
              onClick={() => set('rconPassword', Array.from(crypto.getRandomValues(new Uint8Array(18))).map(b => b.toString(36)).join('').slice(0, 24))}
            >
              <RefreshCw size={13} />
            </button>
          </div>
          <p className="text-xs text-mc-muted mt-1">Requires restart. Also updates server.properties if the file exists.</p>
        </div>

        <div>
          <label className="label">Discord Webhook URL</label>
          <input
            className="input"
            type="url"
            placeholder="https://discord.com/api/webhooks/…"
            value={form.discordWebhookUrl}
            onChange={e => set('discordWebhookUrl', e.target.value)}
          />
          <p className="text-xs text-mc-muted mt-1">Receive notifications for server start, stop, crash, player joins, and auto-backups.</p>
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

        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={saving}>
            <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving…' : 'Save Settings'}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={duplicating}
            onClick={async () => {
              setDuplicating(true);
              try {
                const copy = await api.post<Server>(`/servers/${server.id}/duplicate`);
                const servers = await api.get<Server[]>('/servers');
                setServers(servers);
                navigate(`/servers/${copy.id}/settings`);
              } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Duplicate failed');
              } finally {
                setDuplicating(false);
              }
            }}
          >
            <Copy size={14} /> {duplicating ? 'Duplicating…' : 'Duplicate'}
          </button>
        </div>
      </form>
    </div>
  );
}

const TAG_PALETTE = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#facc15','#f87171'];
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

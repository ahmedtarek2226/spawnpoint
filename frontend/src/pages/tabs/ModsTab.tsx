import { useState, useEffect, useRef } from 'react';
import { Package, Upload, Trash2 } from 'lucide-react';
import { api, uploadFiles } from '../../api/client';

interface Entry { name: string; path: string; size: number; mtime: string; }

function fmtSize(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ModsTab({ serverId }: { serverId: string }) {
  const [mods, setMods] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<Entry[]>(`/servers/${serverId}/files/mods`);
      setMods(data);
    } catch { /* empty */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [serverId]);

  async function remove(entry: Entry) {
    if (!confirm(`Remove ${entry.name}?`)) return;
    await api.delete(`/servers/${serverId}/files`, { path: entry.path });
    load();
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(`/servers/${serverId}/files/upload`, files);
    load();
    e.target.value = '';
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-gray-200">Installed Mods / Plugins</h2>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" multiple accept=".jar" className="hidden" onChange={onUpload} />
          <button onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">
            <Upload size={14} /> Upload .jar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-mc-muted text-sm">Loading…</div>
      ) : mods.length === 0 ? (
        <div className="card p-8 text-center text-mc-muted">
          <Package size={32} className="mx-auto mb-2 opacity-40" />
          <div>No mods or plugins found.</div>
          <div className="text-xs mt-1">Upload .jar files or start the server to generate directories.</div>
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
              {mods.map((mod) => (
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
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../api/client';

export default function PropertiesTab({ serverId }: { serverId: string }) {
  const [props, setProps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>(`/servers/${serverId}/files/properties`)
      .then(setProps)
      .catch(() => setError('Could not load server.properties'))
      .finally(() => setLoading(false));
  }, [serverId]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/servers/${serverId}/files/properties`, props);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6 text-mc-muted">Loading…</div>;

  if (Object.keys(props).length === 0) {
    return <div className="p-6 text-mc-muted">No server.properties found. Start the server once to generate it.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-mc-border">
        <span className="text-sm text-mc-muted">server.properties</span>
        <button onClick={save} className="btn-primary" disabled={saving}>
          <Save size={14} /> {saved ? 'Saved!' : saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-2 max-w-2xl">
          {Object.entries(props).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3">
              <label className="w-64 text-xs text-gray-400 font-mono flex-shrink-0 truncate" title={key}>{key}</label>
              <input
                className="input flex-1"
                value={value}
                onChange={(e) => setProps((p) => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

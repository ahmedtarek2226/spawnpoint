import { useState, useEffect } from 'react';
import { Settings, Key, CheckCircle2, AlertCircle, Eye, EyeOff, ExternalLink, Trash2 } from 'lucide-react';
import { api } from '../api/client';

interface SettingsData {
  curseforge_api_key_set: boolean;
  curseforge_enabled: boolean;
}

export default function AppSettings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [cfKey, setCfKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<'saved' | 'error' | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    api.get<SettingsData>('/settings').then(setData).catch(console.error);
  }, []);

  async function saveKey() {
    if (!cfKey.trim()) return;
    setSaving(true);
    setSaveResult(null);
    try {
      await api.put('/settings/curseforge_api_key', { value: cfKey.trim() });
      setSaveResult('saved');
      setCfKey('');
      setData(d => d ? { ...d, curseforge_api_key_set: true, curseforge_enabled: true } : d);
    } catch {
      setSaveResult('error');
    } finally {
      setSaving(false);
    }
  }

  async function removeKey() {
    setRemoving(true);
    setSaveResult(null);
    try {
      await api.put('/settings/curseforge_api_key', { value: '' });
      setData(d => d ? { ...d, curseforge_api_key_set: false, curseforge_enabled: false } : d);
    } catch {
      setSaveResult('error');
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div className="min-h-screen bg-mc-dark">
      {/* Header */}
      <div className="border-b border-mc-border px-6 py-4">
        <div className="flex items-center gap-2">
          <Settings size={16} className="text-mc-green" />
          <h1 className="text-base font-semibold text-gray-100">Settings</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* CurseForge Integration */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Key size={14} className="text-mc-muted" />
            <h2 className="text-sm font-semibold text-gray-200">CurseForge Integration</h2>
            {data?.curseforge_api_key_set && (
              <span className="flex items-center gap-1 text-xs text-mc-green bg-mc-green/10 border border-mc-green/20 rounded-full px-2 py-0.5 ml-1">
                <CheckCircle2 size={10} />
                Active
              </span>
            )}
          </div>

          <div className="bg-mc-panel border border-mc-border rounded-lg p-4 space-y-4">
            <p className="text-xs text-mc-muted leading-relaxed">
              An API key unlocks the CurseForge mod browser and modpack installer.
              Get a free key at{' '}
              <a
                href="https://console.curseforge.com/"
                target="_blank"
                rel="noreferrer"
                className="text-mc-green hover:underline inline-flex items-center gap-0.5"
              >
                console.curseforge.com <ExternalLink size={10} />
              </a>
            </p>

            {data?.curseforge_api_key_set ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-mc-dark border border-mc-border rounded px-3 py-2 font-mono">
                  <CheckCircle2 size={12} className="text-mc-green flex-shrink-0" />
                  API key is set
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={removeKey}
                    disabled={removing}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs text-red-400 hover:bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all duration-150 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                    {removing ? 'Removing…' : 'Remove key'}
                  </button>
                  <button
                    onClick={() => setData(d => d ? { ...d, curseforge_api_key_set: false } : d)}
                    className="text-xs text-mc-muted hover:text-gray-200 transition-colors px-2 py-1.5"
                  >
                    Replace key
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={cfKey}
                    onChange={e => { setCfKey(e.target.value); setSaveResult(null); }}
                    onKeyDown={e => e.key === 'Enter' && saveKey()}
                    placeholder="Paste your API key…"
                    className="w-full bg-mc-dark border border-mc-border rounded px-3 py-2 text-sm font-mono text-gray-200 placeholder-mc-muted outline-none focus:border-mc-green/50 pr-10 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mc-muted hover:text-gray-300 transition-colors"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={saveKey}
                    disabled={!cfKey.trim() || saving}
                    className="px-4 py-1.5 rounded text-sm bg-mc-green text-black font-medium hover:bg-mc-green/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                  >
                    {saving ? 'Saving…' : 'Save key'}
                  </button>

                  {saveResult === 'saved' && (
                    <span className="flex items-center gap-1 text-xs text-mc-green">
                      <CheckCircle2 size={12} /> Saved
                    </span>
                  )}
                  {saveResult === 'error' && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <AlertCircle size={12} /> Failed to save
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Upload, Archive, ChevronRight, Package, Search, Lock } from 'lucide-react';
import { api } from '../api/client';
import { useServersStore } from '../stores/serversStore';
import type { Server as ServerType } from '../stores/serversStore';
import { NewForm } from './forms/NewForm';
import { PrismForm } from './forms/PrismForm';
import { MrpackForm } from './forms/MrpackForm';
import { ModrinthPackForm } from './forms/ModrinthPackForm';
import { CurseForgePackForm } from './forms/CurseForgePackForm';
import { BackupForm } from './forms/BackupForm';

type Mode = 'pick' | 'new' | 'prism' | 'mrpack' | 'modrinth-pack' | 'cf-pack' | 'backup';

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
              {cfEnabled ? 'ATM, FTB, RLCraft and thousands more.' : 'Set CURSEFORGE_API_KEY in .env to unlock.'}
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

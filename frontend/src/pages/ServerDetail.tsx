import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Routes, Route, NavLink } from 'react-router-dom';
import { Play, Square, RotateCw, Zap, Terminal, FolderOpen, Settings, SlidersHorizontal, Archive, Package, Users } from 'lucide-react';
import { api } from '../api/client';
import { useServersStore } from '../stores/serversStore';
import StatusBadge from '../components/StatusBadge';
import CrashBanner from '../components/CrashBanner';

const ConsoleTab    = lazy(() => import('./tabs/ConsoleTab'));
const FilesTab      = lazy(() => import('./tabs/FilesTab'));
const PropertiesTab = lazy(() => import('./tabs/PropertiesTab'));
const ModsTab       = lazy(() => import('./tabs/ModsTab'));
const AutomationTab = lazy(() => import('./tabs/AutomationTab'));
const SettingsTab   = lazy(() => import('./tabs/SettingsTab'));
const PlayersTab    = lazy(() => import('./tabs/PlayersTab'));

const TABS = [
  { path: '', label: 'Console', icon: Terminal },
  { path: 'players', label: 'Players', icon: Users },
  { path: 'files', label: 'Files', icon: FolderOpen },
  { path: 'properties', label: 'Properties', icon: SlidersHorizontal },
  { path: 'mods', label: 'Mods/Plugins', icon: Package },
  { path: 'backups', label: 'Backups', icon: Archive },
  { path: 'settings', label: 'Settings', icon: Settings },
];

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const servers = useServersStore((s) => s.servers);
  const setServers = useServersStore((s) => s.setServers);
  const server = servers.find((s) => s.id === id);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!server && id) {
      api.get<typeof servers>('/servers').then(setServers).catch(console.error);
    }
  }, [id]);

  if (!server) {
    return <div className="p-6 text-mc-muted">Loading…</div>;
  }

  const status = server.runtime.status;

  // Check if another server is already active on the same port
  const portConflict = servers.find(
    (s) => s.id !== server.id && s.port === server.port &&
      (s.runtime.status === 'running' || s.runtime.status === 'starting')
  );

  async function action(name: string) {
    setActionLoading(name);
    setError('');
    try {
      await api.post(`/servers/${id}/${name}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${name} failed`);
    } finally {
      setActionLoading(null);
    }
  }

  const baseUrl = `/servers/${id}`;

  return (
    <div className="flex flex-col h-full">
      {/* Server header */}
      <div className="border-b border-mc-border bg-mc-panel px-4 md:px-6 py-3 md:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <StatusBadge status={status} />
            <div className="min-w-0">
              <h1 className="font-bold text-base md:text-lg text-gray-100 truncate">{server.name}</h1>
              <div className="text-xs text-mc-muted flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                <span>{server.type} · {server.mcVersion} · :{server.port}</span>
                {status === 'running' && (
                  <span className="text-gray-300">
                    {server.runtime.metrics.ramMb} MB · {server.runtime.metrics.cpuPercent.toFixed(1)}% CPU · {server.runtime.metrics.playersOnline} players
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {(status === 'stopped' || status === 'crashed') && (
              <div className="relative group">
                <button
                  className={`btn-primary text-sm ${portConflict ? 'opacity-60' : ''}`}
                  onClick={() => action('start')}
                  disabled={!!actionLoading}
                >
                  <Play size={14} /> {actionLoading === 'start' ? 'Starting…' : 'Start'}
                </button>
                {portConflict && (
                  <div className="absolute right-0 top-full mt-1.5 z-10 hidden group-hover:block w-56 bg-yellow-900/90 border border-yellow-700 text-yellow-200 text-xs rounded px-2.5 py-2 shadow-lg">
                    Port {server.port} is in use by <span className="font-semibold">{portConflict.name}</span>. Starting may fail.
                  </div>
                )}
              </div>
            )}
            {status === 'running' && (
              <>
                <button className="btn-ghost text-sm" onClick={() => action('restart')} disabled={!!actionLoading}>
                  <RotateCw size={14} /> <span className="hidden sm:inline">Restart</span>
                </button>
                <button className="btn-ghost text-sm" onClick={() => action('stop')} disabled={!!actionLoading}>
                  <Square size={14} /> <span className="hidden sm:inline">Stop</span>
                </button>
              </>
            )}
            {(status === 'starting' || status === 'stopping') && (
              <button className="btn-danger text-sm" onClick={() => action('kill')} disabled={!!actionLoading}>
                <Zap size={14} /> Kill
              </button>
            )}
          </div>
        </div>

        {portConflict && (status === 'stopped' || status === 'crashed') && (
          <div className="mt-2 text-yellow-300 text-xs bg-yellow-900/20 border border-yellow-800 rounded px-2 py-1">
            Port {server.port} is already in use by <span className="font-semibold">{portConflict.name}</span> — stop it first or change this server's port.
          </div>
        )}
        {error && (
          <div className="mt-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-2 py-1">{error}</div>
        )}

        {/* Tab nav */}
        <div className="relative mt-4 -mb-4">
        <nav className="flex gap-0.5 overflow-x-auto scrollbar-none">
          {TABS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path ? `${baseUrl}/${path}` : baseUrl}
              end={!path}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-2.5 md:px-3 py-2 text-sm rounded-t border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'border-mc-green text-mc-green bg-mc-green/5'
                    : 'border-transparent text-mc-muted hover:text-gray-300'
                }`
              }
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              {path === 'players' && status === 'running' && server.runtime.metrics.playersOnline > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full bg-mc-green/20 text-mc-green leading-none">
                  {server.runtime.metrics.playersOnline}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-mc-panel to-transparent" />
        </div>
      </div>

      {/* Crash analysis banner */}
      {status === 'crashed' && server.runtime.crashDiagnosis && server.runtime.crashDiagnosis.length > 0 && (
        <CrashBanner
          serverId={id!}
          issues={server.runtime.crashDiagnosis}
          onFixed={() => api.get<typeof servers>('/servers').then(setServers).catch(console.error)}
        />
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="p-6 text-mc-muted text-sm">Loading…</div>}>
          <Routes>
            <Route index element={<ConsoleTab serverId={id!} />} />
            <Route path="players" element={<PlayersTab serverId={id!} serverStatus={status} />} />
            <Route path="files" element={<FilesTab serverId={id!} />} />
            <Route path="properties" element={<PropertiesTab serverId={id!} />} />
            <Route path="mods" element={<ModsTab serverId={id!} />} />
            <Route path="backups" element={<AutomationTab serverId={id!} />} />
            <Route path="settings" element={<SettingsTab server={server} />} />
          </Routes>
        </Suspense>
      </div>

    </div>
  );
}

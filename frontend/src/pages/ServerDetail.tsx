import { useState, useEffect } from 'react';
import { useParams, useNavigate, Routes, Route, NavLink } from 'react-router-dom';
import { Play, Square, RotateCw, Zap, Trash2, Terminal, FolderOpen, Settings, Archive, Package, Users } from 'lucide-react';
import { api } from '../api/client';
import { useServersStore } from '../stores/serversStore';
import StatusBadge from '../components/StatusBadge';
import CrashBanner from '../components/CrashBanner';
import ConsoleTab from './tabs/ConsoleTab';
import FilesTab from './tabs/FilesTab';
import PropertiesTab from './tabs/PropertiesTab';
import ModsTab from './tabs/ModsTab';
import BackupsTab from './tabs/BackupsTab';
import SettingsTab from './tabs/SettingsTab';
import PlayersTab from './tabs/PlayersTab';

const TABS = [
  { path: '', label: 'Console', icon: Terminal },
  { path: 'players', label: 'Players', icon: Users },
  { path: 'files', label: 'Files', icon: FolderOpen },
  { path: 'properties', label: 'Properties', icon: Settings },
  { path: 'mods', label: 'Mods/Plugins', icon: Package },
  { path: 'backups', label: 'Backups', icon: Archive },
  { path: 'settings', label: 'Settings', icon: Settings },
];

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const servers = useServersStore((s) => s.servers);
  const setServers = useServersStore((s) => s.setServers);
  const server = servers.find((s) => s.id === id);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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

  async function deleteServer() {
    setShowDeleteModal(false);
    setActionLoading('delete');
    try {
      await api.delete(`/servers/${id}?wipe=true`);
      const servers = await api.get<typeof server[]>('/servers');
      setServers(servers as never);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
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
            <button className="btn-danger text-sm px-2" onClick={() => setShowDeleteModal(true)} disabled={!!actionLoading}>
              <Trash2 size={14} />
            </button>
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
        <nav className="flex gap-0.5 mt-4 -mb-4 overflow-x-auto scrollbar-none">
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
        <Routes>
          <Route index element={<ConsoleTab serverId={id!} />} />
          <Route path="players" element={<PlayersTab serverId={id!} serverStatus={status} />} />
          <Route path="files" element={<FilesTab serverId={id!} />} />
          <Route path="properties" element={<PropertiesTab serverId={id!} />} />
          <Route path="mods" element={<ModsTab serverId={id!} />} />
          <Route path="backups" element={<BackupsTab serverId={id!} />} />
          <Route path="settings" element={<SettingsTab server={server} />} />
        </Routes>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-mc-panel border border-mc-border rounded-lg shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
            <div className="text-sm font-medium text-gray-200">Delete server</div>
            <p className="text-xs text-mc-muted">
              Are you sure you want to delete <span className="text-gray-300 font-medium">{server.name}</span>?
              All server files, worlds, and configuration will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button className="btn-ghost text-xs" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn-danger text-xs" onClick={deleteServer}>
                Delete server
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

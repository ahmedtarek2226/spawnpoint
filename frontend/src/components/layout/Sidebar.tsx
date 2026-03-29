import { NavLink, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Plus, LayoutDashboard, X, LogOut, Search, Github, Bell } from 'lucide-react';
import { useServersStore } from '../../stores/serversStore';
import { useJobStore } from '../../stores/jobStore';
import StatusBadge from '../StatusBadge';
import NotificationsDrawer from '../NotificationsDrawer';

const SEARCH_THRESHOLD = 3;

function DockerIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
      <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.185v1.888c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
    </svg>
  );
}

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const servers = useServersStore((s) => s.servers);
  const unseenCount = useJobStore((s) => s.unseenCount);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [version, setVersion] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(json => setVersion(json.data?.version ?? null))
      .catch(() => {});
  }, []);

  function nav(path: string) {
    navigate(path);
    onClose?.();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const filteredServers = servers.filter(sv => {
    if (!search) return true;
    const q = search.toLowerCase();
    return sv.name.toLowerCase().includes(q) ||
      sv.type.toLowerCase().includes(q) ||
      sv.mcVersion.includes(q) ||
      (sv.tags ?? []).some(t => t.toLowerCase().includes(q));
  });

  const running = servers.filter(s => s.runtime.status === 'running').length;

  return (
    <aside className="w-56 h-full flex-shrink-0 bg-mc-panel border-r border-mc-border flex flex-col">

      {/* Logo */}
      <div className="px-4 py-3.5 border-b border-mc-border flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Spawnpoint" className="w-5 h-5 flex-shrink-0" />
            <span className="font-bold text-mc-green tracking-tight leading-none">Spawnpoint</span>
          </div>
          {version && (
            <div className="text-xs font-mono text-mc-muted mt-1 ml-7">{version}</div>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-mc-muted hover:text-gray-200 -mr-1 flex-shrink-0">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 flex flex-col gap-3">

        {/* Dashboard */}
        <NavLink
          to="/"
          end
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-all duration-150 border ${
              isActive
                ? 'bg-mc-green/15 text-mc-green border-mc-green/30'
                : 'text-gray-400 hover:text-gray-100 hover:bg-white/5 border-transparent'
            }`
          }
        >
          <LayoutDashboard size={14} className="flex-shrink-0" />
          <span className="font-medium">Dashboard</span>
        </NavLink>

        {/* Servers section */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 px-1">
            <span className="text-xs font-mono tracking-widest uppercase text-mc-muted">Servers</span>
            <div className="flex-1 h-px bg-mc-border" />
            {servers.length > 0 && (
              <span className="text-xs font-mono text-mc-muted">
                {running > 0 ? <span className="text-mc-green">{running}</span> : '0'}/{servers.length}
              </span>
            )}
          </div>

          {servers.length > SEARCH_THRESHOLD && (
            <div className="flex items-center gap-1.5 bg-mc-dark border border-mc-border rounded px-2 py-1.5">
              <Search size={11} className="text-mc-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-gray-300 placeholder-mc-muted outline-none flex-1 min-w-0"
              />
            </div>
          )}

          <div className="space-y-0.5">
            {filteredServers.map((sv) => (
              <NavLink
                key={sv.id}
                to={`/servers/${sv.id}`}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded text-sm transition-all duration-150 group border ${
                    isActive
                      ? 'bg-mc-green/15 text-mc-green border-mc-green/30'
                      : 'text-gray-400 hover:text-gray-100 hover:bg-white/5 border-transparent'
                  }`
                }
              >
                <StatusBadge status={sv.runtime.status} dot />
                <span className="truncate flex-1 min-w-0 text-xs" title={sv.name}>{sv.name}</span>
                <span className="text-xs font-mono text-mc-muted flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity duration-150">
                  {sv.type}
                </span>
              </NavLink>
            ))}

            {search && filteredServers.length === 0 && (
              <p className="px-3 py-2 text-xs text-mc-muted font-mono">no match</p>
            )}

            {servers.length === 0 && (
              <p className="px-3 py-2 text-xs text-mc-muted font-mono">no servers yet</p>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-mc-border p-2 space-y-1">
        <button
          onClick={() => nav('/servers/new')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-mc-green hover:bg-mc-green/10 border border-mc-green/25 hover:border-mc-green/50 transition-all duration-150"
        >
          <Plus size={14} className="flex-shrink-0" />
          <span className="font-medium">Add Server</span>
        </button>

        {/* Notifications */}
        <button
          onClick={() => setNotifOpen((v) => !v)}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm transition-all duration-150 ${
            notifOpen
              ? 'bg-white/8 text-gray-200'
              : 'text-mc-muted hover:text-gray-200 hover:bg-white/5'
          }`}
        >
          <div className="relative flex-shrink-0">
            <Bell size={13} />
            {unseenCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[13px] h-[13px] bg-mc-green rounded-full text-[8px] font-bold text-black flex items-center justify-center px-0.5 leading-none">
                {unseenCount > 9 ? '9+' : unseenCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
        </button>

        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded text-sm text-mc-muted hover:text-red-400 hover:bg-red-500/5 transition-all duration-150"
        >
          <LogOut size={13} className="flex-shrink-0" />
          <span>Sign out</span>
        </button>

        <div className="px-2 pt-1 flex items-center gap-3">
          <a
            href="https://github.com/Gren-95/spawnpoint"
            target="_blank"
            rel="noreferrer"
            title="GitHub"
            className="text-mc-muted hover:text-gray-300 transition-colors duration-150"
          >
            <Github size={13} />
          </a>
          <a
            href="https://hub.docker.com/r/fossfrog/spawnpoint"
            target="_blank"
            rel="noreferrer"
            title="Docker Hub"
            className="text-mc-muted hover:text-gray-300 transition-colors duration-150"
          >
            <DockerIcon size={13} />
          </a>
        </div>
      </div>

      <NotificationsDrawer isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
    </aside>
  );
}

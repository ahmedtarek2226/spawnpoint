import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Server, Plus, Upload, LayoutDashboard, X, LogOut, Search } from 'lucide-react';
import { useServersStore } from '../../stores/serversStore';
import StatusBadge from '../StatusBadge';

const SEARCH_THRESHOLD = 5;

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const servers = useServersStore((s) => s.servers);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  function nav(path: string) {
    navigate(path);
    onClose?.();
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="w-56 h-full flex-shrink-0 bg-mc-panel border-r border-mc-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-mc-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Spawnpoint" className="w-7 h-7" />
          <span className="font-bold text-mc-green text-lg tracking-tight">Spawnpoint</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-mc-muted hover:text-gray-200 -mr-1">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1">
        <NavLink
          to="/"
          end
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${isActive ? 'bg-mc-green/20 text-mc-green' : 'text-gray-400 hover:text-gray-100 hover:bg-mc-border/40'}`
          }
        >
          <LayoutDashboard size={16} />
          Dashboard
        </NavLink>

        <div className="pt-2 pb-1 px-3 text-xs text-mc-muted uppercase tracking-wider">Servers</div>

        {servers.length > SEARCH_THRESHOLD && (
          <div className="px-2 pb-1">
            <div className="flex items-center gap-1.5 bg-mc-dark border border-mc-border rounded px-2 py-1">
              <Search size={11} className="text-mc-muted flex-shrink-0" />
              <input
                type="text"
                placeholder="Filter servers…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-gray-300 placeholder-mc-muted outline-none flex-1 min-w-0"
              />
            </div>
          </div>
        )}

        {servers.filter(sv => !search || sv.name.toLowerCase().includes(search.toLowerCase())).map((sv) => (
          <NavLink
            key={sv.id}
            to={`/servers/${sv.id}`}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors ${isActive ? 'bg-mc-green/20 text-mc-green' : 'text-gray-400 hover:text-gray-100 hover:bg-mc-border/40'}`
            }
          >
            <Server size={14} className="flex-shrink-0" />
            <span className="truncate flex-1" title={sv.name}>{sv.name}</span>
            <StatusBadge status={sv.runtime.status} dot />
          </NavLink>
        ))}

        {search && servers.filter(sv => sv.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
          <p className="px-3 py-2 text-xs text-mc-muted">No servers match "{search}"</p>
        )}
      </nav>

      {/* Actions */}
      <div className="p-2 border-t border-mc-border space-y-1">
        <button onClick={() => nav('/servers/new')} className="btn-ghost w-full justify-start text-xs">
          <Plus size={14} /> New Server
        </button>
        <button onClick={() => nav('/servers/import')} className="btn-ghost w-full justify-start text-xs">
          <Upload size={14} /> Import Prism
        </button>
        <button onClick={logout} className="btn-ghost w-full justify-start text-xs text-mc-muted hover:text-red-400">
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}

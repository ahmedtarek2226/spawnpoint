import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Plus, MemoryStick, Users, Server, AlertTriangle, Search } from 'lucide-react';
import { useServersStore } from '../stores/serversStore';
import StatusBadge from '../components/StatusBadge';

const TAG_PALETTE = ['#4ade80','#60a5fa','#f472b6','#fb923c','#a78bfa','#34d399','#facc15','#f87171'];
function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[hash % TAG_PALETTE.length];
}

export default function Dashboard() {
  const servers = useServersStore((s) => s.servers);
  const navigate = useNavigate();
  const [dockerAvailable, setDockerAvailable] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/health')
      .then(r => r.json())
      .then(json => setDockerAvailable(json.data?.dockerAvailable ?? true))
      .catch(() => {});
  }, []);

  const running = servers.filter(s => s.runtime.status === 'running').length;
  const allTags = [...new Set(servers.flatMap(s => s.tags ?? []))].sort();
  const visibleServers = servers.filter(s => {
    const matchesTag = !activeTag || (s.tags ?? []).includes(activeTag);
    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.type.toLowerCase().includes(q) ||
      s.mcVersion.includes(q) ||
      (s.tags ?? []).some(t => t.toLowerCase().includes(q));
    return matchesTag && matchesSearch;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {!dockerAvailable && (
        <div className="flex items-center gap-3 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400">
          <AlertTriangle size={16} className="flex-shrink-0" />
          Docker daemon is unreachable. Check that <code className="font-mono text-xs">/var/run/docker.sock</code> is mounted. Server controls will not work.
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-mc-muted text-sm mt-1">{running} of {servers.length} servers running</p>
        </div>
        <div className="flex gap-2">
          {servers.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-mc-muted pointer-events-none" />
              <input
                className="input pl-8 text-sm w-48"
                placeholder="Search…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          )}
          <button onClick={() => navigate('/servers/new')} className="btn-primary text-sm">
            <Plus size={15} /> Add Server
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {servers.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Servers', value: servers.length, icon: Server },
            { label: 'Running', value: running, icon: Server },
            {
              label: 'Total Players',
              value: servers.reduce((acc, s) => acc + s.runtime.metrics.playersOnline, 0),
              icon: Users,
            },
            {
              label: 'Total RAM Used',
              value: `${servers.reduce((acc, s) => acc + s.runtime.metrics.ramMb, 0)} MB`,
              icon: MemoryStick,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-4 flex items-center gap-3">
              <Icon size={20} className="text-mc-green" />
              <div>
                <div className="text-xs text-mc-muted">{label}</div>
                <div className="text-lg font-bold text-gray-100">{value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tag filter */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${!activeTag ? 'border-mc-green text-mc-green bg-mc-green/10' : 'border-mc-border text-mc-muted hover:border-gray-500'}`}
          >
            All
          </button>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className="text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={activeTag === tag
                ? { borderColor: tagColor(tag), color: tagColor(tag), backgroundColor: tagColor(tag) + '22' }
                : { borderColor: '#374151', color: '#9ca3af' }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Server cards */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-4">⛏</span>
          <h2 className="text-xl font-bold text-gray-300 mb-2">No servers yet</h2>
          <p className="text-mc-muted mb-6">Create a new server or import a Prism Launcher export to get started.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/servers/new')} className="btn-primary">
              <Plus size={16} /> Add Server
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleServers.map((sv) => (
            <button
              key={sv.id}
              onClick={() => navigate(`/servers/${sv.id}`)}
              className="card p-5 text-left hover:border-mc-green/60 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-gray-100 group-hover:text-mc-green transition-colors">{sv.name}</div>
                  <div className="text-xs text-mc-muted mt-0.5">{sv.type} · {sv.mcVersion} · :{sv.port}</div>
                  {(sv.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {(sv.tags ?? []).map(tag => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full border"
                          style={{ borderColor: tagColor(tag), color: tagColor(tag), backgroundColor: tagColor(tag) + '22' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <StatusBadge status={sv.runtime.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <BarMetricItem
                  label="CPU"
                  value={sv.runtime.status === 'running' ? `${sv.runtime.metrics.cpuPercent.toFixed(1)}%` : '—'}
                  pct={sv.runtime.status === 'running' ? sv.runtime.metrics.cpuPercent / 100 : null}
                  color={sv.runtime.metrics.cpuPercent > 80 ? 'red' : sv.runtime.metrics.cpuPercent > 50 ? 'yellow' : 'green'}
                />
                <BarMetricItem
                  label="RAM"
                  value={sv.runtime.status === 'running' ? `${sv.runtime.metrics.ramMb} MB` : '—'}
                  pct={sv.runtime.status === 'running' ? sv.runtime.metrics.ramMb / sv.memoryMb : null}
                  color={sv.runtime.metrics.ramMb / sv.memoryMb > 0.9 ? 'red' : sv.runtime.metrics.ramMb / sv.memoryMb > 0.7 ? 'yellow' : 'green'}
                />
                <MetricItem
                  label="Players"
                  value={sv.runtime.status === 'running'
                    ? `${sv.runtime.metrics.playersOnline}/${sv.runtime.metrics.playersMax}`
                    : '—'}
                />
              </div>

              {sv.runtime.metrics.tps !== null && sv.runtime.status === 'running' && (
                <div className="mt-2 text-xs text-mc-muted">
                  TPS: <span className={sv.runtime.metrics.tps >= 19 ? 'text-mc-green' : sv.runtime.metrics.tps >= 15 ? 'text-yellow-400' : 'text-red-400'}>
                    {sv.runtime.metrics.tps.toFixed(1)}
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-mc-dark rounded p-2 text-center">
      <div className="text-xs text-mc-muted">{label}</div>
      <div className="text-sm font-medium text-gray-200 mt-0.5">{value}</div>
    </div>
  );
}

const BAR_COLORS = {
  green: 'bg-mc-green',
  yellow: 'bg-yellow-400',
  red: 'bg-red-500',
};

function BarMetricItem({ label, value, pct, color }: {
  label: string; value: string;
  pct: number | null; color: 'green' | 'yellow' | 'red';
}) {
  return (
    <div className="bg-mc-dark rounded p-2 text-center">
      <div className="text-xs text-mc-muted">{label}</div>
      <div className="text-sm font-medium text-gray-200 mt-0.5">{value}</div>
      <div className="mt-1.5 h-1 rounded-full bg-mc-border overflow-hidden">
        {pct !== null && (
          <div
            className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[color]}`}
            style={{ width: `${Math.min(pct * 100, 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}

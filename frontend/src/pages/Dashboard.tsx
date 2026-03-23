import { useNavigate } from 'react-router-dom';
import { Plus, Upload, Cpu, MemoryStick, Users, Server } from 'lucide-react';
import { useServersStore } from '../stores/serversStore';
import StatusBadge from '../components/StatusBadge';

export default function Dashboard() {
  const servers = useServersStore((s) => s.servers);
  const navigate = useNavigate();

  const running = servers.filter(s => s.runtime.status === 'running').length;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-100">Dashboard</h1>
          <p className="text-mc-muted text-sm mt-1">{running} of {servers.length} servers running</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => navigate('/servers/import')} className="btn-ghost text-sm">
            <Upload size={15} /> <span className="hidden sm:inline">Import Prism</span>
          </button>
          <button onClick={() => navigate('/servers/new')} className="btn-primary text-sm">
            <Plus size={15} /> New Server
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

      {/* Server cards */}
      {servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <span className="text-6xl mb-4">⛏</span>
          <h2 className="text-xl font-bold text-gray-300 mb-2">No servers yet</h2>
          <p className="text-mc-muted mb-6">Create a new server or import a Prism Launcher export to get started.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/servers/import')} className="btn-ghost">
              <Upload size={16} /> Import from Prism
            </button>
            <button onClick={() => navigate('/servers/new')} className="btn-primary">
              <Plus size={16} /> Create Server
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {servers.map((sv) => (
            <button
              key={sv.id}
              onClick={() => navigate(`/servers/${sv.id}`)}
              className="card p-5 text-left hover:border-mc-green/60 transition-colors group"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-gray-100 group-hover:text-mc-green transition-colors">{sv.name}</div>
                  <div className="text-xs text-mc-muted mt-0.5">{sv.type} · {sv.mcVersion} · :{sv.port}</div>
                </div>
                <StatusBadge status={sv.runtime.status} />
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <MetricItem
                  label="CPU"
                  value={sv.runtime.status === 'running' ? `${sv.runtime.metrics.cpuPercent.toFixed(1)}%` : '—'}
                />
                <MetricItem
                  label="RAM"
                  value={sv.runtime.status === 'running' ? `${sv.runtime.metrics.ramMb} MB` : '—'}
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

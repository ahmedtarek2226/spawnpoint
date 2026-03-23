import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldOff, LogOut, Ban, RotateCw, UserPlus, Users, Crown } from 'lucide-react';
import { api } from '../../api/client';

interface OpsEntry { uuid: string; name: string; level: number; }
interface WhitelistEntry { uuid: string; name: string; }
interface BannedEntry { uuid: string; name: string; reason: string; expires: string; }

interface PlayersData {
  online: string[];
  ops: OpsEntry[];
  whitelist: WhitelistEntry[];
  banned: BannedEntry[];
}

const OP_LEVELS: Record<number, string> = {
  1: 'Lv 1 — bypass spawn protection',
  2: 'Lv 2 — cheat commands',
  3: 'Lv 3 — kick & ban',
  4: 'Lv 4 — full operator',
};

export default function PlayersTab({ serverId, serverStatus }: { serverId: string; serverStatus: string }) {
  const [data, setData] = useState<PlayersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [addInput, setAddInput] = useState('');
  const [activeSection, setActiveSection] = useState<'online' | 'ops' | 'whitelist' | 'banned'>('online');

  const isRunning = serverStatus === 'running';

  const load = useCallback(async () => {
    try {
      const d = await api.get<PlayersData>(`/servers/${serverId}/players`);
      setData(d);
    } catch { /* empty */ }
    setLoading(false);
  }, [serverId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  async function doAction(action: string, username: string, extra?: Record<string, string>) {
    setBusy(`${action}:${username}`);
    setError('');
    try {
      await api.post(`/servers/${serverId}/players/${action}`, { username, ...extra });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setBusy(null);
    }
  }

  async function addToWhitelist() {
    const name = addInput.trim();
    if (!name) return;
    await doAction('whitelist', name, { action: 'add' });
    setAddInput('');
  }

  if (loading) return <div className="p-4 text-mc-muted text-sm">Loading…</div>;
  if (!data) return <div className="p-4 text-red-400 text-sm">Failed to load player data.</div>;

  const sections = [
    { key: 'online' as const, label: 'Online', count: data.online.length, icon: Users },
    { key: 'ops' as const, label: 'Operators', count: data.ops.length, icon: Crown },
    { key: 'whitelist' as const, label: 'Whitelist', count: data.whitelist.length, icon: UserPlus },
    { key: 'banned' as const, label: 'Banned', count: data.banned.length, icon: Ban },
  ];

  return (
    <div className="p-4 space-y-4">
      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
      )}

      {!isRunning && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 text-yellow-400 rounded px-3 py-2 text-xs">
          Server is offline — player actions require the server to be running. Ops and whitelist lists are read-only.
        </div>
      )}

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-mc-border pb-0">
        {sections.map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t transition-colors border-b-2 -mb-px ${
              activeSection === key
                ? 'border-mc-green text-mc-green bg-mc-green/5'
                : 'border-transparent text-mc-muted hover:text-gray-300'
            }`}
          >
            <Icon size={13} />
            {label}
            <span className={`text-xs px-1 rounded ${activeSection === key ? 'bg-mc-green/20 text-mc-green' : 'bg-mc-panel text-mc-muted'}`}>
              {count}
            </span>
          </button>
        ))}

        <button onClick={load} className="ml-auto btn-ghost p-1.5 mb-1" title="Refresh">
          <RotateCw size={13} />
        </button>
      </div>

      {/* Online players */}
      {activeSection === 'online' && (
        <div className="space-y-2">
          {data.online.length === 0 ? (
            <div className="card p-6 text-center text-mc-muted text-sm">
              <Users size={28} className="mx-auto mb-2 opacity-40" />
              No players online
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2">Player</th>
                    <th className="text-right px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.online.map((name) => {
                    const isOp = data.ops.some((o) => o.name.toLowerCase() === name.toLowerCase());
                    return (
                      <tr key={name} className="border-b border-mc-border/40 hover:bg-mc-panel/40">
                        <td className="px-4 py-2 flex items-center gap-2">
                          <span className="font-mono text-gray-200">{name}</span>
                          {isOp && <span className="text-xs text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">OP</span>}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {isOp ? (
                              <ActionButton
                                icon={ShieldOff} label="Deop" danger
                                disabled={!isRunning || busy === `deop:${name}`}
                                onClick={() => doAction('deop', name)}
                              />
                            ) : (
                              <ActionButton
                                icon={Shield} label="Op"
                                disabled={!isRunning || busy === `op:${name}`}
                                onClick={() => doAction('op', name)}
                              />
                            )}
                            <ActionButton
                              icon={LogOut} label="Kick" danger
                              disabled={!isRunning || busy === `kick:${name}`}
                              onClick={() => doAction('kick', name)}
                            />
                            <ActionButton
                              icon={Ban} label="Ban" danger
                              disabled={!isRunning || busy === `ban:${name}`}
                              onClick={() => {
                                const reason = prompt(`Ban reason for ${name} (optional):`);
                                if (reason === null) return;
                                doAction('ban', name, reason ? { reason } : {});
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Operators */}
      {activeSection === 'ops' && (
        <div className="space-y-3">
          <PlayerAddRow
            placeholder="Username to op…"
            buttonLabel="Op player"
            disabled={!isRunning}
            onAdd={(name) => doAction('op', name)}
          />
          {data.ops.length === 0 ? (
            <div className="card p-6 text-center text-mc-muted text-sm">No operators configured</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2">Player</th>
                    <th className="text-left px-4 py-2">Permission level</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.ops.map((op) => (
                    <tr key={op.uuid} className="border-b border-mc-border/40 hover:bg-mc-panel/40">
                      <td className="px-4 py-2 font-mono text-gray-200">{op.name}</td>
                      <td className="px-4 py-2 text-xs text-mc-muted">{OP_LEVELS[op.level] ?? `Level ${op.level}`}</td>
                      <td className="px-4 py-2 text-right">
                        <ActionButton
                          icon={ShieldOff} label="Deop" danger
                          disabled={!isRunning || busy === `deop:${op.name}`}
                          onClick={() => doAction('deop', op.name)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Whitelist */}
      {activeSection === 'whitelist' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Username to whitelist…"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
              disabled={!isRunning}
            />
            <button
              className="btn-primary text-xs"
              onClick={addToWhitelist}
              disabled={!isRunning || !addInput.trim()}
            >
              <UserPlus size={13} /> Add
            </button>
          </div>
          {data.whitelist.length === 0 ? (
            <div className="card p-6 text-center text-mc-muted text-sm">
              Whitelist is empty (or whitelist is disabled in server.properties)
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2">Player</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.whitelist.map((p) => (
                    <tr key={p.uuid} className="border-b border-mc-border/40 hover:bg-mc-panel/40">
                      <td className="px-4 py-2 font-mono text-gray-200">{p.name}</td>
                      <td className="px-4 py-2 text-right">
                        <ActionButton
                          icon={ShieldOff} label="Remove" danger
                          disabled={!isRunning || busy === `whitelist:${p.name}`}
                          onClick={() => doAction('whitelist', p.name, { action: 'remove' })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Banned players */}
      {activeSection === 'banned' && (
        <div className="space-y-3">
          {data.banned.length === 0 ? (
            <div className="card p-6 text-center text-mc-muted text-sm">No banned players</div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2">Player</th>
                    <th className="text-left px-4 py-2">Reason</th>
                    <th className="text-left px-4 py-2">Expires</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.banned.map((p) => (
                    <tr key={p.uuid} className="border-b border-mc-border/40 hover:bg-mc-panel/40">
                      <td className="px-4 py-2 font-mono text-gray-200">{p.name}</td>
                      <td className="px-4 py-2 text-xs text-mc-muted">{p.reason || '—'}</td>
                      <td className="px-4 py-2 text-xs text-mc-muted">{p.expires === 'forever' ? 'Permanent' : p.expires}</td>
                      <td className="px-4 py-2 text-right">
                        <ActionButton
                          icon={RotateCw} label="Pardon"
                          disabled={!isRunning || busy === `pardon:${p.name}`}
                          onClick={() => doAction('pardon', p.name)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon, label, onClick, disabled, danger,
}: {
  icon: React.ElementType; label: string; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? 'hover:bg-red-900/40 text-mc-muted hover:text-red-400'
          : 'hover:bg-mc-green/20 text-mc-muted hover:text-mc-green'
      }`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}

function PlayerAddRow({
  placeholder, buttonLabel, disabled, onAdd,
}: {
  placeholder: string; buttonLabel: string; disabled: boolean; onAdd: (name: string) => void;
}) {
  const [input, setInput] = useState('');
  function submit() {
    const name = input.trim();
    if (!name) return;
    onAdd(name);
    setInput('');
  }
  return (
    <div className="flex gap-2">
      <input
        className="input flex-1"
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        disabled={disabled}
      />
      <button className="btn-primary text-xs" onClick={submit} disabled={disabled || !input.trim()}>
        <Crown size={13} /> {buttonLabel}
      </button>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Shield, ShieldOff, LogOut, Ban, RotateCw, UserPlus, Users, Crown, History, AlertTriangle, X } from 'lucide-react';
import { api } from '../../api/client';

interface OpsEntry { uuid: string; name: string; level: number; }
interface WhitelistEntry { uuid: string; name: string; }
interface BannedEntry { uuid: string; name: string; reason: string; expires: string; }
interface UsercacheEntry { uuid: string; name: string; expiresOn: string; }

interface PlayersData {
  online: string[];
  ops: OpsEntry[];
  whitelist: WhitelistEntry[];
  banned: BannedEntry[];
  usercache: UsercacheEntry[];
}

const OP_LEVELS: Record<number, string> = {
  1: 'Bypass spawn protection',
  2: 'Cheat commands',
  3: 'Kick & ban',
  4: 'Full operator',
};

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className="rounded flex items-center justify-center bg-mc-border text-mc-muted text-[10px] font-bold flex-shrink-0"
        style={{ width: size, height: size }}
      >
        {name[0]?.toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`https://mc-heads.net/head/${encodeURIComponent(name)}/${size}`}
      alt={name}
      width={size}
      height={size}
      className="rounded flex-shrink-0"
      onError={() => setErr(true)}
    />
  );
}

function BanButton({ name, disabled, onBan }: { name: string; disabled: boolean; onBan: (reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (!open) {
    return (
      <ActionButton icon={Ban} label="Ban" danger disabled={disabled} onClick={() => setOpen(true)} />
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        className="input text-xs py-1 w-36"
        placeholder="Reason (optional)"
        value={reason}
        onChange={e => setReason(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') { onBan(reason); setOpen(false); setReason(''); }
          if (e.key === 'Escape') { setOpen(false); setReason(''); }
        }}
      />
      <button
        className="text-xs px-2 py-1 rounded bg-red-900/50 border border-red-700/50 text-red-400 hover:bg-red-900/80 transition-colors"
        onClick={() => { onBan(reason); setOpen(false); setReason(''); }}
      >
        Ban
      </button>
      <button className="text-mc-muted hover:text-gray-300 p-1 transition-colors" onClick={() => { setOpen(false); setReason(''); }}>
        <X size={11} />
      </button>
    </div>
  );
}

export default function PlayersTab({ serverId, serverStatus }: { serverId: string; serverStatus: string }) {
  const [data, setData] = useState<PlayersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [addInput, setAddInput] = useState('');
  const [activeSection, setActiveSection] = useState<'online' | 'ops' | 'whitelist' | 'banned' | 'known'>('online');

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

  if (loading) return <div className="p-6 text-mc-muted text-sm">Loading…</div>;
  if (!data) return <div className="p-6 text-red-400 text-sm">Failed to load player data.</div>;

  const sections = [
    { key: 'online' as const, label: 'Online', count: data.online.length, icon: Users, color: 'text-mc-green' },
    { key: 'ops' as const, label: 'Operators', count: data.ops.length, icon: Crown, color: 'text-yellow-400' },
    { key: 'whitelist' as const, label: 'Whitelist', count: data.whitelist.length, icon: UserPlus, color: 'text-blue-400' },
    { key: 'banned' as const, label: 'Banned', count: data.banned.length, icon: Ban, color: 'text-red-400' },
    { key: 'known' as const, label: 'Known', count: data.usercache.length, icon: History, color: 'text-mc-muted' },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Section nav */}
      <div className="border-b border-mc-border bg-mc-panel/30 px-3 flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-shrink-0">
        {sections.map(({ key, label, count, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs rounded-t border-b-2 transition-colors whitespace-nowrap flex-shrink-0 -mb-px ${
              activeSection === key
                ? 'border-mc-green text-mc-green bg-mc-green/5'
                : 'border-transparent text-mc-muted hover:text-gray-300'
            }`}
          >
            <Icon size={12} className={activeSection === key ? 'text-mc-green' : color} />
            {label}
            <span className={`min-w-[18px] text-center text-xs px-1 rounded ${activeSection === key ? 'bg-mc-green/20 text-mc-green' : 'bg-mc-dark text-mc-muted'}`}>
              {count}
            </span>
          </button>
        ))}
        <button onClick={load} className="ml-auto btn-ghost p-1.5 mb-1 flex-shrink-0" title="Refresh">
          <RotateCw size={12} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 text-red-400 rounded-lg px-3 py-2 text-sm flex items-center gap-2">
            <AlertTriangle size={13} className="flex-shrink-0" />
            {error}
          </div>
        )}

        {!isRunning && (
          <div className="bg-yellow-900/20 border border-yellow-700/40 text-yellow-400/80 rounded-lg px-3 py-2 text-xs flex items-center gap-2">
            <AlertTriangle size={12} className="flex-shrink-0" />
            Server is offline — player actions require the server to be running.
          </div>
        )}

        {/* Online players */}
        {activeSection === 'online' && (
          data.online.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users size={36} className="text-mc-muted opacity-30 mb-3" />
              <p className="text-sm text-mc-muted">{isRunning ? 'No players online' : 'Server is offline'}</p>
              {isRunning && <p className="text-xs text-mc-muted/60 mt-1">Players will appear here when they connect</p>}
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2.5">Player</th>
                    <th className="text-right px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.online.map((name) => {
                    const isOp = data.ops.some((o) => o.name.toLowerCase() === name.toLowerCase());
                    return (
                      <tr key={name} className="border-b border-mc-border/40 hover:bg-mc-panel/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={name} size={24} />
                            <span className="font-mono text-gray-200">{name}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-mc-green flex-shrink-0" />
                            {isOp && <span className="text-xs text-yellow-400 bg-yellow-900/30 border border-yellow-700/30 px-1.5 py-0.5 rounded">OP</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {isOp ? (
                              <ActionButton icon={ShieldOff} label="Deop" danger
                                disabled={!isRunning || busy === `deop:${name}`}
                                onClick={() => doAction('deop', name)} />
                            ) : (
                              <ActionButton icon={Shield} label="Op"
                                disabled={!isRunning || busy === `op:${name}`}
                                onClick={() => doAction('op', name)} />
                            )}
                            <ActionButton icon={LogOut} label="Kick" danger
                              disabled={!isRunning || busy === `kick:${name}`}
                              onClick={() => doAction('kick', name)} />
                            <BanButton name={name} disabled={!isRunning || !!busy}
                              onBan={(reason) => doAction('ban', name, reason ? { reason } : {})} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Operators */}
        {activeSection === 'ops' && (
          <>
            <PlayerAddRow
              placeholder="Username to op…"
              buttonLabel="Grant Op"
              buttonIcon={Crown}
              disabled={!isRunning}
              onAdd={(name) => doAction('op', name)}
            />
            {data.ops.length === 0 ? (
              <div className="card p-8 text-center text-mc-muted text-sm">
                <Crown size={28} className="mx-auto mb-2 opacity-30" />
                No operators configured
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                    <tr>
                      <th className="text-left px-4 py-2.5">Player</th>
                      <th className="text-left px-4 py-2.5">Level</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.ops.map((op) => (
                      <tr key={op.uuid} className="border-b border-mc-border/40 hover:bg-mc-panel/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={op.name} size={24} />
                            <span className="font-mono text-gray-200">{op.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-yellow-400/80 bg-yellow-900/20 border border-yellow-700/20 px-1.5 py-0.5 rounded">
                            {OP_LEVELS[op.level] ?? `Level ${op.level}`}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <ActionButton icon={ShieldOff} label="Deop" danger
                            disabled={!isRunning || busy === `deop:${op.name}`}
                            onClick={() => doAction('deop', op.name)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Whitelist */}
        {activeSection === 'whitelist' && (
          <>
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
              <div className="card p-8 text-center text-mc-muted text-sm">
                <UserPlus size={28} className="mx-auto mb-2 opacity-30" />
                Whitelist is empty or disabled in server.properties
              </div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                    <tr>
                      <th className="text-left px-4 py-2.5">Player</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.whitelist.map((p) => (
                      <tr key={p.uuid} className="border-b border-mc-border/40 hover:bg-mc-panel/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={p.name} size={24} />
                            <span className="font-mono text-gray-200">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <ActionButton icon={ShieldOff} label="Remove" danger
                            disabled={!isRunning || busy === `whitelist:${p.name}`}
                            onClick={() => doAction('whitelist', p.name, { action: 'remove' })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* Banned players */}
        {activeSection === 'banned' && (
          data.banned.length === 0 ? (
            <div className="card p-8 text-center text-mc-muted text-sm">
              <Ban size={28} className="mx-auto mb-2 opacity-30" />
              No banned players
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2.5">Player</th>
                    <th className="text-left px-4 py-2.5">Reason</th>
                    <th className="text-left px-4 py-2.5 hidden sm:table-cell">Expires</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {data.banned.map((p) => (
                    <tr key={p.uuid} className="border-b border-mc-border/40 hover:bg-mc-panel/40 transition-colors">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={p.name} size={24} />
                          <span className="font-mono text-gray-200">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-mc-muted">{p.reason || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-mc-muted hidden sm:table-cell">
                        {p.expires === 'forever' ? (
                          <span className="text-red-400/70">Permanent</span>
                        ) : p.expires}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <ActionButton icon={RotateCw} label="Pardon"
                          disabled={!isRunning || busy === `pardon:${p.name}`}
                          onClick={() => doAction('pardon', p.name)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Known players (usercache) */}
        {activeSection === 'known' && (
          data.usercache.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <History size={36} className="text-mc-muted opacity-30 mb-3" />
              <p className="text-sm text-mc-muted">No players have joined yet</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-xs text-mc-muted border-b border-mc-border bg-mc-panel/60">
                  <tr>
                    <th className="text-left px-4 py-2.5">Player</th>
                    <th className="text-left px-4 py-2.5 hidden sm:table-cell">UUID</th>
                    <th className="text-right px-4 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.usercache.map((p) => {
                    const isOnline = data.online.some((n) => n.toLowerCase() === p.name.toLowerCase());
                    const isOp = data.ops.some((o) => o.name.toLowerCase() === p.name.toLowerCase());
                    const isBanned = data.banned.some((b) => b.name.toLowerCase() === p.name.toLowerCase());
                    return (
                      <tr key={p.uuid} className="border-b border-mc-border/40 hover:bg-mc-panel/40 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <Avatar name={p.name} size={24} />
                            <span className="font-mono text-gray-200">{p.name}</span>
                            {isOnline && <span className="text-xs text-mc-green bg-mc-green/20 border border-mc-green/20 px-1.5 py-0.5 rounded">Online</span>}
                            {isOp && <span className="text-xs text-yellow-400 bg-yellow-900/30 border border-yellow-700/30 px-1.5 py-0.5 rounded">OP</span>}
                            {isBanned && <span className="text-xs text-red-400/70 bg-red-900/20 border border-red-700/20 px-1.5 py-0.5 rounded">Banned</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-mc-muted font-mono hidden sm:table-cell truncate max-w-40">{p.uuid}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            {isOp ? (
                              <ActionButton icon={ShieldOff} label="Deop" danger
                                disabled={!isRunning || busy === `deop:${p.name}`}
                                onClick={() => doAction('deop', p.name)} />
                            ) : (
                              <ActionButton icon={Shield} label="Op"
                                disabled={!isRunning || busy === `op:${p.name}`}
                                onClick={() => doAction('op', p.name)} />
                            )}
                            {isBanned ? (
                              <ActionButton icon={RotateCw} label="Pardon"
                                disabled={!isRunning || busy === `pardon:${p.name}`}
                                onClick={() => doAction('pardon', p.name)} />
                            ) : (
                              <BanButton name={p.name} disabled={!isRunning || !!busy}
                                onBan={(reason) => doAction('ban', p.name, reason ? { reason } : {})} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
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
  placeholder, buttonLabel, buttonIcon: ButtonIcon, disabled, onAdd,
}: {
  placeholder: string; buttonLabel: string; buttonIcon: React.ElementType; disabled: boolean; onAdd: (name: string) => void;
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
        <ButtonIcon size={13} /> {buttonLabel}
      </button>
    </div>
  );
}

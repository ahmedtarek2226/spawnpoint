import { useState, useEffect, useRef } from 'react';
import { Send, Copy, Check, Trash2, Star, X, Download, Search, ChevronRight, BookOpen } from 'lucide-react';
import { useConsole } from '../../hooks/useServerSocket';
import { useServersStore } from '../../stores/serversStore';
import { api } from '../../api/client';

interface Line { text: string; ts: number; sent?: boolean; }

interface McCommand {
  cmd: string;
  syntax: string;
  description: string;
}
interface CommandCategory {
  label: string;
  commands: McCommand[];
}

const COMMAND_CATEGORIES: CommandCategory[] = [
  {
    label: 'Server',
    commands: [
      { cmd: 'list',      syntax: 'list',                description: 'Show all online players.' },
      { cmd: 'say',       syntax: 'say <message>',        description: 'Broadcast a message to all players.' },
      { cmd: 'me',        syntax: 'me <action>',          description: 'Broadcast an action in third person.' },
      { cmd: 'seed',      syntax: 'seed',                 description: 'Display the world seed.' },
      { cmd: 'save-all',  syntax: 'save-all',             description: 'Force-save all chunks to disk.' },
      { cmd: 'save-on',   syntax: 'save-on',              description: 'Re-enable automatic world saving.' },
      { cmd: 'save-off',  syntax: 'save-off',             description: 'Disable automatic world saving.' },
      { cmd: 'reload',    syntax: 'reload',               description: 'Reload datapacks without restarting.' },
      { cmd: 'stop',      syntax: 'stop',                 description: 'Gracefully stop the server.' },
    ],
  },
  {
    label: 'Players',
    commands: [
      { cmd: 'op',         syntax: 'op <player>',                  description: 'Grant operator (admin) status.' },
      { cmd: 'deop',       syntax: 'deop <player>',                description: 'Revoke operator status.' },
      { cmd: 'kick',       syntax: 'kick <player> [reason]',       description: 'Kick a player from the server.' },
      { cmd: 'ban',        syntax: 'ban <player> [reason]',        description: 'Permanently ban a player by name.' },
      { cmd: 'ban-ip',     syntax: 'ban-ip <player|ip> [reason]',  description: 'Ban a player or IP address.' },
      { cmd: 'pardon',     syntax: 'pardon <player>',              description: 'Unban a previously banned player.' },
      { cmd: 'pardon-ip',  syntax: 'pardon-ip <ip>',               description: 'Unban a previously banned IP.' },
      { cmd: 'banlist',    syntax: 'banlist [ips]',                description: 'List banned players or IPs.' },
      { cmd: 'tp',         syntax: 'tp <player> <target|x y z>',  description: 'Teleport a player to another player or coordinates.' },
      { cmd: 'gamemode',   syntax: 'gamemode <mode> [player]',     description: 'Set game mode: survival, creative, adventure, spectator.' },
      { cmd: 'give',       syntax: 'give <player> <item> [count]', description: 'Give an item to a player.' },
      { cmd: 'clear',      syntax: 'clear [player]',               description: "Clear a player's inventory." },
      { cmd: 'xp',         syntax: 'xp add <player> <amount> [points|levels]', description: 'Add experience points or levels to a player.' },
      { cmd: 'heal',       syntax: 'effect give <player> minecraft:instant_health 1 255', description: 'Instantly heal a player to full health.' },
      { cmd: 'kill',       syntax: 'kill <player>',                description: 'Kill a player (they respawn).' },
    ],
  },
  {
    label: 'Whitelist',
    commands: [
      { cmd: 'whitelist on',     syntax: 'whitelist on',              description: 'Enable the whitelist (only listed players can join).' },
      { cmd: 'whitelist off',    syntax: 'whitelist off',             description: 'Disable the whitelist.' },
      { cmd: 'whitelist add',    syntax: 'whitelist add <player>',    description: 'Add a player to the whitelist.' },
      { cmd: 'whitelist remove', syntax: 'whitelist remove <player>', description: 'Remove a player from the whitelist.' },
      { cmd: 'whitelist list',   syntax: 'whitelist list',            description: 'List all whitelisted players.' },
      { cmd: 'whitelist reload', syntax: 'whitelist reload',          description: 'Reload the whitelist from disk.' },
    ],
  },
  {
    label: 'World',
    commands: [
      { cmd: 'time set day',     syntax: 'time set day',            description: 'Set the time to day (1000).' },
      { cmd: 'time set noon',    syntax: 'time set noon',           description: 'Set the time to noon (6000).' },
      { cmd: 'time set night',   syntax: 'time set night',          description: 'Set the time to night (13000).' },
      { cmd: 'time set midnight',syntax: 'time set midnight',       description: 'Set the time to midnight (18000).' },
      { cmd: 'time add',         syntax: 'time add <amount>',       description: 'Add ticks to the current world time.' },
      { cmd: 'weather clear',    syntax: 'weather clear [duration]',description: 'Set clear weather.' },
      { cmd: 'weather rain',     syntax: 'weather rain [duration]', description: 'Start rain.' },
      { cmd: 'weather thunder',  syntax: 'weather thunder [duration]', description: 'Start a thunderstorm.' },
      { cmd: 'difficulty',       syntax: 'difficulty <peaceful|easy|normal|hard>', description: 'Set the server difficulty.' },
      { cmd: 'gamerule',         syntax: 'gamerule <rule> <value>', description: 'Set or query a game rule (e.g. keepInventory true).' },
      { cmd: 'setworldspawn',    syntax: 'setworldspawn [x y z]',  description: 'Set the world spawn point.' },
      { cmd: 'summon',           syntax: 'summon <entity> [x y z]',description: 'Spawn an entity at a location.' },
      { cmd: 'fill',             syntax: 'fill <x1 y1 z1> <x2 y2 z2> <block>', description: 'Fill a region with a block.' },
      { cmd: 'clone',            syntax: 'clone <x1 y1 z1> <x2 y2 z2> <dx dy dz>', description: 'Copy blocks from one region to another.' },
    ],
  },
  {
    label: 'Gamerules',
    commands: [
      { cmd: 'gamerule keepInventory',      syntax: 'gamerule keepInventory <true|false>',      description: 'Keep inventory on death.' },
      { cmd: 'gamerule doDaylightCycle',    syntax: 'gamerule doDaylightCycle <true|false>',    description: 'Toggle the day/night cycle.' },
      { cmd: 'gamerule doWeatherCycle',     syntax: 'gamerule doWeatherCycle <true|false>',     description: 'Toggle weather changes.' },
      { cmd: 'gamerule doMobSpawning',      syntax: 'gamerule doMobSpawning <true|false>',      description: 'Toggle natural mob spawning.' },
      { cmd: 'gamerule doFireTick',         syntax: 'gamerule doFireTick <true|false>',         description: 'Toggle fire spreading.' },
      { cmd: 'gamerule mobGriefing',        syntax: 'gamerule mobGriefing <true|false>',        description: 'Toggle mob block interactions (creeper explosions, etc.).' },
      { cmd: 'gamerule pvp',                syntax: 'gamerule pvp <true|false>',                description: 'Toggle player vs player damage (Paper/Spigot only).' },
      { cmd: 'gamerule naturalRegeneration',syntax: 'gamerule naturalRegeneration <true|false>',description: 'Toggle natural health regeneration.' },
      { cmd: 'gamerule announceAdvancements',syntax: 'gamerule announceAdvancements <true|false>',description: 'Announce advancements in chat.' },
      { cmd: 'gamerule commandBlockOutput', syntax: 'gamerule commandBlockOutput <true|false>', description: 'Show command block output in chat.' },
      { cmd: 'gamerule logAdminCommands',   syntax: 'gamerule logAdminCommands <true|false>',   description: 'Log admin commands to chat.' },
      { cmd: 'gamerule randomTickSpeed',    syntax: 'gamerule randomTickSpeed <value>',         description: 'Set random tick speed (default 3).' },
      { cmd: 'gamerule spawnRadius',        syntax: 'gamerule spawnRadius <value>',             description: 'Set the spawn radius around the world spawn.' },
    ],
  },
];

function CommandsModal({ onClose, onUse }: { onClose: () => void; onUse: (cmd: string) => void }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(COMMAND_CATEGORIES[0].label);

  const q = search.toLowerCase();
  const filtered: CommandCategory[] = q
    ? COMMAND_CATEGORIES.map(cat => ({
        ...cat,
        commands: cat.commands.filter(c =>
          c.cmd.toLowerCase().includes(q) ||
          c.syntax.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
        ),
      })).filter(cat => cat.commands.length > 0)
    : COMMAND_CATEGORIES;

  const displayCategory = q ? null : filtered.find(c => c.label === activeCategory) ?? filtered[0];
  const displayCommands = q
    ? filtered.flatMap(c => c.commands)
    : (displayCategory?.commands ?? []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 bg-mc-panel border border-mc-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-mc-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen size={15} className="text-mc-green" />
            <span className="font-semibold text-sm text-gray-100">Command Reference</span>
          </div>
          <button onClick={onClose} className="text-mc-muted hover:text-gray-200 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2.5 border-b border-mc-border flex-shrink-0">
          <div className="flex items-center gap-2 bg-mc-dark border border-mc-border rounded px-3 py-1.5">
            <Search size={12} className="text-mc-muted flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search commands…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && (search ? setSearch('') : onClose())}
              className="flex-1 bg-transparent text-xs text-gray-200 placeholder-mc-muted outline-none font-mono"
            />
            {search && <button onClick={() => setSearch('')} className="text-mc-muted hover:text-gray-300 transition-colors"><X size={11} /></button>}
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Category sidebar */}
          {!q && (
            <div className="w-32 flex-shrink-0 border-r border-mc-border p-2 flex flex-col gap-0.5 overflow-y-auto">
              {COMMAND_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => setActiveCategory(cat.label)}
                  className={`text-left px-2.5 py-1.5 rounded text-xs transition-all duration-100 ${
                    activeCategory === cat.label
                      ? 'bg-mc-green/15 text-mc-green font-medium'
                      : 'text-mc-muted hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  {cat.label}
                  <span className="ml-1 opacity-50">{cat.commands.length}</span>
                </button>
              ))}
            </div>
          )}

          {/* Commands list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {q && (
              <p className="text-xs text-mc-muted font-mono px-1 pb-1">
                {displayCommands.length} result{displayCommands.length !== 1 ? 's' : ''}
              </p>
            )}
            {displayCommands.map((c) => (
              <button
                key={c.syntax}
                onClick={() => { onUse(c.syntax); onClose(); }}
                className="w-full text-left px-3 py-2.5 rounded border border-mc-border hover:border-mc-green/40 hover:bg-mc-green/5 transition-all duration-100 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <code className="text-xs text-mc-green font-mono leading-snug group-hover:text-mc-green break-all">
                    {c.syntax}
                  </code>
                  <span className="text-xs text-mc-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                    use ↵
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{c.description}</p>
              </button>
            ))}
            {displayCommands.length === 0 && (
              <p className="text-xs text-mc-muted font-mono px-1 py-4 text-center">No commands found</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function colorize(line: string): string {
  const escaped = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/\[(\w+\s*\/\s*INFO)\]/g, '<span class="text-gray-400">[$1]</span>')
    .replace(/\[(\w+\s*\/\s*WARN)\]/g, '<span class="text-yellow-400">[$1]</span>')
    .replace(/\[(\w+\s*\/\s*ERROR)\]/g, '<span class="text-red-400">[$1]</span>')
    .replace(/(Done \([^)]+\)! For help.*)/g, '<span class="text-mc-green">$1</span>')
    .replace(/(Stopping the server)/g, '<span class="text-orange-400">$1</span>');
}

export default function ConsoleTab({ serverId }: { serverId: string }) {
  const [lines, setLines] = useState<Line[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`console_buf_${serverId}`) ?? '[]');
    } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`console_history_${serverId}`) ?? '[]'); } catch { return []; }
  });
  const [histIdx, setHistIdx] = useState(-1);
  const [favourites, setFavourites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`console_favourites_${serverId}`) ?? '[]'); } catch { return []; }
  });
  const [copied, setCopied] = useState(false);
  const [cmdError, setCmdError] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [cmdRefOpen, setCmdRefOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const status = useServersStore((s) => s.servers.find((sv) => sv.id === serverId)?.runtime.status);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(`console_buf_${serverId}`, JSON.stringify(lines.slice(-200)));
      } catch { /* quota exceeded */ }
    }, 2000);
    return () => clearTimeout(t);
  }, [lines, serverId]);

  useEffect(() => {
    if (status === 'starting') setLines([]);
  }, [status]);

  useEffect(() => {
    api.get<string[]>(`/servers/${serverId}/console/history?lines=500`).then((data) => {
      // Don't overwrite a fresh start with stale history
      if (useServersStore.getState().servers.find((sv) => sv.id === serverId)?.runtime.status === 'starting') return;
      setLines(data.map((text) => ({ text, ts: Date.now() })));
    }).catch(console.error);
  }, [serverId]);

  useConsole(serverId, (line, ts) => {
    setLines((prev) => {
      const next = [...prev, { text: line, ts }];
      return next.length > 1000 ? next.slice(-1000) : next;
    });
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function clearConsole() { setLines([]); }

  function downloadLog() {
    const text = lines.map((l) => l.text).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-${serverId}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function copyAll() {
    const text = lines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function sendCommand() {
    const cmd = input.trim();
    if (!cmd) return;
    setInput('');
    setHistIdx(-1);
    setCmdError('');
    setHistory((h) => {
      const next = [cmd, ...h.filter((c) => c !== cmd).slice(0, 99)];
      localStorage.setItem(`console_history_${serverId}`, JSON.stringify(next));
      return next;
    });
    setLines((prev) => {
      const next = [...prev, { text: `> ${cmd}`, ts: Date.now(), sent: true }];
      return next.length > 1000 ? next.slice(-1000) : next;
    });
    try {
      await api.post(`/servers/${serverId}/console/command`, { command: cmd });
    } catch (err: unknown) {
      setCmdError(err instanceof Error ? err.message : 'Command failed');
    }
  }

  function toggleFavourite(cmd: string) {
    setFavourites((prev) => {
      const next = prev.includes(cmd) ? prev.filter((c) => c !== cmd) : [...prev, cmd];
      localStorage.setItem(`console_favourites_${serverId}`, JSON.stringify(next));
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { sendCommand(); return; }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx]);
    }
  }

  const q = search.toLowerCase();
  const visibleLines = q ? lines.filter((l) => l.text.toLowerCase().includes(q)) : lines;

  return (
    <div className="flex flex-col h-full bg-mc-dark">
      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 border-b border-mc-border px-3 py-2 bg-mc-panel/80 backdrop-blur-sm">
          <Search size={12} className="text-mc-green flex-shrink-0" />
          <input
            autoFocus
            className="flex-1 bg-transparent text-xs font-mono text-gray-200 outline-none placeholder-mc-muted"
            placeholder="Filter output…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (setSearchOpen(false), setSearch(''))}
          />
          {search && (
            <span className="text-xs text-mc-muted flex-shrink-0 font-mono">
              {visibleLines.length}/{lines.length}
            </span>
          )}
          <button onClick={() => { setSearchOpen(false); setSearch(''); }} className="text-mc-muted hover:text-gray-300 transition-colors">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Output area */}
      <div
        className="flex-1 overflow-y-auto p-3 md:p-4 font-mono text-xs leading-relaxed space-y-0.5"
        onClick={() => inputRef.current?.focus()}
      >
        {visibleLines.length === 0 && !q && (
          <div className="flex items-center justify-center h-full">
            <p className="text-mc-muted text-xs opacity-50">No console output yet</p>
          </div>
        )}
        {visibleLines.map((l, i) => (
          l.sent
            ? <div key={i} className="text-mc-green whitespace-pre-wrap break-all opacity-80">{l.text}</div>
            : <div key={i} className="text-gray-300 whitespace-pre-wrap break-all" dangerouslySetInnerHTML={{ __html: colorize(l.text) }} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Command error */}
      {cmdError && (
        <div className="border-t border-mc-border px-3 py-2 text-xs text-red-400 bg-red-900/20 flex items-center justify-between">
          <span>{cmdError}</span>
          <button onClick={() => setCmdError('')} className="ml-2 text-red-400 hover:text-red-300 transition-colors"><X size={11} /></button>
        </div>
      )}

      {/* Favourites chips */}
      {favourites.length > 0 && (
        <div className="border-t border-mc-border px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-mc-panel/30">
          <Star size={11} className="text-yellow-400 flex-shrink-0" />
          {favourites.map((fav) => (
            <div key={fav} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => setInput(fav)}
                className="font-mono text-xs bg-mc-dark border border-mc-border hover:border-mc-green text-gray-300 hover:text-mc-green rounded px-2 py-0.5 transition-colors"
              >
                {fav}
              </button>
              <button
                onClick={() => toggleFavourite(fav)}
                className="text-mc-muted hover:text-red-400 p-0.5 transition-colors"
                title="Remove favourite"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input toolbar */}
      <div className="border-t-2 border-mc-green/20 bg-mc-panel/50">
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-mc-border/40">
          <button onClick={clearConsole} className="btn-ghost p-1.5" title="Clear console">
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => { setSearchOpen((o) => !o); if (searchOpen) setSearch(''); }}
            className={`btn-ghost p-1.5 transition-colors ${searchOpen ? 'text-mc-green bg-mc-green/10' : ''}`}
            title="Search output (Ctrl+F)"
          >
            <Search size={13} />
          </button>
          <button onClick={downloadLog} className="btn-ghost p-1.5" title="Download log">
            <Download size={13} />
          </button>
          <button onClick={copyAll} className="btn-ghost p-1.5" title="Copy all output">
            {copied ? <Check size={13} className="text-mc-green" /> : <Copy size={13} />}
          </button>
          <button
            onClick={() => setCmdRefOpen(true)}
            className={`btn-ghost p-1.5 transition-colors ${cmdRefOpen ? 'text-mc-green bg-mc-green/10' : ''}`}
            title="Command reference"
          >
            <BookOpen size={13} />
          </button>
          <div className="flex-1" />
          <span className="text-xs text-mc-muted font-mono opacity-40 pr-1">
            {lines.length > 0 ? `${lines.length} lines` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <ChevronRight size={14} className="text-mc-green flex-shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm font-mono text-gray-100 outline-none placeholder-mc-muted"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Enter command…"
            autoFocus
          />
          <button
            onClick={() => input.trim() && toggleFavourite(input.trim())}
            className={`btn-ghost p-1.5 transition-colors ${favourites.includes(input.trim()) ? 'text-yellow-400' : ''}`}
            title={favourites.includes(input.trim()) ? 'Remove from favourites' : 'Add to favourites'}
            disabled={!input.trim()}
          >
            <Star size={13} />
          </button>
          <button
            onClick={sendCommand}
            className={`p-1.5 rounded transition-colors ${input.trim() ? 'text-mc-green hover:bg-mc-green/10' : 'text-mc-muted cursor-not-allowed'}`}
            disabled={!input.trim()}
            title="Send command (Enter)"
          >
            <Send size={13} />
          </button>
        </div>
      </div>

      {cmdRefOpen && (
        <CommandsModal
          onClose={() => setCmdRefOpen(false)}
          onUse={(cmd) => { setInput(cmd); setCmdRefOpen(false); inputRef.current?.focus(); }}
        />
      )}
    </div>
  );
}

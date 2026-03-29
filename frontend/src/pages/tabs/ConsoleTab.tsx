import { useState, useEffect, useRef } from 'react';
import { Send, Copy, Check, Trash2, Star, X, Download, Search, ChevronRight } from 'lucide-react';
import { useConsole } from '../../hooks/useServerSocket';
import { useServersStore } from '../../stores/serversStore';
import { api } from '../../api/client';

interface Line { text: string; ts: number; sent?: boolean; }

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
    </div>
  );
}

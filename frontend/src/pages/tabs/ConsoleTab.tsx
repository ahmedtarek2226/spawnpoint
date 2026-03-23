import { useState, useEffect, useRef } from 'react';
import { Send, Copy, Check } from 'lucide-react';
import { useConsole, sendWs } from '../../hooks/useServerSocket';
import { api } from '../../api/client';

interface Line { text: string; ts: number; }

function colorize(line: string): string {
  return line
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\[(\w+\s*\/\s*INFO)\]/g, '<span class="text-gray-400">[$1]</span>')
    .replace(/\[(\w+\s*\/\s*WARN)\]/g, '<span class="text-yellow-400">[$1]</span>')
    .replace(/\[(\w+\s*\/\s*ERROR)\]/g, '<span class="text-red-400">[$1]</span>')
    .replace(/(Done \([^)]+\)! For help.*)/g, '<span class="text-mc-green">$1</span>')
    .replace(/(Stopping the server)/g, '<span class="text-orange-400">$1</span>');
}

export default function ConsoleTab({ serverId }: { serverId: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load history on mount
  useEffect(() => {
    api.get<string[]>(`/servers/${serverId}/console/history?lines=500`).then((data) => {
      setLines(data.map((text) => ({ text, ts: Date.now() })));
    }).catch(console.error);
  }, [serverId]);

  useConsole(serverId, (line, ts) => {
    setLines((prev) => {
      const next = [...prev, { text: line, ts }];
      return next.length > 1000 ? next.slice(-1000) : next;
    });
  });

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  function copyAll() {
    const text = lines.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function sendCommand() {
    const cmd = input.trim();
    if (!cmd) return;
    sendWs({ type: 'console_command', serverId, command: cmd });
    setHistory((h) => [cmd, ...h.slice(0, 99)]);
    setHistIdx(-1);
    setInput('');
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

  return (
    <div className="flex flex-col h-full bg-mc-dark">
      {/* Output */}
      <div
        className="flex-1 overflow-y-auto p-4 font-mono text-xs leading-relaxed space-y-0.5"
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className="text-gray-300 whitespace-pre-wrap break-all"
            dangerouslySetInnerHTML={{ __html: colorize(l.text) }}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-mc-border p-3 flex gap-2">
        <button onClick={copyAll} className="btn-ghost p-1.5" title="Copy all output">
          {copied ? <Check size={14} className="text-mc-green" /> : <Copy size={14} />}
        </button>
        <span className="text-mc-green font-mono text-sm self-center">&gt;</span>
        <input
          ref={inputRef}
          className="flex-1 bg-transparent text-sm font-mono text-gray-100 outline-none placeholder-mc-muted"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter command…"
          autoFocus
        />
        <button onClick={sendCommand} className="btn-ghost p-1.5" disabled={!input.trim()}>
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}

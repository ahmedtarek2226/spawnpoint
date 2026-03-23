import { useState } from 'react';
import { AlertTriangle, Wrench, RotateCw, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../api/client';
import type { CrashIssue } from '../stores/serversStore';

const ISSUE_ICONS: Record<CrashIssue['type'], string> = {
  client_only_mod: '🧩',
  java_version: '☕',
  out_of_memory: '💾',
  unknown: '❓',
};

interface Props {
  serverId: string;
  issues: CrashIssue[];
  onFixed: () => void;
}

export default function CrashBanner({ serverId, issues, onFixed }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [fixing, setFixing] = useState(false);
  const [fixError, setFixError] = useState('');

  const fixable = issues.some((i) => i.fixable);

  async function fixAndRestart() {
    setFixing(true);
    setFixError('');
    try {
      await api.post(`/servers/${serverId}/fix-crash`);
      await api.post(`/servers/${serverId}/start`);
      onFixed();
    } catch (err: unknown) {
      setFixError(err instanceof Error ? err.message : 'Fix failed');
    } finally {
      setFixing(false);
    }
  }

  return (
    <div className="mx-4 mt-3 rounded-lg border border-red-700/60 bg-red-950/40 overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-red-900/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
        <span className="font-medium text-red-300 text-sm flex-1">
          Crash detected — {issues.length} issue{issues.length !== 1 ? 's' : ''} found
        </span>
        {expanded ? <ChevronUp size={14} className="text-mc-muted" /> : <ChevronDown size={14} className="text-mc-muted" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-2">
            {issues.map((issue, i) => (
              <div key={i} className="flex gap-2 items-start text-sm">
                <span className="text-base leading-none mt-0.5">{ISSUE_ICONS[issue.type]}</span>
                <div>
                  <span className="text-gray-200">{issue.message}</span>
                  {issue.type === 'client_only_mod' && issue.modFile && (
                    <div className="text-xs text-mc-muted font-mono mt-0.5">{issue.modFile}</div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {fixError && (
            <div className="text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-2 py-1">{fixError}</div>
          )}

          {fixable && (
            <button
              onClick={fixAndRestart}
              disabled={fixing}
              className="flex items-center gap-1.5 btn-primary text-xs py-1.5 px-3"
            >
              {fixing ? (
                <><RotateCw size={13} className="animate-spin" /> Fixing…</>
              ) : (
                <><Wrench size={13} /> Remove client-only mods &amp; restart</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

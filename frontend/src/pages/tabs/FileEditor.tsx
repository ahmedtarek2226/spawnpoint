import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Save, X } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { keymap } from '@codemirror/view';
import { api } from '../../api/client';

function getExtensions(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const exts = [oneDark];
  if (ext === 'json') exts.push(json());
  else if (ext === 'yaml' || ext === 'yml') exts.push(yaml());
  else if (ext === 'toml') exts.push(StreamLanguage.define(toml));
  else if (['properties', 'cfg', 'conf', 'ini'].includes(ext)) exts.push(StreamLanguage.define(properties));
  return exts;
}

export default function FileEditor({
  serverId,
  editPath,
  onClose,
}: {
  serverId: string;
  editPath: string;
  onClose: () => void;
}) {
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDirty = content !== savedContent;
  const filename = editPath.split('/').pop() ?? editPath;

  useEffect(() => {
    setLoading(true);
    api.get<string>(`/servers/${serverId}/files/content?path=${encodeURIComponent(editPath)}`)
      .then((c) => { setContent(c); setSavedContent(c); })
      .catch(() => setSaveError('Failed to load file'))
      .finally(() => setLoading(false));
  }, [serverId, editPath]);

  async function save() {
    setSaving(true);
    setSaveError('');
    try {
      await api.put(`/servers/${serverId}/files/content`, { path: editPath, content });
      setSavedContent(content);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  function close() {
    if (isDirty && !confirmClose) { setConfirmClose(true); return; }
    setConfirmClose(false);
    onClose();
  }

  const saveKeymap = keymap.of([{ key: 'Mod-s', run: () => { save(); return true; } }]);

  if (loading) return <div className="p-6 text-mc-muted text-sm">Loading…</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mc-border bg-mc-panel flex-shrink-0">
        {confirmClose ? (
          <>
            <span className="text-xs text-yellow-400">Discard unsaved changes?</span>
            <button onClick={close} className="text-xs text-red-400 hover:text-red-300 px-1.5 py-0.5 rounded border border-red-700/50 hover:bg-red-900/30 transition-colors">
              Discard
            </button>
            <button onClick={() => setConfirmClose(false)} className="text-mc-muted hover:text-gray-300 p-1 transition-colors">
              <X size={11} />
            </button>
            <div className="flex-1" />
          </>
        ) : (
          <>
            <button onClick={close} className="btn-ghost py-1 px-2 text-xs">
              <ArrowLeft size={13} /> Files
            </button>
            <span className="text-mc-muted text-xs">/</span>
            <span className="font-mono text-xs text-gray-300 truncate flex-1">
              {editPath}
              {isDirty && <span className="text-yellow-400 ml-1">●</span>}
            </span>
          </>
        )}
        {saveError && <span className="text-red-400 text-xs truncate max-w-48">{saveError}</span>}
        <a
          href={`/api/servers/${serverId}/files/download?path=${encodeURIComponent(editPath)}`}
          download
          className="btn-ghost py-1 px-2 text-xs flex-shrink-0"
          title="Download file"
        >
          <Download size={13} />
        </a>
        <button
          onClick={save}
          className="btn-primary py-1 px-3 text-xs flex-shrink-0"
          disabled={saving || !isDirty}
          title="Save (Ctrl+S / Cmd+S)"
        >
          <Save size={13} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          onChange={setContent}
          extensions={[...getExtensions(filename), saveKeymap]}
          theme={oneDark}
          height="100%"
          style={{ height: '100%', fontSize: '13px' }}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            autocompletion: true,
            bracketMatching: true,
            closeBrackets: true,
            indentOnInput: true,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
}

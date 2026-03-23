import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Folder, FileText, ChevronRight, Upload, Trash2, Download,
  ArrowLeft, Save, Plus, FolderPlus, RefreshCw, FilePen,
} from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { oneDark } from '@codemirror/theme-one-dark';
import { json } from '@codemirror/lang-json';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { keymap } from '@codemirror/view';
import { api, uploadFiles } from '../../api/client';

interface Entry { name: string; path: string; isDir: boolean; size: number; mtime: string; }

const TEXT_EXTENSIONS = new Set([
  'txt','log','md','json','yaml','yml','toml','properties','cfg','conf',
  'ini','xml','html','css','js','ts','sh','bat','cmd','py','java','kt',
  'gradle','xml','nbt','snbt','mcfunction','mcmeta','lang',
]);

function isTextFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return TEXT_EXTENSIONS.has(ext);
}

function getExtensions(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const exts = [oneDark];
  if (ext === 'json') exts.push(json());
  else if (ext === 'yaml' || ext === 'yml') exts.push(yaml());
  else if (ext === 'toml') exts.push(StreamLanguage.define(toml));
  else if (['properties', 'cfg', 'conf', 'ini'].includes(ext)) exts.push(StreamLanguage.define(properties));
  return exts;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function FilesTab({ serverId }: { serverId: string }) {
  const [dirPath, setDirPath] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [dirError, setDirError] = useState('');

  // Editor state
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Create file/folder
  const [creating, setCreating] = useState<'file' | 'folder' | null>(null);
  const [createName, setCreateName] = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);

  // Rename
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Upload conflict modal
  const [conflictModal, setConflictModal] = useState<{ conflicts: string[]; pending: File[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDirty = editContent !== savedContent;

  const loadDir = useCallback(async (p: string) => {
    setLoading(true);
    setDirError('');
    try {
      const data = await api.get<Entry[]>(`/servers/${serverId}/files?path=${encodeURIComponent(p)}`);
      setEntries(data);
      setDirPath(p);
    } catch (e: unknown) {
      setDirError(e instanceof Error ? e.message : 'Failed to load directory');
    }
    setLoading(false);
  }, [serverId]);

  useEffect(() => { loadDir(''); }, [loadDir]);

  // Focus create input when it appears
  useEffect(() => {
    if (creating) setTimeout(() => createInputRef.current?.focus(), 0);
  }, [creating]);

  // Focus rename input when it appears
  useEffect(() => {
    if (renamingPath) setTimeout(() => renameInputRef.current?.focus(), 0);
  }, [renamingPath]);

  async function openFile(entry: Entry) {
    if (entry.isDir) { loadDir(entry.path); return; }
    if (!isTextFile(entry.name)) {
      // Offer download for binary files
      window.open(`/api/servers/${serverId}/files/download?path=${encodeURIComponent(entry.path)}`, '_blank');
      return;
    }
    setSaveError('');
    try {
      const content = await api.get<string>(`/servers/${serverId}/files/content?path=${encodeURIComponent(entry.path)}`);
      setEditContent(content);
      setSavedContent(content);
      setEditPath(entry.path);
    } catch (e: unknown) {
      setDirError(e instanceof Error ? e.message : 'Cannot open file');
    }
  }

  async function saveFile() {
    if (!editPath) return;
    setSaving(true);
    setSaveError('');
    try {
      await api.put(`/servers/${serverId}/files/content`, { path: editPath, content: editContent });
      setSavedContent(editContent);
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    }
    setSaving(false);
  }

  function closeEditor() {
    if (isDirty && !confirm('You have unsaved changes. Discard them?')) return;
    setEditPath(null);
    setEditContent('');
    setSavedContent('');
    setSaveError('');
  }

  async function deleteEntry(entry: Entry, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete "${entry.name}"?`)) return;
    try {
      await api.delete(`/servers/${serverId}/files`, { path: entry.path });
      loadDir(dirPath);
    } catch (err: unknown) {
      setDirError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = '';

    const selected = Array.from(files);
    const existingNames = new Set(entries.map((en) => en.name));
    const conflicts = selected.filter((f) => existingNames.has(f.name)).map((f) => f.name);

    if (conflicts.length > 0) {
      setConflictModal({ conflicts, pending: selected });
    } else {
      await doUpload(selected, 'replace');
    }
  }

  async function doUpload(files: File[], mode: 'replace' | 'rename' | 'skip') {
    const existingNames = new Set(entries.map((en) => en.name));

    let toUpload = files;
    if (mode === 'skip') {
      toUpload = files.filter((f) => !existingNames.has(f.name));
    } else if (mode === 'rename') {
      toUpload = files.map((f) => {
        if (!existingNames.has(f.name)) return f;
        const dot = f.name.lastIndexOf('.');
        const base = dot > 0 ? f.name.slice(0, dot) : f.name;
        const ext = dot > 0 ? f.name.slice(dot) : '';
        let i = 1;
        let newName = `${base} (${i})${ext}`;
        while (existingNames.has(newName)) { i++; newName = `${base} (${i})${ext}`; }
        return new File([f], newName, { type: f.type });
      });
    }

    if (toUpload.length === 0) return;
    try {
      await uploadFiles(`/servers/${serverId}/files/upload`, toUpload, { path: dirPath });
      loadDir(dirPath);
    } catch (err: unknown) {
      setDirError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  async function submitCreate() {
    const name = createName.trim();
    if (!name) { setCreating(null); return; }
    const fullPath = dirPath ? `${dirPath}/${name}` : name;
    try {
      if (creating === 'folder') {
        await api.post(`/servers/${serverId}/files/mkdir`, { path: fullPath });
        loadDir(dirPath);
      } else {
        await api.put(`/servers/${serverId}/files/content`, { path: fullPath, content: '' });
        loadDir(dirPath);
        // Open the new file for editing immediately
        setEditContent('');
        setSavedContent('');
        setEditPath(fullPath);
      }
    } catch (err: unknown) {
      setDirError(err instanceof Error ? err.message : 'Create failed');
    }
    setCreating(null);
    setCreateName('');
  }

  async function submitRename(entry: Entry) {
    const newName = renameValue.trim();
    setRenamingPath(null);
    if (!newName || newName === entry.name) return;
    const newPath = dirPath ? `${dirPath}/${newName}` : newName;
    try {
      // Read + write + delete for files; mkdir + delete for dirs isn't ideal but
      // the backend has no rename endpoint — add one here instead
      await api.post(`/servers/${serverId}/files/rename`, { from: entry.path, to: newPath });
      loadDir(dirPath);
    } catch (err: unknown) {
      setDirError(err instanceof Error ? err.message : 'Rename failed');
    }
  }

  const breadcrumbs = dirPath ? dirPath.split('/').filter(Boolean) : [];

  // ── Editor view ──────────────────────────────────────────────────────────
  if (editPath !== null) {
    const filename = editPath.split('/').pop() ?? editPath;
    const saveKeymap = keymap.of([{
      key: 'Mod-s',
      run: () => { saveFile(); return true; },
    }]);

    return (
      <div className="flex flex-col h-full">
        {/* Editor toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-mc-border bg-mc-panel flex-shrink-0">
          <button onClick={closeEditor} className="btn-ghost py-1 px-2 text-xs">
            <ArrowLeft size={13} /> Files
          </button>
          <span className="text-mc-muted text-xs">/</span>
          <span className="font-mono text-xs text-gray-300 truncate flex-1">
            {editPath}
            {isDirty && <span className="text-yellow-400 ml-1">●</span>}
          </span>
          {saveError && (
            <span className="text-red-400 text-xs truncate max-w-48">{saveError}</span>
          )}
          <a
            href={`/api/servers/${serverId}/files/download?path=${encodeURIComponent(editPath)}`}
            download
            className="btn-ghost py-1 px-2 text-xs flex-shrink-0"
            title="Download file"
          >
            <Download size={13} />
          </a>
          <button
            onClick={saveFile}
            className="btn-primary py-1 px-3 text-xs flex-shrink-0"
            disabled={saving || !isDirty}
            title="Save (Ctrl+S / Cmd+S)"
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

        {/* CodeMirror editor */}
        <div className="flex-1 overflow-hidden">
          <CodeMirror
            value={editContent}
            onChange={setEditContent}
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

  // ── Directory browser ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-mc-border bg-mc-panel flex-wrap gap-y-1">
        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm flex-1 min-w-0 overflow-hidden">
          <button onClick={() => loadDir('')} className="text-mc-green hover:underline flex-shrink-0 text-xs">
            root
          </button>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 min-w-0">
              <ChevronRight size={12} className="text-mc-muted flex-shrink-0" />
              <button
                onClick={() => loadDir(breadcrumbs.slice(0, i + 1).join('/'))}
                className="text-mc-green hover:underline truncate text-xs max-w-28"
              >
                {crumb}
              </button>
            </span>
          ))}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => loadDir(dirPath)} className="btn-ghost p-1.5" title="Refresh">
            <RefreshCw size={13} />
          </button>
          <button
            onClick={() => { setCreating('folder'); setCreateName(''); }}
            className="btn-ghost p-1.5" title="New folder"
          >
            <FolderPlus size={13} />
          </button>
          <button
            onClick={() => { setCreating('file'); setCreateName(''); }}
            className="btn-ghost p-1.5" title="New file"
          >
            <Plus size={13} />
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onUpload} />
          <button onClick={() => fileInputRef.current?.click()} className="btn-ghost p-1.5" title="Upload files">
            <Upload size={13} />
          </button>
        </div>
      </div>

      {dirError && (
        <div className="mx-3 mt-2 text-red-400 text-xs bg-red-900/20 border border-red-800 rounded px-2 py-1">
          {dirError}
        </div>
      )}

      {/* Upload conflict modal */}
      {conflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-mc-panel border border-mc-border rounded-lg shadow-xl w-full max-w-sm mx-4 p-5 space-y-4">
            <div className="text-sm font-medium text-gray-200">File conflict</div>
            <p className="text-xs text-mc-muted">
              {conflictModal.conflicts.length === 1
                ? <>The file <span className="font-mono text-gray-300">{conflictModal.conflicts[0]}</span> already exists.</>
                : <><span className="text-gray-300">{conflictModal.conflicts.length} files</span> already exist in this directory.</>
              }
            </p>
            {conflictModal.conflicts.length > 1 && (
              <ul className="max-h-28 overflow-y-auto space-y-0.5">
                {conflictModal.conflicts.map((n) => (
                  <li key={n} className="font-mono text-xs text-gray-400 truncate">{n}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                className="btn-primary w-full text-xs"
                onClick={() => { const p = conflictModal.pending; setConflictModal(null); doUpload(p, 'replace'); }}
              >
                Replace existing
              </button>
              <button
                className="btn-ghost w-full text-xs"
                onClick={() => { const p = conflictModal.pending; setConflictModal(null); doUpload(p, 'rename'); }}
              >
                Keep both (auto-rename)
              </button>
              <button
                className="btn-ghost w-full text-xs"
                onClick={() => { const p = conflictModal.pending; setConflictModal(null); doUpload(p, 'skip'); }}
              >
                Skip conflicting files
              </button>
              <button
                className="text-mc-muted hover:text-gray-300 text-xs py-1"
                onClick={() => setConflictModal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File listing */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center text-mc-muted text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-mc-muted border-b border-mc-border sticky top-0 bg-mc-panel z-10">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-right px-4 py-2 hidden sm:table-cell">Size</th>
                <th className="text-right px-4 py-2 hidden md:table-cell">Modified</th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {/* New item input row */}
              {creating && (
                <tr className="border-b border-mc-border/40 bg-mc-green/5">
                  <td className="px-4 py-2 flex items-center gap-2" colSpan={4}>
                    {creating === 'folder'
                      ? <Folder size={14} className="text-yellow-400 flex-shrink-0" />
                      : <FileText size={14} className="text-mc-muted flex-shrink-0" />
                    }
                    <input
                      ref={createInputRef}
                      className="bg-transparent border-b border-mc-green outline-none text-sm text-gray-100 flex-1"
                      placeholder={creating === 'folder' ? 'folder-name' : 'filename.txt'}
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitCreate();
                        if (e.key === 'Escape') setCreating(null);
                      }}
                      onBlur={() => setTimeout(submitCreate, 100)}
                    />
                  </td>
                </tr>
              )}

              {/* Parent dir row */}
              {dirPath && (
                <tr
                  className="border-b border-mc-border/40 hover:bg-mc-panel/60 cursor-pointer"
                  onClick={() => loadDir(breadcrumbs.slice(0, -1).join('/'))}
                >
                  <td className="px-4 py-2 flex items-center gap-2 text-mc-muted">
                    <Folder size={14} className="flex-shrink-0" />
                    <span>..</span>
                  </td>
                  <td className="hidden sm:table-cell" />
                  <td className="hidden md:table-cell" />
                  <td />
                </tr>
              )}

              {entries.length === 0 && !creating && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-mc-muted text-sm">
                    Empty directory
                  </td>
                </tr>
              )}

              {entries.map((entry) => (
                <tr
                  key={entry.path}
                  className="border-b border-mc-border/40 hover:bg-mc-panel/60 cursor-pointer group"
                  onClick={() => openFile(entry)}
                >
                  <td className="px-4 py-2">
                    {renamingPath === entry.path ? (
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {entry.isDir
                          ? <Folder size={14} className="text-yellow-400 flex-shrink-0" />
                          : <FileText size={14} className="text-mc-muted flex-shrink-0" />
                        }
                        <input
                          ref={renameInputRef}
                          className="bg-transparent border-b border-mc-green outline-none text-sm text-gray-100 flex-1"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitRename(entry);
                            if (e.key === 'Escape') setRenamingPath(null);
                          }}
                          onBlur={() => submitRename(entry)}
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {entry.isDir
                          ? <Folder size={14} className="text-yellow-400 flex-shrink-0" />
                          : <FileText size={14} className={`flex-shrink-0 ${isTextFile(entry.name) ? 'text-mc-muted' : 'text-orange-400'}`} />
                        }
                        <span className="truncate">{entry.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-mc-muted text-xs hidden sm:table-cell">
                    {entry.isDir ? '—' : fmtSize(entry.size)}
                  </td>
                  <td className="px-4 py-2 text-right text-mc-muted text-xs hidden md:table-cell">
                    {fmtDate(entry.mtime)}
                  </td>
                  <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setRenamingPath(entry.path); setRenameValue(entry.name); }}
                        className="p-1 rounded hover:bg-mc-border text-mc-muted hover:text-gray-300"
                        title="Rename"
                      >
                        <FilePen size={12} />
                      </button>
                      {!entry.isDir && (
                        <a
                          href={`/api/servers/${serverId}/files/download?path=${encodeURIComponent(entry.path)}`}
                          download
                          className="p-1 rounded hover:bg-mc-border text-mc-muted hover:text-gray-300"
                          title="Download"
                        >
                          <Download size={12} />
                        </a>
                      )}
                      <button
                        onClick={(e) => deleteEntry(entry, e)}
                        className="p-1 rounded hover:bg-red-900/30 text-mc-muted hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

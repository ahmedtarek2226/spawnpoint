import { useState, useEffect } from 'react';
import { Save, Check, Users, Globe, Swords, Cpu, Network, ShieldCheck, Image, Settings2 } from 'lucide-react';
import { api } from '../../api/client';

type PropType = 'boolean' | 'number' | 'select' | 'text';

interface PropMeta {
  description: string;
  type: PropType;
  min?: number;
  max?: number;
  options?: string[];
}

const KNOWN: Record<string, PropMeta> = {
  'max-players':           { description: 'Maximum number of players allowed on the server at once.', type: 'number', min: 1, max: 10000 },
  'view-distance':         { description: 'Chunks sent to players in each direction. Higher = more RAM/CPU.', type: 'number', min: 2, max: 32 },
  'simulation-distance':   { description: 'Distance in chunks within which entities tick. Lower = better performance.', type: 'number', min: 2, max: 32 },
  'difficulty':            { description: 'Game difficulty.', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'] },
  'gamemode':              { description: 'Default game mode for new players.', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'] },
  'pvp':                   { description: 'Allow players to attack each other.', type: 'boolean' },
  'online-mode':           { description: 'Verify players against Mojang\'s auth servers. Disable for offline/LAN.', type: 'boolean' },
  'allow-flight':          { description: 'Allow players to use flight clients. Required for some mods.', type: 'boolean' },
  'allow-nether':          { description: 'Allow players to travel to the Nether dimension.', type: 'boolean' },
  'spawn-monsters':        { description: 'Enable hostile mob spawning.', type: 'boolean' },
  'spawn-animals':         { description: 'Enable passive mob spawning.', type: 'boolean' },
  'spawn-npcs':            { description: 'Enable NPC (villager) spawning.', type: 'boolean' },
  'spawn-protection':      { description: 'Radius of spawn area protected from non-ops. 0 = disabled.', type: 'number', min: 0, max: 256 },
  'enable-command-block':  { description: 'Enable command blocks. Required for many adventure maps.', type: 'boolean' },
  'force-gamemode':        { description: 'Force players into the default gamemode on join.', type: 'boolean' },
  'hardcore':              { description: 'Hardcore mode — players are banned on death.', type: 'boolean' },
  'white-list':            { description: 'Only allow players on the whitelist to join.', type: 'boolean' },
  'enforce-whitelist':     { description: 'Kick non-whitelisted players when whitelist is enabled.', type: 'boolean' },
  'motd':                  { description: 'Message shown in the server browser below the server name.', type: 'text' },
  'level-name':            { description: 'Name of the world folder.', type: 'text' },
  'level-seed':            { description: 'Seed used to generate the world. Empty = random.', type: 'text' },
  'level-type':            { description: 'World generator type.', type: 'select', options: ['minecraft:normal', 'minecraft:flat', 'minecraft:large_biomes', 'minecraft:amplified', 'minecraft:single_biome_surface'] },
  'max-world-size':        { description: 'Max radius of the world in blocks.', type: 'number', min: 1, max: 29999984 },
  'max-tick-time':         { description: 'Max ms a single tick may take before the server watchdog stops it. -1 = disabled.', type: 'number', min: -1 },
  'network-compression-threshold': { description: 'Compress packets larger than this (bytes). -1 = disable, 0 = all.', type: 'number', min: -1 },
  'op-permission-level':   { description: 'Permission level granted to operators (1–4).', type: 'number', min: 1, max: 4 },
  'function-permission-level': { description: 'Permission level for functions (1–4).', type: 'number', min: 1, max: 4 },
  'player-idle-timeout':   { description: 'Kick idle players after this many minutes. 0 = never.', type: 'number', min: 0 },
  'rate-limit':            { description: 'Max packets per second per player. 0 = no limit.', type: 'number', min: 0 },
  'server-port':           { description: 'TCP port the server listens on.', type: 'number', min: 1, max: 65535 },
  'server-ip':             { description: 'Bind the server to a specific IP address. Empty = all interfaces.', type: 'text' },
  'resource-pack':         { description: 'URL of a resource pack players are prompted to download.', type: 'text' },
  'resource-pack-prompt':  { description: 'Custom message shown in the resource pack prompt.', type: 'text' },
  'require-resource-pack': { description: 'Kick players who decline the resource pack.', type: 'boolean' },
  'sync-chunk-writes':     { description: 'Synchronously write chunk data to disk. Safer but slower on some systems.', type: 'boolean' },
  'use-native-transport':  { description: 'Use optimised native network transport on Linux (epoll).', type: 'boolean' },
  'enable-rcon':           { description: 'Enable remote console access (used by Spawnpoint — do not disable).', type: 'boolean' },
  'enable-jmx-monitoring': { description: 'Expose JMX metrics for monitoring tools.', type: 'boolean' },
  'enforce-secure-profile': { description: 'Require players to have a Mojang-signed public key.', type: 'boolean' },
  'log-ips':               { description: 'Log player IP addresses on connection.', type: 'boolean' },
  'generate-structures':   { description: 'Generate structures (villages, dungeons, etc.) in the world.', type: 'boolean' },
};

// Groups define display order and visual sections
const GROUPS: { label: string; icon: React.ElementType; color: string; keys: string[] }[] = [
  {
    label: 'Players',
    icon: Users,
    color: 'border-mc-green',
    keys: ['motd', 'max-players', 'online-mode', 'white-list', 'enforce-whitelist', 'player-idle-timeout', 'op-permission-level', 'function-permission-level'],
  },
  {
    label: 'World',
    icon: Globe,
    color: 'border-blue-500',
    keys: ['level-name', 'level-seed', 'level-type', 'allow-nether', 'max-world-size', 'generate-structures'],
  },
  {
    label: 'Gameplay',
    icon: Swords,
    color: 'border-yellow-500',
    keys: ['difficulty', 'gamemode', 'force-gamemode', 'pvp', 'hardcore', 'allow-flight', 'spawn-monsters', 'spawn-animals', 'spawn-npcs', 'spawn-protection', 'enable-command-block'],
  },
  {
    label: 'Performance',
    icon: Cpu,
    color: 'border-purple-500',
    keys: ['view-distance', 'simulation-distance', 'max-tick-time', 'sync-chunk-writes', 'use-native-transport'],
  },
  {
    label: 'Network',
    icon: Network,
    color: 'border-cyan-500',
    keys: ['server-port', 'server-ip', 'network-compression-threshold', 'rate-limit'],
  },
  {
    label: 'Security',
    icon: ShieldCheck,
    color: 'border-red-500',
    keys: ['enable-rcon', 'enforce-secure-profile', 'log-ips', 'enable-jmx-monitoring'],
  },
  {
    label: 'Resource Pack',
    icon: Image,
    color: 'border-orange-500',
    keys: ['resource-pack', 'resource-pack-prompt', 'require-resource-pack'],
  },
];

function validate(key: string, value: string): string {
  const meta = KNOWN[key];
  if (!meta) return '';
  if (meta.type === 'number') {
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n)) return 'Must be a whole number';
    if (meta.min !== undefined && n < meta.min) return `Minimum is ${meta.min}`;
    if (meta.max !== undefined && n > meta.max) return `Maximum is ${meta.max}`;
  }
  if (meta.type === 'boolean' && value !== 'true' && value !== 'false') return 'Must be true or false';
  if (meta.type === 'select' && meta.options && !meta.options.includes(value)) return `Must be one of: ${meta.options.join(', ')}`;
  return '';
}

function PropRow({ propKey, value, onChange }: {
  propKey: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const meta = KNOWN[propKey];
  const error = validate(propKey, value);

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 py-2.5 border-b border-mc-border/30 last:border-0 items-start">
      {/* Left: key + description */}
      <div>
        <label className="text-xs text-gray-400 font-mono block" title={propKey}>{propKey}</label>
        {meta && <p className="text-xs text-mc-muted/70 mt-0.5 leading-snug">{meta.description}</p>}
      </div>

      {/* Right: control */}
      <div>
        {meta?.type === 'boolean' ? (
          <button
            type="button"
            onClick={() => onChange(value === 'true' ? 'false' : 'true')}
            className={`text-xs px-3 py-1.5 rounded border transition-colors ${
              value === 'true'
                ? 'border-mc-green bg-mc-green/10 text-mc-green'
                : 'border-mc-border text-mc-muted hover:border-gray-500'
            }`}
          >
            {value === 'true' ? 'Enabled' : 'Disabled'}
          </button>
        ) : meta?.type === 'select' ? (
          <select className="input text-xs py-1.5 w-full max-w-xs" value={value} onChange={e => onChange(e.target.value)}>
            {meta.options!.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input
            className={`input w-full max-w-xs ${error ? 'border-red-700' : ''}`}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        )}
        {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
      </div>
    </div>
  );
}

function GroupSection({ group, props, onChange }: {
  group: typeof GROUPS[0];
  props: Record<string, string>;
  onChange: (key: string, v: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = group.icon;
  const presentKeys = group.keys.filter(k => k in props);
  if (presentKeys.length === 0) return null;

  return (
    <div className={`card border-l-2 ${group.color} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-mc-panel/30 transition-colors"
      >
        <Icon size={13} className="text-mc-muted flex-shrink-0" />
        <span className="text-sm font-medium text-gray-300">{group.label}</span>
        <span className="text-xs text-mc-muted ml-auto">{collapsed ? `${presentKeys.length} props` : ''}</span>
        <svg
          className={`w-3 h-3 text-mc-muted transition-transform flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3">
          {presentKeys.map(key => (
            <PropRow key={key} propKey={key} value={props[key]} onChange={(v) => onChange(key, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PropertiesTab({ serverId }: { serverId: string }) {
  const [props, setProps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<Record<string, string>>(`/servers/${serverId}/files/properties`)
      .then(setProps)
      .catch(() => setError('Could not load server.properties'))
      .finally(() => setLoading(false));
  }, [serverId]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await api.put(`/servers/${serverId}/files/properties`, props);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function onChange(key: string, v: string) {
    setProps(p => ({ ...p, [key]: v }));
  }

  if (loading) return <div className="p-6 text-mc-muted">Loading…</div>;

  if (Object.keys(props).length === 0) {
    return (
      <div className="p-6 flex flex-col items-center gap-2 text-center">
        <Settings2 size={32} className="text-mc-muted opacity-30" />
        <p className="text-mc-muted text-sm">No server.properties found.</p>
        <p className="text-xs text-mc-muted/60">Start the server once to generate it.</p>
      </div>
    );
  }

  const knownGroupKeys = new Set(GROUPS.flatMap(g => g.keys));
  const ungroupedKnown = Object.keys(props).filter(k => k in KNOWN && !knownGroupKeys.has(k)).sort();
  const unknownEntries = Object.entries(props).filter(([k]) => !(k in KNOWN)).sort(([a], [b]) => a.localeCompare(b));
  const hasErrors = Object.entries(props).some(([k, v]) => validate(k, v));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mc-border bg-mc-panel/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Settings2 size={14} className="text-mc-muted" />
          <span className="text-sm text-mc-muted font-mono">server.properties</span>
        </div>
        <button
          onClick={save}
          className={`btn-primary text-sm gap-1.5 ${saved ? 'bg-mc-green/80' : ''}`}
          disabled={saving || hasErrors}
        >
          {saved ? <><Check size={14} /> Saved!</> : <><Save size={14} /> {saving ? 'Saving…' : 'Save changes'}</>}
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-4 bg-red-900/30 border border-red-700 text-red-400 rounded px-3 py-2 text-sm">{error}</div>
      )}

      {/* Grouped properties */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {GROUPS.map(group => (
            <GroupSection
              key={group.label}
              group={group}
              props={props}
              onChange={onChange}
            />
          ))}

          {ungroupedKnown.length > 0 && (
            <div className="card border-l-2 border-mc-border overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2">
                <Settings2 size={13} className="text-mc-muted flex-shrink-0" />
                <span className="text-sm font-medium text-gray-300">Other Known</span>
              </div>
              <div className="px-4 pb-3">
                {ungroupedKnown.map(key => (
                  <PropRow key={key} propKey={key} value={props[key]} onChange={(v) => onChange(key, v)} />
                ))}
              </div>
            </div>
          )}

          {unknownEntries.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-mc-border/40">
                <span className="text-xs text-mc-muted font-medium uppercase tracking-wide">Other / Custom Properties</span>
              </div>
              <div className="px-4 pb-3">
                {unknownEntries.map(([key, value]) => (
                  <PropRow key={key} propKey={key} value={value} onChange={(v) => onChange(key, v)} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

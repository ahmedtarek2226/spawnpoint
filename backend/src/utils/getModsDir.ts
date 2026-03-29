import path from 'path';

const PLUGIN_TYPES = new Set(['paper', 'spigot', 'purpur', 'bungeecord', 'velocity']);

export function getModsDir(serverDir: string, serverType: string): string {
  return path.join(serverDir, PLUGIN_TYPES.has(serverType) ? 'plugins' : 'mods');
}

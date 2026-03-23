import fs from 'fs';
import path from 'path';

export function safePath(serverDir: string, requestedPath: string): string {
  const resolved = path.resolve(serverDir, requestedPath.replace(/^\/+/, ''));
  const base = path.resolve(serverDir);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw Object.assign(new Error('Path traversal detected'), { status: 403 });
  }
  return resolved;
}

export interface FileEntry {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: string;
}

export function listDir(serverDir: string, relativePath: string): FileEntry[] {
  const target = safePath(serverDir, relativePath);
  if (!fs.existsSync(target)) return [];

  return fs.readdirSync(target).map((name) => {
    const full = path.join(target, name);
    const stat = fs.statSync(full);
    return {
      name,
      path: path.join(relativePath, name).replace(/\\/g, '/'),
      isDir: stat.isDirectory(),
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  }).sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function readFile(serverDir: string, relativePath: string): string {
  const target = safePath(serverDir, relativePath);
  return fs.readFileSync(target, 'utf8');
}

export function writeFile(serverDir: string, relativePath: string, content: string): void {
  const target = safePath(serverDir, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, 'utf8');
}

export function deleteEntry(serverDir: string, relativePath: string): void {
  const target = safePath(serverDir, relativePath);
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    fs.rmSync(target, { recursive: true });
  } else {
    fs.unlinkSync(target);
  }
}

export function renameEntry(serverDir: string, fromPath: string, toPath: string): void {
  const src = safePath(serverDir, fromPath);
  const dst = safePath(serverDir, toPath);
  if (!fs.existsSync(src)) throw Object.assign(new Error('Source not found'), { status: 404 });
  if (fs.existsSync(dst)) throw Object.assign(new Error('Destination already exists'), { status: 409 });
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.renameSync(src, dst);
}

export function makeDir(serverDir: string, relativePath: string): void {
  const target = safePath(serverDir, relativePath);
  fs.mkdirSync(target, { recursive: true });
}

export function parseProperties(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    result[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
  return result;
}

export function stringifyProperties(props: Record<string, string>): string {
  const lines = ['# Minecraft server properties', `# Generated ${new Date().toUTCString()}`, ''];
  for (const [k, v] of Object.entries(props)) {
    lines.push(`${k}=${v}`);
  }
  return lines.join('\n') + '\n';
}

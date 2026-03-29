import { getSetting } from '../models/Setting';

const BASE = 'https://api.curseforge.com/v1';
const UA = { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' };

export function cfApiKey(): string {
  return getSetting('curseforge_api_key') ?? '';
}

export function cfEnabled(): boolean {
  return !!cfApiKey();
}

async function cfFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const resp = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'x-api-key': cfApiKey(),
      'Content-Type': 'application/json',
      ...UA,
      ...(init.headers ?? {}),
    },
  });
  if (resp.status === 403) {
    throw new Error('CurseForge API key invalid (403). Check the key in Settings.');
  }
  if (!resp.ok) throw new Error(`CurseForge API error: ${resp.status}`);
  return resp.json();
}

export async function cfGet<T>(path: string): Promise<T> {
  return cfFetch(path) as Promise<T>;
}

export async function cfPost<T>(path: string, body: unknown): Promise<T> {
  return cfFetch(path, { method: 'POST', body: JSON.stringify(body) }) as Promise<T>;
}

// ── MurmurHash2 (32-bit) fingerprint used by CurseForge ──────────────────────
// Algorithm: strip whitespace bytes (9,10,13,32), then MurmurHash2 with seed 1.

function murmur2(data: Buffer): number {
  const m = 0x5bd1e995;
  let h = (1 ^ data.length) >>> 0;
  let i = 0;

  while (i + 4 <= data.length) {
    let k = data.readUInt32LE(i);
    k = Math.imul(k, m) >>> 0;
    k ^= k >>> 24;
    k = Math.imul(k, m) >>> 0;
    h = Math.imul(h, m) >>> 0;
    h = (h ^ k) >>> 0;
    i += 4;
  }

  const rem = data.length - i;
  if (rem >= 3) h = (h ^ (data[i + 2] << 16)) >>> 0;
  if (rem >= 2) h = (h ^ (data[i + 1] << 8)) >>> 0;
  if (rem >= 1) {
    h = (h ^ data[i]) >>> 0;
    h = Math.imul(h, m) >>> 0;
  }

  h ^= h >>> 13;
  h = Math.imul(h, m) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

const STRIP_BYTES = new Set([9, 10, 13, 32]);

export function cfFingerprint(buf: Buffer): number {
  const filtered = buf.filter((b) => !STRIP_BYTES.has(b));
  return murmur2(Buffer.from(filtered));
}

// CurseForge loader type IDs
export const LOADER_TYPE: Record<string, number> = {
  forge:    1,
  fabric:   4,
  quilt:    5,
  neoforge: 6,
};

export const GAME_ID = 432; // Minecraft
export const CLASS_MOD = 6;
export const CLASS_MODPACK = 4471;

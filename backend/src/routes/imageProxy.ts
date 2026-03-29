import { ApiError } from '../errors';
import { Router, Request, Response, NextFunction } from 'express';
import dns from 'dns';
import net from 'net';

const router = Router();

// Only proxy images from these trusted CDNs
const ALLOWED_HOSTS = new Set([
  'cdn.modrinth.com',
  'media.forgecdn.net',
  'mediafilez.forgecdn.net',
]);

// Block private/loopback IP ranges to prevent SSRF via DNS rebinding
function isPrivateIp(ip: string): boolean {
  // Strip IPv6 mapped IPv4 prefix
  const addr = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (addr === '::1' || addr === 'localhost') return true;
  if (!net.isIPv4(addr)) return false; // block non-IPv4 to be safe
  const parts = addr.split('.').map(Number);
  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) || // link-local
    (a === 0)
  );
}

async function resolvedToPrivate(hostname: string): Promise<boolean> {
  try {
    const addrs = await dns.promises.resolve4(hostname);
    return addrs.some(isPrivateIp);
  } catch {
    return true; // block on DNS failure
  }
}

interface CacheEntry {
  data: Buffer;
  contentType: string;
  cachedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_ENTRIES = 1000;

function evictExpired() {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.cachedAt > CACHE_TTL_MS) cache.delete(key);
  }
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = (req.query.url as string) ?? '';
    if (!url) return next(new ApiError('url parameter required', 400));

    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return next(new ApiError('Invalid URL', 400));
    }
    if (!ALLOWED_HOSTS.has(parsed.hostname)) {
      return next(new ApiError('Image host not allowed', 403));
    }

    // Resolve hostname and block private IPs (prevents SSRF via DNS rebinding)
    if (await resolvedToPrivate(parsed.hostname)) {
      return next(new ApiError('Image host not allowed', 403));
    }

    // Serve from cache if fresh
    const cached = cache.get(url);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      res.setHeader('Content-Type', cached.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('X-Cache', 'HIT');
      return res.send(cached.data);
    }

    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Spawnpoint/1.0 (self-hosted MC manager)' },
    });
    if (!resp.ok) return next(new ApiError(`Upstream ${resp.status}`, 502));

    const contentType = resp.headers.get('content-type') ?? 'image/png';
    if (!contentType.startsWith('image/')) {
      return next(new ApiError('Not an image', 400));
    }

    const data = Buffer.from(await resp.arrayBuffer());

    // Evict if cache is full
    if (cache.size >= MAX_CACHE_ENTRIES) evictExpired();
    if (cache.size >= MAX_CACHE_ENTRIES) {
      // Delete oldest entry
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(url, { data, contentType, cachedAt: Date.now() });

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Cache', 'MISS');
    res.send(data);
  } catch (err) { next(err); }
});

export default router;

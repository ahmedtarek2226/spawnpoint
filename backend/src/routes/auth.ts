import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { DASHBOARD_USER, DASHBOARD_PASSWORD } from '../config';
import { activeSessions } from '../services/sessionStore';
import { parseCookies, SESSION_COOKIE, COOKIE_MAX_AGE } from '../middleware/auth';

const router = Router();

// In-memory rate limiter: max 5 attempts per IP per 15 minutes
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function resetAttempts(ip: string): void {
  attempts.delete(ip);
}

router.get('/check', (req, res) => {
  if (!DASHBOARD_USER || !DASHBOARD_PASSWORD) {
    res.json({ success: true, data: { required: false } });
    return;
  }
  const token = parseCookies(req.headers.cookie ?? '')[SESSION_COOKIE];
  res.json({ success: true, data: { required: true, authenticated: !!token && activeSessions.has(token) } });
});

router.post('/login', (req, res) => {
  if (!DASHBOARD_USER || !DASHBOARD_PASSWORD) {
    res.json({ success: true, data: {} });
    return;
  }

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? 'unknown';

  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', String(Math.ceil(RATE_WINDOW_MS / 1000)));
    res.status(429).json({ success: false, error: { message: 'Too many login attempts. Try again in 15 minutes.' } });
    return;
  }

  const { username, password } = req.body ?? {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ success: false, error: { message: 'Username and password required' } });
    return;
  }

  const validUser = safeCompare(username, DASHBOARD_USER);
  const validPass = safeCompare(password, DASHBOARD_PASSWORD);
  if (!validUser || !validPass) {
    res.status(401).json({ success: false, error: { message: 'Invalid credentials' } });
    return;
  }

  resetAttempts(ip);
  const token = randomBytes(32).toString('hex');
  activeSessions.add(token);
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', maxAge: COOKIE_MAX_AGE });
  res.json({ success: true, data: {} });
});

router.post('/logout', (req, res) => {
  const token = parseCookies(req.headers.cookie ?? '')[SESSION_COOKIE];
  if (token) activeSessions.delete(token);
  res.clearCookie(SESSION_COOKIE);
  res.json({ success: true, data: {} });
});

function safeCompare(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba); // consume constant time
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export default router;

import { Router } from 'express';
import { randomBytes, timingSafeEqual } from 'crypto';
import { DASHBOARD_USER, DASHBOARD_PASSWORD } from '../config';
import { activeSessions } from '../services/sessionStore';
import { parseCookies, SESSION_COOKIE, COOKIE_MAX_AGE } from '../middleware/auth';

const router = Router();

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

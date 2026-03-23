import { Request, Response, NextFunction } from 'express';
import { DASHBOARD_USER, DASHBOARD_PASSWORD } from '../config';
import { activeSessions } from '../services/sessionStore';

export const SESSION_COOKIE = 'sp_session';
export const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!DASHBOARD_USER || !DASHBOARD_PASSWORD) {
    next();
    return;
  }

  const token = parseCookies(req.headers.cookie ?? '')[SESSION_COOKIE];
  if (!token || !activeSessions.has(token)) {
    res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    return;
  }

  next();
}

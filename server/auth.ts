import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db } from './db.ts';

const AUTH_SECRET = process.env.SESSION_SECRET || 'zaza-xpras-platform-secret-key-2026-egypt';
export const COOKIE_NAME = 'zaza_session';

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  role: 'admin' | 'student';
  phone: string;
  grade: string;
  school: string;
  bio: string;
  avatar_url: string;
  status: 'active' | 'suspended';
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signToken(userId: number, role: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      role,
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): { uid: number; role: string } | null {
  try {
    const [payload, sig] = token.split('.');
    if (!payload || !sig) return null;
    const expected = crypto.createHmac('sha256', AUTH_SECRET).update(payload).digest('base64url');
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: number;
      role: string;
      exp: number;
    };
    if (!decoded.uid || decoded.exp < Date.now()) return null;
    return { uid: decoded.uid, role: decoded.role };
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parts = cookieHeader.split(';');
    for (const part of parts) {
      const [k, ...rest] = part.trim().split('=');
      if (k === COOKIE_NAME) {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  if (queryToken) return queryToken;
  return null;
}

export function loadUserFromRequest(req: Request): AuthUser | null {
  const token = extractToken(req);
  if (!token) return null;
  const verified = verifyToken(token);
  if (!verified) return null;
  const user = db
    .prepare(
      'SELECT id, full_name, email, role, phone, grade, school, bio, avatar_url, status FROM users WHERE id = ?',
    )
    .get(verified.uid) as AuthUser | undefined;
  if (!user || user.status !== 'active') return null;
  return user;
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  req.user = loadUserFromRequest(req) || undefined;
  next();
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = loadUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  req.user = user;
  next();
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const user = loadUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator permission required.' });
    return;
  }
  req.user = user;
  next();
}

export function getActiveSubscription(userId: number) {
  const nowIso = new Date().toISOString();
  return db
    .prepare(
      `SELECT * FROM user_subscriptions
       WHERE user_id = ? AND status = 'active' AND expires_at > ?
       ORDER BY expires_at DESC LIMIT 1`,
    )
    .get(userId, nowIso) as
    | {
        id: number;
        user_id: number;
        plan_id: number | null;
        plan_name: string;
        status: string;
        starts_at: string;
        expires_at: string;
      }
    | undefined;
}

export function userHasLessonAccess(
  user: AuthUser | undefined,
  lesson: { id: number; course_id: number; access_type: string },
): boolean {
  if (lesson.access_type === 'free') return true;
  if (!user) return false;
  if (user.role === 'admin') return true;

  const grant = db
    .prepare(
      `SELECT id FROM lesson_access_grants
       WHERE user_id = ? AND (lesson_id = ? OR (lesson_id IS NULL AND course_id = ?))
       LIMIT 1`,
    )
    .get(user.id, lesson.id, lesson.course_id);
  if (grant) return true;

  if (lesson.access_type === 'subscription') {
    const sub = getActiveSubscription(user.id);
    return Boolean(sub);
  }

  return false;
}

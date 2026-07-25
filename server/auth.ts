import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export interface AuthTokenPayload {
  merchantId: string;
  storeId: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
}

export interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }
  try {
    req.auth = verifyToken(header.slice('Bearer '.length));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Generic short-lived signed tokens for stateless server-side handoffs (OAuth `state`
// params, pending-selection tokens) — distinct from the long-lived login session token.
export function signState<T extends object>(payload: T, expiresIn: string): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn } as jwt.SignOptions);
}

export function verifyState<T>(token: string): T {
  return jwt.verify(token, JWT_SECRET) as T;
}

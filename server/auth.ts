import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: ['HS256'],
};

export interface AuthTokenPayload {
  merchantId: string;
  storeId: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as AuthTokenPayload;
}

export interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }
  try {
    req.auth = verifyToken(header.slice('Bearer '.length));
    next();
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

// Generic short-lived signed tokens for stateless server-side handoffs (OAuth `state`
// params, pending-selection tokens) — distinct from the long-lived login session token.
export function signState<T extends object>(payload: T, expiresIn: string): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn, algorithm: 'HS256' } as jwt.SignOptions);
}

export function verifyState<T>(token: string): T {
  return jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as T;
}

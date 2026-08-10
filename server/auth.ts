import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const JWT_VERIFY_OPTIONS: jwt.VerifyOptions = {
  algorithms: ['HS256'],
};

// Merchant session lifetime. Independent of OAuth state / handoff tokens (signState).
export const MERCHANT_SESSION_EXPIRES_IN = '24h';

export const MIN_PASSWORD_LENGTH = 8;

export interface AuthTokenPayload {
  merchantId: string;
  storeId: string;
  /** Merchant.tokenVersion at issuance — must still match on every request. */
  tv: number;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: MERCHANT_SESSION_EXPIRES_IN,
    algorithm: 'HS256',
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as AuthTokenPayload;
  if (
    typeof decoded.merchantId !== 'string' ||
    typeof decoded.storeId !== 'string' ||
    typeof decoded.tv !== 'number'
  ) {
    throw new Error('Invalid token payload');
  }
  return decoded;
}

export interface AuthedRequest extends Request {
  auth?: AuthTokenPayload;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication failed' });
    return;
  }
  try {
    const payload = verifyToken(header.slice('Bearer '.length));
    const merchant = await prisma.merchant.findUnique({
      where: { id: payload.merchantId },
      select: { tokenVersion: true },
    });
    if (!merchant || merchant.tokenVersion !== payload.tv) {
      res.status(401).json({ error: 'Authentication failed' });
      return;
    }
    req.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
  }
}

export function isPasswordStrongEnough(password: string): boolean {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
}

// Generic short-lived signed tokens for stateless server-side handoffs (OAuth `state`
// params, pending-selection tokens) — distinct from the long-lived login session token.
export function signState<T extends object>(payload: T, expiresIn: string): string {
  return jwt.sign(payload as object, JWT_SECRET, { expiresIn, algorithm: 'HS256' } as jwt.SignOptions);
}

export function verifyState<T>(token: string): T {
  return jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTIONS) as T;
}

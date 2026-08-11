import type { Response, NextFunction } from 'express';
import { prisma } from './db';
import type { AuthedRequest } from './auth';

// ── Profile completion logic ───────────────────────────────────────────────

/** Minimal shape we need to evaluate completion — from Merchant and Store rows. */
export interface MerchantForCompletion {
  name: string;
  email: string;
  phone?: string | null;
}

export interface StoreForCompletion {
  name: string;
  businessPhone?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
}

export interface ProfileCompletionStatus {
  profileComplete: boolean;
  missingFields: string[];
}

function nonEmpty(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Derives profile completion from the actual field values — no separate flag column.
 * Completion requires all the mandatory personal and business fields to be non-empty.
 */
export function getProfileCompletionStatus(
  merchant: MerchantForCompletion,
  store: StoreForCompletion,
): ProfileCompletionStatus {
  const missing: string[] = [];

  if (!nonEmpty(merchant.name)) missing.push('name');
  if (!nonEmpty(merchant.email)) missing.push('email');
  if (!nonEmpty(merchant.phone)) missing.push('phone');

  if (!nonEmpty(store.name)) missing.push('storeName');
  if (!nonEmpty(store.businessPhone)) missing.push('businessPhone');
  if (!nonEmpty(store.streetAddress)) missing.push('streetAddress');
  if (!nonEmpty(store.city)) missing.push('city');
  if (!nonEmpty(store.province)) missing.push('province');
  if (!nonEmpty(store.postalCode)) missing.push('postalCode');
  if (!nonEmpty(store.country)) missing.push('country');

  return { profileComplete: missing.length === 0, missingFields: missing };
}

// ── Allowlisted endpoints (accessible even when profile is incomplete) ─────

/**
 * Routes that an incomplete merchant must be able to call in order to finish
 * onboarding. Everything else requires a complete profile.
 */
const ONBOARDING_ALLOWED: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/api/me' },
  { method: 'PATCH', path: '/api/me' },
  { method: 'PATCH', path: '/api/me/store' },
  { method: 'POST', path: '/api/me/complete-profile' },
  { method: 'POST', path: '/api/me/avatar' },
  { method: 'DELETE', path: '/api/me/avatar' },
  { method: 'POST', path: '/api/auth/logout' },
];

export function isOnboardingAllowedRoute(method: string, path: string): boolean {
  const m = method.toUpperCase();
  // Normalize path (ignore trailing slash)
  const p = path.replace(/\/$/, '');
  return ONBOARDING_ALLOWED.some((r) => r.method === m && r.path === p);
}

// ── Middleware ─────────────────────────────────────────────────────────────

/**
 * Must be chained after `requireAuth`. Checks profile completeness and returns
 * 403 with a machine-readable code for any route not in the onboarding allowlist.
 */
export async function requireProfileComplete(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (isOnboardingAllowedRoute(req.method, req.path)) {
    next();
    return;
  }

  try {
    const merchant = await prisma.merchant.findUnique({
      where: { id: req.auth!.merchantId },
      select: { name: true, email: true, phone: true },
    });
    const store = await prisma.store.findUnique({
      where: { merchantId: req.auth!.merchantId },
      select: {
        name: true,
        businessPhone: true,
        streetAddress: true,
        city: true,
        province: true,
        postalCode: true,
        country: true,
      },
    });

    if (!merchant || !store) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const { profileComplete, missingFields } = getProfileCompletionStatus(merchant, store);
    if (!profileComplete) {
      res.status(403).json({
        error: 'Profile incomplete',
        code: 'PROFILE_INCOMPLETE',
        missingFields,
      });
      return;
    }

    next();
  } catch {
    res.status(500).json({ error: 'Failed to verify profile status' });
  }
}

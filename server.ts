import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { MulterError } from 'multer';
import { prisma } from './server/db';
import {
  requireAuth,
  AuthedRequest,
  signState,
  verifyState,
  isPasswordStrongEnough,
  establishMerchantSession,
  clearSessionCookie,
  requireTrustedOrigin,
} from './server/auth';
import { ai } from './server/gemini';
import { generateAgentReply, isQuestionOrPriceInquiry } from './server/agent';
import {
  verifyMetaSignature,
  sendMessengerMessage,
  sendMessengerImage,
  sendWhatsAppMessage,
  sendWhatsAppImage,
  sendInstagramMessage,
  sendInstagramImage,
  fetchMessengerProfile,
  fetchInstagramProfile,
  replyToFacebookComment,
  sendFacebookPrivateReply,
  replyToInstagramComment,
  sendInstagramPrivateReply,
  getFacebookOAuthUrl,
  exchangeCodeForUserToken,
  listManagedPages,
  listWhatsAppPhoneNumbers,
  subscribePageWebhook,
  ManagedPage,
} from './server/meta';
import { encryptSecret, decryptSecret } from './server/crypto';
import { buildGoogleAuthUrl, exchangeCodeForProfile } from './server/google';
import { verifyShopifyStore, fetchShopifyProducts, getShopifyOAuthUrl, verifyShopifyCallbackHmac, exchangeShopifyCodeForToken } from './server/shopify';
import { verifyWooCommerceStore, fetchWooCommerceProducts, normalizeWooUrl } from './server/woocommerce';
import {
  parseAwaitingQuantityFor,
  sanitizeAskQuantityForSku,
  validateSkuAndQuantity,
  encodeConfirm,
  encodeDetails,
  encodeCancelPending,
  isAffirmativeMessage,
  isCancelDeclineMessage,
  isOngoingOrderCancelIntent,
  normalizeCheckoutQuantity,
  MAX_CHECKOUT_QUANTITY,
} from './server/checkoutSecurity';
import {
  createOAuthHandoff,
  consumeOAuthHandoff,
  peekOAuthHandoff,
  OAuthHandoffError,
  purgeExpiredOAuthHandoffs,
} from './server/oauthHandoff';
import {
  assertChannelExternalIdAvailable,
  resolveConnectedChannelByExternalId,
  ChannelOwnershipError,
  isChannelOwnershipError,
  isUniqueConstraintError,
  CHANNEL_ALREADY_CONNECTED_MESSAGE,
} from './server/channelSecurity';
import { claimWebhookEvent } from './server/webhookIdempotency';
import {
  JSON_BODY_LIMIT,
  validateProductInput,
  sanitizeCartInput,
  validateCartSkusInStore,
  conversationPatchHasOnlyAllowedKeys,
  validatePersonaInput,
  validateStoreBusinessInput,
  validatePhone,
  validateMerchantName,
  validateOnboardingInput,
} from './server/inputValidation';
import {
  getProfileCompletionStatus,
  requireProfileComplete,
} from './server/profileCompletion';
import {
  avatarUpload,
  saveAvatarFile,
  deleteLocalAvatarFile,
  isLocalAvatarUrl,
  MAX_AVATAR_BYTES,
  productImageUpload,
  saveProductImageFile,
  deleteProductImageFile,
  MAX_PRODUCT_IMAGE_BYTES,
  openingImageUpload,
  saveOpeningImageFile,
  deleteOpeningImageFile,
  MAX_OPENING_IMAGE_BYTES,
} from './server/mediaStorage';
import { authLimiter, aiLimiter, widgetLimiter } from './server/rateLimiters';
import {
  CHANNEL_TYPE_TO_FRONTEND,
  CHANNEL_TO_PLATFORM,
  STATUS_TO_FRONTEND,
  FRONTEND_TO_STATUS,
  SENDER_TO_FRONTEND,
  toPublicMerchant,
  toPublicStore,
  toPublicConversation,
  toPublicWidgetConversation,
} from './server/publicViews';
import { createOrderForConversation } from './server/orderCreation';
import { createLegalRouter } from './server/routes/legal';
import {
  getPageAccessTokenForStore,
  getWhatsAppCredentialsForStore,
  getInstagramCredentialsForStore,
  selectRelevantCatalog,
  generateAndStoreAgentReply,
  sendOpeningGreetingIfNew,
} from './server/conversationEngine';

dotenv.config();

type RequestWithRawBody = express.Request & {
  rawBody?: Buffer;
};

const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // Needed so express-rate-limit sees the real client IP behind Railway/other reverse proxies.
  app.set('trust proxy', 1);

  // Security headers. CSP is left off: a strict policy would break the Vite/React SPA,
  // inline styles, and third-party OAuth/asset flows until a full allowlist is designed.
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // Helmet's default Cross-Origin-Resource-Policy: same-origin would make browsers block
  // widget.js (and its API calls) from loading on any business's own website — the widget's
  // entire purpose. Override it back to cross-origin for exactly the paths that need it.
  app.use((req, res, next) => {
    if (req.path === '/widget.js' || req.path.startsWith('/api/widget/')) {
      res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    next();
  });


  app.use(express.json({
    limit: JSON_BODY_LIMIT,
    verify: (req: RequestWithRawBody, _res, buf) => {
      req.rawBody = buf;
    },
  }));

  // Cookie session CSRF: validate Origin/Referer on state-changing merchant API requests.
  app.use(requireTrustedOrigin);

  const PORT = Number(process.env.PORT) || 3000;

  // Route modules extracted out of this file — see server/routes/*.ts. Each is a
  // self-contained feature area with its own Router, mounted here.
  app.use(createLegalRouter());

  function sendAuthSuccess(
    res: express.Response,
    merchant: { id: string; name: string; email: string; phone?: string | null; avatarUrl: string | null; tokenVersion: number },
    store: { id: string; name: string; businessPhone?: string | null; website?: string | null; streetAddress?: string | null; city?: string | null; province?: string | null; postalCode?: string | null; country?: string | null },
  ) {
    const { profileComplete, missingFields } = getProfileCompletionStatus(merchant, store);
    establishMerchantSession(res, {
      merchantId: merchant.id,
      storeId: store.id,
      tv: merchant.tokenVersion,
    });
    res.json({
      merchant: toPublicMerchant(merchant),
      store: toPublicStore(store),
      profileComplete,
      missingFields,
    });
  }

  // Signup: creates a Merchant + their Store, establishes HttpOnly session cookie.
  app.post('/api/auth/signup', authLimiter, async (req, res) => {
    try {
      const { fullName, businessName, email, password } = req.body;

      if (!fullName || !businessName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }
      if (!isPasswordStrongEnough(password)) {
        return res.status(400).json({ error: 'Invalid request.' });
      }

      const existing = await prisma.merchant.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'An account with this email already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const merchant = await prisma.merchant.create({
        data: { email, passwordHash, name: fullName },
      });
      const store = await prisma.store.create({
        data: { merchantId: merchant.id, name: businessName },
      });

      sendAuthSuccess(res, merchant, store);
    } catch (err: any) {
      console.error('Signup error');
      res.status(500).json({ error: 'Failed to create account' });
    }
  });

  // Login: verifies credentials, establishes HttpOnly session cookie.
  app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const merchant = await prisma.merchant.findUnique({ where: { email }, include: { store: true } });
      if (!merchant || !merchant.store) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Google-only accounts have no password — treat as invalid credentials.
      if (!merchant.passwordHash) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const valid = await bcrypt.compare(password, merchant.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      sendAuthSuccess(res, merchant, merchant.store);
    } catch (err: any) {
      console.error('Login error');
      res.status(500).json({ error: 'Failed to log in' });
    }
  });

  // Invalidate the current session by bumping Merchant.tokenVersion and clearing the cookie.
  app.post('/api/auth/logout', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await prisma.merchant.update({
        where: { id: req.auth!.merchantId },
        data: { tokenVersion: { increment: 1 } },
      });
      clearSessionCookie(res);
      res.json({ success: true });
    } catch {
      console.error('Logout error');
      res.status(500).json({ error: 'Failed to log out' });
    }
  });

  // Google OAuth — step 1: redirect the browser to Google's consent page
  app.get('/api/auth/google/connect', (_req, res) => {
    try {
      const state = signState({ purpose: 'google_oauth' }, '10m');
      const url = buildGoogleAuthUrl(state);
      res.redirect(url);
    } catch (err: any) {
      console.error('Google connect error:', err);
      res.status(500).json({ error: 'Failed to start Google sign-in' });
    }
  });

  // Google OAuth — step 2: Google redirects here with code + state
  app.get('/api/auth/google/callback', async (req, res) => {
    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const errorRedirect = (msg: string) =>
      res.redirect(`${appUrl}/#login?googleError=${encodeURIComponent(msg)}`);

    try {
      const { code, state } = req.query as { code?: string; state?: string };

      if (!state) return errorRedirect('Missing OAuth state');
      try {
        const statePayload = verifyState<{ purpose: string }>(state);
        if (statePayload.purpose !== 'google_oauth') {
          return errorRedirect('Invalid or expired OAuth state');
        }
      } catch {
        return errorRedirect('Invalid or expired OAuth state');
      }
      if (!code) return errorRedirect('Missing authorization code');

      const profile = await exchangeCodeForProfile(code);

      // Find by googleId first (already linked). Do NOT auto-link by email alone
      // when an existing password-based merchant owns that email.
      let merchant = await prisma.merchant.findUnique({
        where: { googleId: profile.googleId },
        include: { store: true },
      });

      if (!merchant) {
        const byEmail = await prisma.merchant.findUnique({
          where: { email: profile.email },
          include: { store: true },
        });

        if (byEmail) {
          // Password account (or any account) without this googleId — refuse silent link.
          // Generic message: do not reveal whether the email exists.
          return errorRedirect(
            'This Google account cannot be linked automatically. Sign in to your existing account first.',
          );
        }

        const newMerchant = await prisma.merchant.create({
          data: {
            email: profile.email,
            passwordHash: null,
            googleId: profile.googleId,
            name: profile.name,
            avatarUrl: profile.picture,
          },
        });
        const store = await prisma.store.create({
          data: {
            merchantId: newMerchant.id,
            name: `${profile.name}'s Store`,
          },
        });
        merchant = { ...newMerchant, store };
      }

      if (!merchant.store) {
        return errorRedirect('Merchant has no store');
      }

      // One-time opaque exchange code — session JWT never goes in the URL.
      void purgeExpiredOAuthHandoffs();
      const exchangeCode = await createOAuthHandoff({
        purpose: 'google_login',
        merchantId: merchant.id,
        storeId: merchant.store.id,
        payload: { merchantId: merchant.id, storeId: merchant.store.id },
      });
      res.redirect(`${appUrl}/#login?googleCode=${encodeURIComponent(exchangeCode)}`);
    } catch (err: any) {
      console.error('Google callback error');
      errorRedirect('Google sign-in failed');
    }
  });

  // Exchange a one-time Google login code for an HttpOnly session cookie + public profile.
  app.post('/api/auth/google/exchange', async (req, res) => {
    try {
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Authentication failed' });
      }
      const handoff = await consumeOAuthHandoff(code, 'google_login');
      const payload = handoff.payload as { merchantId?: string; storeId?: string } | null;
      const merchantId = payload?.merchantId || handoff.merchantId;
      const storeId = payload?.storeId || handoff.storeId;
      if (!merchantId || !storeId) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        include: { store: true },
      });
      if (!merchant?.store || merchant.store.id !== storeId) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      sendAuthSuccess(res, merchant, merchant.store);
    } catch (err: any) {
      if (err instanceof OAuthHandoffError) {
        return res.status(400).json({ error: 'Authentication failed' });
      }
      console.error('Google exchange error');
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Current merchant profile, scoped by the JWT
  app.get('/api/me', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const merchant = await prisma.merchant.findUnique({
        where: { id: req.auth!.merchantId },
        include: { store: true },
      });
      if (!merchant || !merchant.store) {
        return res.status(404).json({ error: 'Account not found' });
      }
      const { profileComplete, missingFields } = getProfileCompletionStatus(merchant, merchant.store);
      res.json({
        merchant: toPublicMerchant(merchant),
        store: toPublicStore(merchant.store),
        profileComplete,
        missingFields,
      });
    } catch (err: any) {
      console.error('Fetch profile error:', err);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // Update personal profile: name, phone, email, and/or password (requires current password to change it)
  app.patch('/api/me', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { name, phone, email, avatarUrl, currentPassword, password } = req.body;
      const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } });
      if (!merchant) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const data: {
        name?: string;
        phone?: string | null;
        email?: string;
        avatarUrl?: string | null;
        passwordHash?: string;
        tokenVersion?: { increment: number };
      } = {};

      if (name !== undefined) {
        const validName = validateMerchantName(name);
        if (validName === null) return res.status(400).json({ error: 'Invalid name.' });
        data.name = validName;
      }

      if (phone !== undefined) {
        const validPhone = validatePhone(phone);
        if (validPhone === null) return res.status(400).json({ error: 'Invalid phone number.' });
        data.phone = validPhone === '' ? null : validPhone;
      }

      if (typeof avatarUrl === 'string') {
        if (avatarUrl === merchant.avatarUrl) {
          // no-op
        } else if (avatarUrl === '') {
          data.avatarUrl = null;
        } else if (!isLocalAvatarUrl(avatarUrl)) {
          // Only a path produced by our own POST /api/me/avatar upload is accepted here —
          // arbitrary external URLs are rejected outright, not just shape-validated. That
          // upload endpoint is the only legitimate way to set an avatar; letting this PATCH
          // accept any https:// URL would let a merchant's own browser be pointed at an
          // attacker-chosen tracking pixel every time their dashboard header renders it.
          return res.status(400).json({ error: 'Invalid avatar URL.' });
        } else {
          data.avatarUrl = avatarUrl;
        }
      }

      if (typeof email === 'string' && email.trim() && email.trim() !== merchant.email) {
        const emailTaken = await prisma.merchant.findUnique({ where: { email: email.trim() } });
        if (emailTaken) {
          return res.status(409).json({ error: 'An account with this email already exists' });
        }
        data.email = email.trim();
      }

      if (password) {
        if (!merchant.passwordHash) {
          return res.status(400).json({ error: 'This account uses Google sign-in and does not have a password' });
        }
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password is required to set a new password' });
        }
        const valid = await bcrypt.compare(currentPassword, merchant.passwordHash);
        if (!valid) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }
        if (!isPasswordStrongEnough(password)) {
          return res.status(400).json({ error: 'Invalid request.' });
        }
        data.passwordHash = await bcrypt.hash(password, 12);
        // Bump tokenVersion so all other sessions are invalidated after password change
        data.tokenVersion = { increment: 1 };
      }

      const updated = await prisma.merchant.update({ where: { id: merchant.id }, data });

      // Re-issue session cookie with the new tokenVersion so the current browser stays logged in
      if (data.tokenVersion) {
        establishMerchantSession(res, {
          merchantId: updated.id,
          storeId: req.auth!.storeId,
          tv: updated.tokenVersion,
        });
      }

      const store = await prisma.store.findUnique({
        where: { merchantId: updated.id },
        select: { name: true, businessPhone: true, streetAddress: true, city: true, province: true, postalCode: true, country: true },
      });
      const { profileComplete, missingFields } = store
        ? getProfileCompletionStatus(updated, store)
        : { profileComplete: false, missingFields: ['store'] };

      res.json({ merchant: toPublicMerchant(updated), profileComplete, missingFields });
    } catch (err: any) {
      console.error('Update profile error');
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  // Upload a new avatar image (multipart/form-data, field: "avatar")
  app.post('/api/me/avatar', requireAuth, avatarUpload.single('avatar'), async (req: AuthedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
      }
      if (req.file.size > MAX_AVATAR_BYTES) {
        return res.status(400).json({ error: 'Image must be 2 MB or smaller.' });
      }

      const merchantId = req.auth!.merchantId;
      const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant) return res.status(404).json({ error: 'Account not found' });

      const previousAvatarUrl = merchant.avatarUrl;

      let publicUrl: string;
      try {
        publicUrl = await saveAvatarFile(merchantId, req.file.buffer);
      } catch {
        return res.status(400).json({ error: 'Unsupported image format. Use JPEG, PNG, WebP, or GIF.' });
      }

      const updated = await prisma.merchant.update({
        where: { id: merchantId },
        data: { avatarUrl: publicUrl },
      });

      // Delete the old stored file after successful DB update
      await deleteLocalAvatarFile(merchantId, previousAvatarUrl);

      res.json({ merchant: toPublicMerchant(updated) });
    } catch (err: any) {
      console.error('Avatar upload error');
      res.status(500).json({ error: 'Failed to upload avatar' });
    }
  });

  // Remove the avatar (clears DB field and deletes any local file)
  app.delete('/api/me/avatar', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const merchantId = req.auth!.merchantId;
      const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
      if (!merchant) return res.status(404).json({ error: 'Account not found' });

      const previousAvatarUrl = merchant.avatarUrl;
      const updated = await prisma.merchant.update({
        where: { id: merchantId },
        data: { avatarUrl: null },
      });

      await deleteLocalAvatarFile(merchantId, previousAvatarUrl);

      res.json({ merchant: toPublicMerchant(updated) });
    } catch (err: any) {
      console.error('Avatar delete error');
      res.status(500).json({ error: 'Failed to remove avatar' });
    }
  });

  // Update business / store information
  app.patch('/api/me/store', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const merchantId = req.auth!.merchantId;
      const store = await prisma.store.findUnique({ where: { merchantId } });
      if (!store) return res.status(404).json({ error: 'Store not found' });

      const validated = validateStoreBusinessInput(req.body, { allowHttp: !isProduction });
      if (validated === null) {
        return res.status(400).json({ error: 'Invalid store information.' });
      }

      // Normalize empty strings to null for optional fields
      const data: Record<string, string | null> = {};
      for (const [key, val] of Object.entries(validated)) {
        if (val !== undefined) {
          data[key] = val === '' ? null : val;
        }
      }

      const updated = await prisma.store.update({
        where: { merchantId },
        data,
      });

      const merchant = await prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { name: true, email: true, phone: true },
      });
      const { profileComplete, missingFields } = merchant
        ? getProfileCompletionStatus(merchant, updated)
        : { profileComplete: false, missingFields: ['merchant'] };

      res.json({ store: toPublicStore(updated), profileComplete, missingFields });
    } catch (err: any) {
      console.error('Update store error');
      res.status(500).json({ error: 'Failed to update business information' });
    }
  });

  // Complete onboarding: atomic update of both merchant and store required fields.
  // Accessible even when profile is incomplete (onboarding allowlist).
  app.post('/api/me/complete-profile', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const merchantId = req.auth!.merchantId;

      const result = validateOnboardingInput(req.body, { allowHttp: !isProduction });
      if ('fieldErrors' in result) {
        return res.status(400).json({ error: 'Validation failed.', fieldErrors: result.fieldErrors });
      }

      const { merchant: mData, store: sData } = result.data;

      const [updatedMerchant, updatedStore] = await prisma.$transaction([
        prisma.merchant.update({
          where: { id: merchantId },
          data: { name: mData.name, phone: mData.phone },
        }),
        prisma.store.update({
          where: { merchantId },
          data: {
            name: sData.name,
            businessPhone: sData.businessPhone,
            streetAddress: sData.streetAddress,
            city: sData.city,
            province: sData.province,
            postalCode: sData.postalCode,
            country: sData.country,
            website: sData.website || null,
          },
        }),
      ]);

      const { profileComplete, missingFields } = getProfileCompletionStatus(updatedMerchant, updatedStore);

      res.json({
        merchant: toPublicMerchant(updatedMerchant),
        store: toPublicStore(updatedStore),
        profileComplete,
        missingFields,
      });
    } catch (err: any) {
      console.error('Complete profile error');
      res.status(500).json({ error: 'Failed to save profile.' });
    }
  });


  function getFacebookRedirectUri(): string {
    return `${process.env.APP_URL}/api/channels/facebook/callback`;
  }

  function getShopifyRedirectUri(): string {
    return `${process.env.APP_URL}/api/channels/shopify/callback`;
  }

  async function finalizeFacebookConnection(storeId: string, page: ManagedPage) {
    await assertChannelExternalIdAvailable('FACEBOOK', page.id, storeId);
    if (page.instagram_business_account?.id) {
      await assertChannelExternalIdAvailable('INSTAGRAM', page.instagram_business_account.id, storeId);
    }

    const credentials = { token: encryptSecret(page.access_token), name: page.name };
    try {
      await prisma.channel.upsert({
        where: { storeId_type: { storeId, type: 'FACEBOOK' } },
        update: { connected: true, externalId: page.id, credentials },
        create: { storeId, type: 'FACEBOOK', connected: true, externalId: page.id, credentials },
      });

      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;
        const igCredentials = { token: encryptSecret(page.access_token), name: `@${page.name}` };
        await prisma.channel.upsert({
          where: { storeId_type: { storeId, type: 'INSTAGRAM' } },
          update: { connected: true, externalId: igId, credentials: igCredentials },
          create: { storeId, type: 'INSTAGRAM', connected: true, externalId: igId, credentials: igCredentials },
        });
      }
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ChannelOwnershipError();
      }
      throw err;
    }

    try {
      await subscribePageWebhook(page.id, page.access_token);
    } catch (err) {
      console.error('Failed to auto-subscribe Facebook Page webhook');
    }
  }

  async function finalizeWhatsAppConnection(storeId: string, numberObj: { id: string; display_phone_number: string; token: string }) {
    await assertChannelExternalIdAvailable('WHATSAPP', numberObj.id, storeId);

    const credentials = {
      token: encryptSecret(numberObj.token),
      phoneNumberId: numberObj.id,
      phoneNumber: numberObj.display_phone_number,
    };
    try {
      await prisma.channel.upsert({
        where: { storeId_type: { storeId, type: 'WHATSAPP' } },
        update: { connected: true, externalId: numberObj.id, credentials },
        create: { storeId, type: 'WHATSAPP', connected: true, externalId: numberObj.id, credentials },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ChannelOwnershipError();
      }
      throw err;
    }
  }

  function normalizeShopifyDomain(domain: string): string {
    return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
  }

  // List this store's real channel connections (Facebook & WhatsApp)
  app.get('/api/channels', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const channels = await prisma.channel.findMany({ where: { storeId: req.auth!.storeId } });
      res.json(channels.map((c) => ({
        type: CHANNEL_TYPE_TO_FRONTEND[c.type] || c.type.toLowerCase(),
        connected: c.connected,
        name: (c.credentials as any)?.name || (c.credentials as any)?.phoneNumber || (c.credentials as any)?.phoneNumberId || null,
      })));
    } catch (err: any) {
      console.error('List channels error:', err);
      res.status(500).json({ error: 'Failed to load channels' });
    }
  });

  // Disconnect a channel
  app.delete('/api/channels/:type', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const type = req.params.type.toUpperCase();
      await prisma.channel.updateMany({
        where: { storeId: req.auth!.storeId, type: type as any },
        data: { connected: false, credentials: null, externalId: null },
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error('Disconnect channel error:', err);
      res.status(500).json({ error: 'Failed to disconnect channel' });
    }
  });

  // Connect WhatsApp Business Cloud API with Phone Number ID and Access Token
  app.post('/api/channels/whatsapp/connect', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const { phoneNumberId, accessToken, phoneNumber } = req.body;
      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({ error: 'Phone Number ID and Access Token are required' });
      }

      await assertChannelExternalIdAvailable('WHATSAPP', String(phoneNumberId), req.auth!.storeId);

      const credentials = {
        token: encryptSecret(accessToken),
        phoneNumberId,
        phoneNumber: phoneNumber || null,
      };

      await prisma.channel.upsert({
        where: { storeId_type: { storeId: req.auth!.storeId, type: 'WHATSAPP' } },
        update: { connected: true, externalId: String(phoneNumberId), credentials },
        create: { storeId: req.auth!.storeId, type: 'WHATSAPP', connected: true, externalId: String(phoneNumberId), credentials },
      });

      res.json({ success: true });
    } catch (err: any) {
      if (isChannelOwnershipError(err) || isUniqueConstraintError(err)) {
        return res.status(409).json({ error: CHANNEL_ALREADY_CONNECTED_MESSAGE });
      }
      console.error('Connect WhatsApp channel error');
      res.status(500).json({ error: 'Failed to connect WhatsApp channel' });
    }
  });

  // Enable the website chat widget. No external OAuth/credentials — the store's
  // pre-existing widgetKey (unique, auto-generated at Store creation) is the whole
  // identity. Connecting just flips the Channel row on so /api/widget/* will respond
  // and the conversation shows up in the Inbox (visibleConversations gates on this).
  app.post('/api/channels/widget/connect', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const store = await prisma.store.findUnique({ where: { id: req.auth!.storeId } });
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      await prisma.channel.upsert({
        where: { storeId_type: { storeId: req.auth!.storeId, type: 'WIDGET' } },
        update: { connected: true },
        create: { storeId: req.auth!.storeId, type: 'WIDGET', connected: true },
      });

      res.json({ success: true, widgetKey: store.widgetKey });
    } catch (err: any) {
      console.error('Connect widget channel error');
      res.status(500).json({ error: 'Failed to connect website widget' });
    }
  });

  // Connect a Shopify store via a merchant-supplied custom-app Admin API access
  // token (not a public OAuth app — see ShopifySetup.md). Verifies the credentials
  // actually work against the real store before saving anything.
  app.post('/api/channels/shopify/connect', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const { domain, accessToken } = req.body;
      if (!domain || !accessToken) {
        return res.status(400).json({ error: 'Store domain and Admin API access token are required' });
      }

      const shop = await verifyShopifyStore(domain, accessToken);
      const normalizedDomain = normalizeShopifyDomain(domain);
      await assertChannelExternalIdAvailable('SHOPIFY', normalizedDomain, req.auth!.storeId);

      const credentials = {
        token: encryptSecret(accessToken),
        domain: normalizedDomain,
        name: shop.name,
      };

      await prisma.channel.upsert({
        where: { storeId_type: { storeId: req.auth!.storeId, type: 'SHOPIFY' } },
        update: { connected: true, externalId: normalizedDomain, credentials },
        create: { storeId: req.auth!.storeId, type: 'SHOPIFY', connected: true, externalId: normalizedDomain, credentials },
      });

      res.json({ success: true, name: shop.name });
    } catch (err: any) {
      if (isChannelOwnershipError(err) || isUniqueConstraintError(err)) {
        return res.status(409).json({ error: CHANNEL_ALREADY_CONNECTED_MESSAGE });
      }
      console.error('Connect Shopify channel error');
      res.status(400).json({ error: 'Unable to connect integration' });
    }
  });

  // Connect a WooCommerce store via Consumer Key & Consumer Secret
  app.post('/api/channels/woocommerce/connect', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const { url, consumerKey, consumerSecret } = req.body;
      if (!url || !consumerKey || !consumerSecret) {
        return res.status(400).json({ error: 'Store URL, Consumer Key, and Consumer Secret are required' });
      }

      const shop = await verifyWooCommerceStore(url, consumerKey, consumerSecret);
      const normalizedUrl = normalizeWooUrl(url);
      await assertChannelExternalIdAvailable('WOOCOMMERCE', normalizedUrl, req.auth!.storeId);

      const credentials = {
        consumerKey: encryptSecret(consumerKey.trim()),
        consumerSecret: encryptSecret(consumerSecret.trim()),
        url: normalizedUrl,
        name: shop.name,
      };

      await prisma.channel.upsert({
        where: { storeId_type: { storeId: req.auth!.storeId, type: 'WOOCOMMERCE' } },
        update: { connected: true, externalId: normalizedUrl, credentials },
        create: { storeId: req.auth!.storeId, type: 'WOOCOMMERCE', connected: true, externalId: normalizedUrl, credentials },
      });

      res.json({ success: true, name: shop.name });
    } catch (err: any) {
      if (isChannelOwnershipError(err) || isUniqueConstraintError(err)) {
        return res.status(409).json({ error: CHANNEL_ALREADY_CONNECTED_MESSAGE });
      }
      console.error('Connect WooCommerce channel error:', err?.message || err);
      res.status(400).json({ error: err?.message || 'Unable to connect WooCommerce store' });
    }
  });

  // Pulls latest products from connected WooCommerce store and upserts into product catalog
  app.post('/api/channels/woocommerce/sync', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const channel = await prisma.channel.findUnique({
        where: { storeId_type: { storeId: req.auth!.storeId, type: 'WOOCOMMERCE' } },
      });
      if (!channel?.connected || !channel.credentials) {
        return res.status(400).json({ error: 'WooCommerce is not connected' });
      }

      const { consumerKey, consumerSecret, url } = channel.credentials as { consumerKey: string; consumerSecret: string; url: string };
      const ck = decryptSecret(consumerKey);
      const cs = decryptSecret(consumerSecret);
      const wooProducts = await fetchWooCommerceProducts(url, ck, cs);

      let created = 0;
      let updated = 0;
      for (const p of wooProducts) {
        const existing = await prisma.product.findUnique({
          where: { storeId_sku: { storeId: req.auth!.storeId, sku: p.sku } },
        });
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: p.name,
              price: p.price,
              inventory: p.inventory,
              externalId: p.externalId,
              ...(p.description !== undefined ? { description: p.description } : {}),
              ...(p.imageUrl !== undefined ? { imageUrl: p.imageUrl } : {}),
              ...(p.rawAttributes !== undefined ? { rawAttributes: p.rawAttributes } : {}),
            },
          });
          updated++;
        } else {
          await prisma.product.create({
            data: {
              storeId: req.auth!.storeId,
              name: p.name,
              sku: p.sku,
              price: p.price,
              inventory: p.inventory,
              externalId: p.externalId,
              description: p.description || null,
              imageUrl: p.imageUrl || null,
              rawAttributes: p.rawAttributes || null,
              status: 'TRAINED',
            },
          });
          created++;
        }
      }

      res.json({ success: true, created, updated, total: wooProducts.length });
    } catch (err: any) {
      console.error('WooCommerce sync error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Unable to sync WooCommerce products' });
    }
  });

  // Pulls the latest products from the connected Shopify store and upserts them into
  // this store's catalog, matching on SKU. A manual action (button click), not a
  // background job — simplest thing that works for a beta-scale catalog.
  app.post('/api/channels/shopify/sync', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const channel = await prisma.channel.findUnique({
        where: { storeId_type: { storeId: req.auth!.storeId, type: 'SHOPIFY' } },
      });
      if (!channel?.connected || !channel.credentials) {
        return res.status(400).json({ error: 'Shopify is not connected' });
      }

      const { token, domain } = channel.credentials as { token: string; domain: string };
      const accessToken = decryptSecret(token);
      const shopifyProducts = await fetchShopifyProducts(domain, accessToken);

      let created = 0;
      let updated = 0;
      for (const p of shopifyProducts) {
        const existing = await prisma.product.findUnique({
          where: { storeId_sku: { storeId: req.auth!.storeId, sku: p.sku } },
        });
        if (existing) {
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: p.name,
              price: p.price,
              inventory: p.inventory,
              externalId: p.externalId,
              ...(p.description !== undefined ? { description: p.description } : {}),
              ...(p.imageUrl !== undefined ? { imageUrl: p.imageUrl } : {}),
              ...(p.rawAttributes !== undefined ? { rawAttributes: p.rawAttributes } : {}),
            },
          });
          updated++;
        } else {
          await prisma.product.create({
            data: {
              storeId: req.auth!.storeId,
              name: p.name,
              sku: p.sku,
              price: p.price,
              inventory: p.inventory,
              externalId: p.externalId,
              description: p.description || null,
              imageUrl: p.imageUrl || null,
              rawAttributes: p.rawAttributes || null,
              status: 'TRAINED',
            },
          });
          created++;
        }
      }

      res.json({ success: true, created, updated, total: shopifyProducts.length });
    } catch (err: any) {
      console.error('Shopify sync error:', err);
      res.status(500).json({ error: 'Unable to connect integration' });
    }
  });

  // Mint a short-lived opaque Shopify connect code (session JWT never goes in the URL).
  app.post('/api/channels/shopify/prepare', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const domain = typeof req.body?.domain === 'string' ? req.body.domain.trim() : '';
      if (!domain) {
        return res.status(400).json({ error: 'Store domain is required' });
      }
      void purgeExpiredOAuthHandoffs();
      const code = await createOAuthHandoff({
        purpose: 'shopify_connect',
        storeId: req.auth!.storeId,
        merchantId: req.auth!.merchantId,
        payload: { domain },
      });
      res.json({ code });
    } catch (err) {
      console.error('Shopify prepare error');
      res.status(500).json({ error: 'Unable to connect integration' });
    }
  });

  // Start the Shopify OAuth flow using a one-time opaque connect code.
  app.get('/api/channels/shopify/connect', async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) return res.status(401).send('Missing connect code');
      const handoff = await consumeOAuthHandoff(code, 'shopify_connect');
      const domain = (handoff.payload as { domain?: string } | null)?.domain;
      if (!handoff.storeId || !domain) {
        return res.status(400).send('Invalid connect code');
      }

      const state = signState({ storeId: handoff.storeId, purpose: 'shopify_oauth' }, '10m');
      const url = getShopifyOAuthUrl(domain, getShopifyRedirectUri(), state);
      res.redirect(url);
    } catch (err) {
      console.error('Shopify connect error');
      res.status(401).send('Invalid or expired session. Please log in again and retry.');
    }
  });

  // Shopify redirects here after the merchant approves (or denies) access.
  app.get('/api/channels/shopify/callback', async (req, res) => {
    const frontendBase = process.env.APP_URL || '';
    try {
      const { code, state, shop, error: oauthError } = req.query as {
        code?: string; state?: string; shop?: string; error?: string;
      };
      if (oauthError || !code || !state || !shop) {
        return res.redirect(`${frontendBase}/#integrations?shopifyError=denied`);
      }
      if (!verifyShopifyCallbackHmac(req.query as Record<string, string>)) {
        return res.redirect(`${frontendBase}/#integrations?shopifyError=invalid_signature`);
      }

      const statePayload = verifyState<{ storeId: string; purpose?: string }>(state);
      if (statePayload.purpose && statePayload.purpose !== 'shopify_oauth') {
        return res.redirect(`${frontendBase}/#integrations?shopifyError=denied`);
      }
      const { storeId } = statePayload;
      const accessToken = await exchangeShopifyCodeForToken(shop, code);
      const shopInfo = await verifyShopifyStore(shop, accessToken);
      const normalizedDomain = normalizeShopifyDomain(shop);

      await assertChannelExternalIdAvailable('SHOPIFY', normalizedDomain, storeId);

      const credentials = {
        token: encryptSecret(accessToken),
        domain: normalizedDomain,
        name: shopInfo.name,
      };
      try {
        await prisma.channel.upsert({
          where: { storeId_type: { storeId, type: 'SHOPIFY' } },
          update: { connected: true, externalId: normalizedDomain, credentials },
          create: { storeId, type: 'SHOPIFY', connected: true, externalId: normalizedDomain, credentials },
        });
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return res.redirect(`${frontendBase}/#integrations?shopifyError=already_connected`);
        }
        throw err;
      }

      return res.redirect(`${frontendBase}/#integrations?shopifyConnected=1`);
    } catch (err) {
      if (isChannelOwnershipError(err)) {
        return res.redirect(`${frontendBase}/#integrations?shopifyError=already_connected`);
      }
      console.error('Shopify OAuth callback error');
      res.redirect(`${frontendBase}/#integrations?shopifyError=server_error`);
    }
  });

  // Mint a short-lived opaque Facebook connect code (session JWT never goes in the URL).
  app.post('/api/channels/facebook/prepare', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      void purgeExpiredOAuthHandoffs();
      const code = await createOAuthHandoff({
        purpose: 'facebook_connect',
        storeId: req.auth!.storeId,
        merchantId: req.auth!.merchantId,
      });
      res.json({ code });
    } catch (err) {
      console.error('Facebook prepare error');
      res.status(500).json({ error: 'Unable to connect integration' });
    }
  });

  // Start the Facebook OAuth flow using a one-time opaque connect code.
  app.get('/api/channels/facebook/connect', async (req, res) => {
    try {
      const code = req.query.code as string;
      if (!code) return res.status(401).send('Missing connect code');
      const handoff = await consumeOAuthHandoff(code, 'facebook_connect');
      if (!handoff.storeId) {
        return res.status(400).send('Invalid connect code');
      }

      const state = signState({ storeId: handoff.storeId, purpose: 'facebook_oauth' }, '10m');
      const url = getFacebookOAuthUrl(getFacebookRedirectUri(), state);
      res.redirect(url);
    } catch (err) {
      console.error('Facebook connect error');
      res.status(401).send('Invalid or expired session. Please log in again and retry.');
    }
  });

  // Meta redirects here after the merchant approves (or denies) access.
  app.get('/api/channels/facebook/callback', async (req, res) => {
    const frontendBase = process.env.APP_URL || '';
    try {
      const { code, state, error: oauthError } = req.query as { code?: string; state?: string; error?: string };
      if (oauthError || !code || !state) {
        return res.redirect(`${frontendBase}/#integrations?fbError=denied`);
      }

      const statePayload = verifyState<{ storeId: string; purpose?: string }>(state);
      if (statePayload.purpose && statePayload.purpose !== 'facebook_oauth') {
        return res.redirect(`${frontendBase}/#integrations?fbError=denied`);
      }
      const { storeId } = statePayload;
      const redirectUri = getFacebookRedirectUri();
      const userAccessToken = await exchangeCodeForUserToken(code, redirectUri);

      const pages = await listManagedPages(userAccessToken);
      const waAccounts = await listWhatsAppPhoneNumbers(userAccessToken);

      const allWaNumbers: { id: string; display_phone_number: string; name?: string; token: string }[] = [];
      for (const acc of waAccounts) {
        for (const num of acc.phoneNumbers) {
          allWaNumbers.push({
            id: num.id,
            display_phone_number: num.display_phone_number || num.verified_name || num.id,
            name: acc.wabaName,
            token: userAccessToken,
          });
        }
      }

      if (pages.length === 1) {
        await finalizeFacebookConnection(storeId, pages[0]);
      }

      if (allWaNumbers.length === 1) {
        await finalizeWhatsAppConnection(storeId, allWaNumbers[0]);
      }

      // Multi-select: store provider tokens server-side; browser only gets an opaque pending code.
      if (pages.length > 1) {
        const pendingCode = await createOAuthHandoff({
          purpose: 'facebook_pending',
          storeId,
          payload: { pages },
        });
        return res.redirect(`${frontendBase}/#integrations?fbPending=${encodeURIComponent(pendingCode)}`);
      }

      if (allWaNumbers.length > 1) {
        const waPendingCode = await createOAuthHandoff({
          purpose: 'whatsapp_pending',
          storeId,
          payload: { numbers: allWaNumbers },
        });
        return res.redirect(`${frontendBase}/#integrations?waPending=${encodeURIComponent(waPendingCode)}`);
      }

      if (pages.length === 0 && allWaNumbers.length === 0) {
        return res.redirect(`${frontendBase}/#integrations?fbError=no_pages`);
      }

      return res.redirect(`${frontendBase}/#integrations?fbConnected=1&waConnected=1`);
    } catch (err) {
      if (isChannelOwnershipError(err)) {
        return res.redirect(`${frontendBase}/#integrations?fbError=already_connected`);
      }
      console.error('Meta OAuth callback error');
      res.redirect(`${frontendBase}/#integrations?fbError=server_error`);
    }
  });

  // Returns candidate WhatsApp phone numbers for multi-number selection (no tokens).
  app.get('/api/channels/whatsapp/pending', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const pendingCode = (req.query.code || req.query.token) as string;
      const handoff = await peekOAuthHandoff(pendingCode, 'whatsapp_pending');
      if (handoff.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Unable to process request' });
      }
      const numbers = ((handoff.payload as { numbers?: any[] } | null)?.numbers) || [];
      res.json({
        numbers: numbers.map((n) => ({
          id: n.id,
          display_phone_number: n.display_phone_number,
          name: n.name,
        })),
      });
    } catch (err) {
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  // Finalizes WhatsApp connection after merchant picks a number
  app.post('/api/channels/whatsapp/select', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const pendingCode = (req.body.pendingCode || req.body.pendingToken) as string;
      const { phoneNumberId } = req.body;
      // Verify ownership before consuming — otherwise a mismatched-store request burns
      // another store's still-valid pending selection (a one-shot DoS against it).
      const peeked = await peekOAuthHandoff(pendingCode, 'whatsapp_pending');
      if (peeked.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Unable to process request' });
      }
      const handoff = await consumeOAuthHandoff(pendingCode, 'whatsapp_pending');
      const numbers = ((handoff.payload as { numbers?: any[] } | null)?.numbers) || [];
      const num = numbers.find((n) => n.id === phoneNumberId);
      if (!num) {
        return res.status(404).json({ error: 'Phone number not found in this selection' });
      }
      await finalizeWhatsAppConnection(handoff.storeId!, num);
      res.json({ success: true });
    } catch (err) {
      if (isChannelOwnershipError(err) || isUniqueConstraintError(err)) {
        return res.status(409).json({ error: CHANNEL_ALREADY_CONNECTED_MESSAGE });
      }
      console.error('WhatsApp number selection error');
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  // Returns the candidate Pages for a pending multi-page selection (names only).
  app.get('/api/channels/facebook/pending', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const pendingCode = (req.query.code || req.query.token) as string;
      const handoff = await peekOAuthHandoff(pendingCode, 'facebook_pending');
      if (handoff.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Unable to process request' });
      }
      const pages = ((handoff.payload as { pages?: ManagedPage[] } | null)?.pages) || [];
      res.json({ pages: pages.map((p) => ({ id: p.id, name: p.name })) });
    } catch (err) {
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  // Finalizes the connection once the merchant picks a Page from the multi-page list.
  app.post('/api/channels/facebook/select', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const pendingCode = (req.body.pendingCode || req.body.pendingToken) as string;
      const { pageId } = req.body;
      // Verify ownership before consuming — otherwise a mismatched-store request burns
      // another store's still-valid pending selection (a one-shot DoS against it).
      const peeked = await peekOAuthHandoff(pendingCode, 'facebook_pending');
      if (peeked.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Unable to process request' });
      }
      const handoff = await consumeOAuthHandoff(pendingCode, 'facebook_pending');
      const pages = ((handoff.payload as { pages?: ManagedPage[] } | null)?.pages) || [];
      const page = pages.find((p) => p.id === pageId);
      if (!page) {
        return res.status(404).json({ error: 'Page not found in this selection' });
      }
      await finalizeFacebookConnection(handoff.storeId!, page);
      res.json({ success: true });
    } catch (err) {
      if (isChannelOwnershipError(err) || isUniqueConstraintError(err)) {
        return res.status(409).json({ error: CHANNEL_ALREADY_CONNECTED_MESSAGE });
      }
      console.error('Facebook page selection error');
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  const toPublicProduct = (p: { id: string; name: string; sku: string; price: any; inventory: number; status: string; description?: string | null; imageUrl?: string | null; rawAttributes?: any }) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: Number(p.price),
    inventory: p.inventory,
    status: p.status === 'TRAINED' ? 'Trained' : 'Pending',
    description: p.description || undefined,
    imageUrl: p.imageUrl || undefined,
    rawAttributes: (p.rawAttributes && typeof p.rawAttributes === 'object') ? p.rawAttributes : undefined,
  });

  // List this merchant's products & catalog source info
  app.get('/api/products', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const [products, channels] = await Promise.all([
        prisma.product.findMany({
          where: { storeId: req.auth!.storeId },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.channel.findMany({
          where: { storeId: req.auth!.storeId, connected: true },
          select: { type: true },
        }),
      ]);

      const connectedTypes = channels.map(c => c.type);
      const isWebsiteConnected = connectedTypes.includes('SHOPIFY') || connectedTypes.includes('WOOCOMMERCE');

      res.json({
        products: products.map(toPublicProduct),
        isWebsiteConnected,
        connectedChannels: connectedTypes,
      });
    } catch (err: any) {
      console.error('List products error:', err);
      res.status(500).json({ error: 'Failed to load products' });
    }
  });

  // Add a product to this merchant's catalog
  app.post('/api/products', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const validated = validateProductInput(req.body);
      if (!validated) {
        return res.status(400).json({ error: 'Invalid product data.' });
      }

      const existing = await prisma.product.findUnique({
        where: { storeId_sku: { storeId: req.auth!.storeId, sku: validated.sku } },
      });
      if (existing) {
        return res.status(409).json({ error: 'A product with this SKU already exists' });
      }

      const rawAttributes = req.body.rawAttributes && typeof req.body.rawAttributes === 'object' ? req.body.rawAttributes : undefined;

      const product = await prisma.product.create({
        data: {
          storeId: req.auth!.storeId,
          name: validated.name,
          sku: validated.sku,
          price: validated.price,
          inventory: validated.inventory,
          status: validated.status,
          ...(validated.description !== undefined ? { description: validated.description } : {}),
          ...(rawAttributes !== undefined ? { rawAttributes } : {}),
        },
      });
      res.status(201).json(toPublicProduct(product));
    } catch (err: any) {
      console.error('Create product error:', err);
      res.status(500).json({ error: 'Unable to process request' });
    }
  });

  app.patch('/api/products/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const existingProduct = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!existingProduct || existingProduct.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Product not found' });
      }

      const validated = validateProductInput(req.body);
      if (!validated) {
        return res.status(400).json({ error: 'Invalid product data.' });
      }

      if (validated.sku !== existingProduct.sku) {
        const conflict = await prisma.product.findUnique({
          where: { storeId_sku: { storeId: req.auth!.storeId, sku: validated.sku } },
        });
        if (conflict) {
          return res.status(409).json({ error: 'A product with this SKU already exists' });
        }
      }

      const rawAttributes = req.body.rawAttributes && typeof req.body.rawAttributes === 'object' ? req.body.rawAttributes : undefined;

      const updated = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          name: validated.name,
          sku: validated.sku,
          price: validated.price,
          inventory: validated.inventory,
          status: validated.status,
          description: validated.description ?? null,
          ...(rawAttributes !== undefined ? { rawAttributes } : {}),
        },
      });
      res.json(toPublicProduct(updated));
    } catch (err: any) {
      console.error('Update product error:', err);
      res.status(500).json({ error: 'Unable to process request' });
    }
  });

  // Upload a product photo (multipart/form-data, field: "image")
  app.post('/api/products/:id/image', requireAuth, requireProfileComplete, productImageUpload.single('image'), async (req: AuthedRequest, res) => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product || product.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Product not found' });
      }
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
      }

      const storeId = req.auth!.storeId;
      const previousImageUrl = product.imageUrl;

      let publicUrl: string;
      try {
        publicUrl = await saveProductImageFile(storeId, req.file.buffer);
      } catch {
        return res.status(400).json({ error: 'Unsupported image format. Use JPEG, PNG, WebP, or GIF.' });
      }

      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: publicUrl },
      });

      await deleteProductImageFile(storeId, previousImageUrl);

      res.json(toPublicProduct(updated));
    } catch (err: any) {
      console.error('Product image upload error');
      res.status(500).json({ error: 'Failed to upload product image' });
    }
  });

  // Remove a product's photo
  app.delete('/api/products/:id/image', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product || product.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Product not found' });
      }
      const previousImageUrl = product.imageUrl;
      const updated = await prisma.product.update({
        where: { id: product.id },
        data: { imageUrl: null },
      });
      await deleteProductImageFile(req.auth!.storeId, previousImageUrl);
      res.json(toPublicProduct(updated));
    } catch (err: any) {
      console.error('Product image delete error');
      res.status(500).json({ error: 'Failed to remove product image' });
    }
  });

  // Remove a product from this merchant's catalog
  app.delete('/api/products/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product || product.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Product not found' });
      }
      await prisma.product.delete({ where: { id: product.id } });
      await deleteProductImageFile(req.auth!.storeId, product.imageUrl);
      res.status(204).end();
    } catch (err: any) {
      console.error('Delete product error:', err);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  const toPublicOrder = (o: { id: string; conversationId: string | null; items: any; customerName: string; address: string; status: string; total: any; createdAt: Date }) => {
    let publicStatus: 'Processing' | 'On the Way' | 'Delivered' | 'Cancelled' = 'Processing';
    if (o.status === 'ON_THE_WAY') publicStatus = 'On the Way';
    else if (o.status === 'DELIVERED') publicStatus = 'Delivered';
    else if (o.status === 'CANCELLED') publicStatus = 'Cancelled';
    return {
      id: o.id,
      conversationId: o.conversationId,
      items: o.items,
      customerName: o.customerName,
      address: o.address,
      status: publicStatus,
      total: Number(o.total),
      createdAt: o.createdAt,
    };
  };

  // List this store's orders
  app.get('/api/orders', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const orders = await prisma.order.findMany({
        where: { storeId: req.auth!.storeId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(orders.map(toPublicOrder));
    } catch (err: any) {
      console.error('List orders error:', err);
      res.status(500).json({ error: 'Failed to load orders' });
    }
  });

  // Update an order's status
  app.patch('/api/orders/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const { status } = req.body;
      const statusMap: Record<string, 'PROCESSING' | 'ON_THE_WAY' | 'DELIVERED' | 'CANCELLED'> = {
        'Processing': 'PROCESSING',
        'On the Way': 'ON_THE_WAY',
        'Delivered': 'DELIVERED',
        'Cancelled': 'CANCELLED',
      };
      const mapped = statusMap[status];
      if (!mapped) return res.status(400).json({ error: 'Invalid status' });

      const order = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order || order.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Business Rule: Restrict cancelling delivered orders
      if (order.status === 'DELIVERED' && mapped === 'CANCELLED') {
        return res.status(400).json({ error: 'Delivered orders cannot be cancelled.' });
      }

      // If transitioning to CANCELLED from a non-cancelled state, restore inventory
      if (mapped === 'CANCELLED' && order.status !== 'CANCELLED') {
        await prisma.$transaction(async (tx) => {
          const items = (order.items as any[]) || [];
          for (const item of items) {
            if (item.sku && item.quantity > 0) {
              await tx.product.updateMany({
                where: { storeId: order.storeId, sku: item.sku },
                data: { inventory: { increment: item.quantity } },
              });
            }
          }
          await tx.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
        });
        const updatedOrder = await prisma.order.findUnique({ where: { id: order.id } });
        return res.json(toPublicOrder(updatedOrder!));
      }

      const updated = await prisma.order.update({ where: { id: order.id }, data: { status: mapped } });
      res.json(toPublicOrder(updated));
    } catch (err: any) {
      console.error('Update order error:', err);
      res.status(500).json({ error: 'Failed to update order' });
    }
  });


  app.post('/api/conversations/:id/orders', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
      if (!conversation || conversation.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const cart: { sku: string; quantity: number }[] = (conversation.cart as any) || [];
      if (cart.length === 0) {
        return res.status(400).json({ error: 'This conversation has no items in its cart yet' });
      }

      const { address } = req.body;
      if (!address || !address.trim()) {
        return res.status(400).json({ error: 'A shipping address is required' });
      }

      const order = await createOrderForConversation(conversation, cart, address, req.body.customerName);
      res.status(201).json(toPublicOrder(order));
    } catch (err: any) {
      if (err?.code === 'INSUFFICIENT_STOCK') {
        return res.status(409).json({ error: 'Insufficient stock to create this order' });
      }
      console.error('Create order error:', err);
      res.status(500).json({ error: 'Unable to process request' });
    }
  });

  // Analytics: aggregated metrics for the authenticated merchant's store.
  // Returns a day-by-day series (suitable for the existing Recharts AreaChart),
  // summary KPIs, and a combined recent-activity feed — all scoped to the JWT
  // store. No schema changes are required; data is derived at query time.
  //
  // GET /api/analytics?range=30   (default)
  // GET /api/analytics?range=90
  app.get('/api/analytics', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const storeId = req.auth!.storeId;

      // Accept 30 or 90; anything else (including missing) defaults to 30.
      const rawRange = Number(req.query.range);
      const range: 30 | 90 = rawRange === 90 ? 90 : 30;

      // Inclusive start boundary: midnight `range` days ago in UTC.
      const start = new Date();
      start.setUTCDate(start.getUTCDate() - range);
      start.setUTCHours(0, 0, 0, 0);

      // ------------------------------------------------------------------
      // Parallel fetch — one round-trip for each logical data category.
      // All queries are scoped to storeId; none load full message bodies.
      // ------------------------------------------------------------------
      // Previous period of equal length, immediately preceding `start` — used only
      // to compute order-count growth (no series/activity uses this window).
      const prevStart = new Date(start);
      prevStart.setUTCDate(prevStart.getUTCDate() - range);

      const [
        conversationsInRange,
        ordersInRange,
        aiMessageCount,
        recentOrders,
        recentComplaints,
        lowStockProducts,
        responseTimeMessages,
        prevPeriodOrderCount,
        prevPeriodConversations,
      ] = await Promise.all([
        // Slim conversation rows: only the fields needed for series + KPIs.
        prisma.conversation.findMany({
          where: { storeId, createdAt: { gte: start } },
          select: { createdAt: true, status: true, isComplaint: true },
        }),

        // Slim order rows: enough for series bucketing + revenue aggregation.
        prisma.order.findMany({
          where: { storeId, createdAt: { gte: start } },
          select: { createdAt: true, status: true, total: true },
        }),

        // AI message count — scoped via the conversation relation so we never
        // load message text, and we stay within the authenticated store.
        prisma.message.count({
          where: {
            sender: 'AI',
            createdAt: { gte: start },
            conversation: { storeId },
          },
        }),

        // Activity feed: recent orders (not range-filtered — latest overall).
        prisma.order.findMany({
          where: { storeId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: { id: true, customerName: true, total: true, status: true, createdAt: true },
        }),

        // Activity feed: recent complaint conversations.
        prisma.conversation.findMany({
          where: { storeId, isComplaint: true },
          orderBy: { lastMessageAt: 'desc' },
          take: 10,
          select: { id: true, customerName: true, channelType: true, lastMessageAt: true },
        }),

        // Activity feed: low-stock products — same threshold (< 10) as
        // /api/notifications so merchant sees a consistent picture across the app.
        prisma.product.findMany({
          where: { storeId, inventory: { lt: 10 } },
          orderBy: { inventory: 'asc' },
          take: 10,
          select: { id: true, name: true, inventory: true },
        }),

        // Every message in range, ordered so first-reply latency can be paired up
        // per conversation in a single pass below. Only pending: false messages
        // count as a "reply" — an unapproved AI draft was never actually delivered.
        prisma.message.findMany({
          where: { conversation: { storeId }, createdAt: { gte: start } },
          orderBy: [{ conversationId: 'asc' }, { createdAt: 'asc' }],
          select: { conversationId: true, sender: true, createdAt: true, pending: true },
        }),

        prisma.order.count({ where: { storeId, createdAt: { gte: prevStart, lt: start } } }),

        prisma.conversation.findMany({
          where: { storeId, createdAt: { gte: prevStart, lt: start } },
          select: { status: true },
        }),
      ]);

      // ------------------------------------------------------------------
      // Series: one entry per calendar day in [start, today].
      // Both conversations and FULFILLED orders (verified as the only
      // "completed" OrderStatus in this project — schema: PENDING | FULFILLED
      // | CANCELLED; creation always writes PENDING; the merchant promotes to
      // FULFILLED via PATCH /api/orders/:id) are bucketed by their UTC date.
      //
      // If the store has no data at all we return series: [] (empty state).
      // ------------------------------------------------------------------
      const hasData = conversationsInRange.length > 0 || ordersInRange.length > 0;

      // Helper: ISO date string key e.g. "2024-10-14" from a Date.
      const dayKey = (d: Date) => d.toISOString().slice(0, 10);

      // Helper: human-readable label matching the mock style ("Oct 14").
      const dayLabel = (isoKey: string) => {
        const d = new Date(`${isoKey}T00:00:00Z`);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
      };

      let series: { date: string; conversations: number; convertedSales: number }[] = [];

      if (hasData) {
        // Build a map of all days in the window → zero counts.
        const dayMap = new Map<string, { conversations: number; convertedSales: number }>();
        const cursor = new Date(start);
        const today = new Date();
        while (cursor <= today) {
          dayMap.set(dayKey(cursor), { conversations: 0, convertedSales: 0 });
          cursor.setUTCDate(cursor.getUTCDate() + 1);
        }

        // Bucket conversations.
        for (const c of conversationsInRange) {
          const key = dayKey(c.createdAt);
          const entry = dayMap.get(key);
          if (entry) entry.conversations += 1;
        }

        // Bucket converted sales — DELIVERED orders only.
        for (const o of ordersInRange) {
          if (o.status === 'DELIVERED') {
            const key = dayKey(o.createdAt);
            const entry = dayMap.get(key);
            if (entry) entry.convertedSales += 1;
          }
        }

        series = Array.from(dayMap.entries()).map(([key, counts]) => ({
          date: dayLabel(key),
          ...counts,
        }));
      }

      // ------------------------------------------------------------------
      // KPIs
      // ------------------------------------------------------------------

      // Automation rate: % of in-range conversations handled by AI.
      const totalConvs = conversationsInRange.length;
      const aiManagedCount = conversationsInRange.filter(c => c.status === 'AI_MANAGED').length;
      const automationRate = totalConvs > 0 ? Math.round((aiManagedCount / totalConvs) * 100) : 0;

      // Automation rate delta vs. the immediately preceding period of equal length.
      // Null when there were no conversations at all in that prior window.
      const prevTotalConvs = prevPeriodConversations.length;
      const prevAutomationRate = prevTotalConvs > 0
        ? Math.round((prevPeriodConversations.filter(c => c.status === 'AI_MANAGED').length / prevTotalConvs) * 100)
        : null;
      const automationRateDeltaPoints = prevAutomationRate !== null ? automationRate - prevAutomationRate : null;

      // Average first-reply latency: for each conversation, pair its first CUSTOMER
      // message with the next actually-delivered (pending: false) AI or MERCHANT
      // message that follows it, then average the gap across conversations that
      // have both. Conversations with no reply yet (or a reply still awaiting
      // merchant approval) are excluded rather than counted as instant/zero.
      const responseTimesMs: number[] = [];
      {
        let i = 0;
        while (i < responseTimeMessages.length) {
          const conversationId = responseTimeMessages[i].conversationId;
          let j = i;
          while (j < responseTimeMessages.length && responseTimeMessages[j].conversationId === conversationId) j++;
          const thread = responseTimeMessages.slice(i, j);

          const firstCustomerMsg = thread.find(m => m.sender === 'CUSTOMER');
          if (firstCustomerMsg) {
            const reply = thread.find(m =>
              m.sender !== 'CUSTOMER' && !m.pending && m.createdAt > firstCustomerMsg.createdAt
            );
            if (reply) {
              responseTimesMs.push(reply.createdAt.getTime() - firstCustomerMsg.createdAt.getTime());
            }
          }
          i = j;
        }
      }
      const averageResponseTimeSeconds = responseTimesMs.length > 0
        ? Math.round((responseTimesMs.reduce((sum, ms) => sum + ms, 0) / responseTimesMs.length) / 1000)
        : null;

      const orderCount = ordersInRange.length;

      // Order uplift: % change in order count vs. the immediately preceding period
      // of equal length. Null (not 0% or Infinity) when there's no prior-period
      // baseline to compare against, so the frontend can show "New" honestly.
      const orderUpliftPercent = prevPeriodOrderCount > 0
        ? Math.round(((orderCount - prevPeriodOrderCount) / prevPeriodOrderCount) * 1000) / 10
        : null;

      // Revenue: sum of all order totals in range regardless of status, so
      // merchants see gross committed revenue, not just fulfilled orders.
      const revenue = ordersInRange.reduce((sum, o) => sum + Number(o.total), 0);

      const complaints = conversationsInRange.filter(c => c.isComplaint).length;

      // ------------------------------------------------------------------
      // Recent activity: merge orders, complaints, and low-stock alerts
      // into one consistent array, sorted newest-first, capped at 10 items.
      // ------------------------------------------------------------------

      // Map order status enum back to the display value already used across
      // the project (same logic as toPublicOrder above).
      const orderStatusLabel = (s: string) =>
        s === 'DELIVERED' ? 'Delivered' : s === 'CANCELLED' ? 'Cancelled' : s === 'ON_THE_WAY' ? 'On the Way' : 'Processing';

      const activityItems: {
        id: string;
        type: 'order' | 'complaint' | 'inventory';
        title: string;
        body: string;
        time: string | null;
      }[] = [
        ...recentOrders.map(o => ({
          id: `order-${o.id}`,
          type: 'order' as const,
          title: `Order`,
          body: `${o.customerName} · $${Number(o.total).toFixed(2)} · ${orderStatusLabel(o.status)}`,
          time: o.createdAt.toISOString(),
        })),
        ...recentComplaints.map(c => ({
          id: `complaint-${c.id}`,
          type: 'complaint' as const,
          title: 'Complaint',
          body: `${c.customerName || 'A customer'} via ${c.channelType.toLowerCase()}`,
          time: c.lastMessageAt.toISOString(),
        })),
        // Inventory alerts have no meaningful timestamp; they sort after timed items.
        ...lowStockProducts.map(p => ({
          id: `inventory-${p.id}`,
          type: 'inventory' as const,
          title: 'Inventory Alert',
          body: `${p.name} is running low (${p.inventory} unit${p.inventory === 1 ? '' : 's'} left)`,
          time: null,
        })),
      ];

      // Sort: timed items newest-first; null-time items always last.
      activityItems.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });

      const recentActivity = activityItems.slice(0, 10);

      // ------------------------------------------------------------------
      // Response
      // ------------------------------------------------------------------
      res.json({
        range,
        series,
        kpis: {
          automationRate,
          automationRateDeltaPoints,
          averageResponseTimeSeconds,
          orderCount,
          orderUpliftPercent,
          revenue: Math.round(revenue * 100) / 100,
          aiMessages: aiMessageCount,
          complaints,
        },
        recentActivity,
      });
    } catch (err: any) {
      console.error('Analytics error:', err);
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  });

  // Get this store's AI persona
  app.get('/api/persona', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const store = await prisma.store.findUnique({ where: { id: req.auth!.storeId } });
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      res.json({
        tone: store.tone,
        style: store.style,
        customInstructions: store.customInstructions,
        autoFinalizeOrdersAlways: store.autoFinalizeOrdersAlways,
        openingText: store.openingText || '',
        openingImageUrl: store.openingImageUrl || undefined,
      });
    } catch (err: any) {
      console.error('Fetch persona error:', err);
      res.status(500).json({ error: 'Failed to load persona' });
    }
  });

  // Update this store's AI persona
  app.put('/api/persona', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const validated = validatePersonaInput(req.body);
      if (!validated) {
        return res.status(400).json({ error: 'Invalid request.' });
      }
      const store = await prisma.store.update({
        where: { id: req.auth!.storeId },
        data: {
          tone: validated.tone,
          style: validated.style,
          customInstructions: validated.customInstructions,
          autoFinalizeOrdersAlways: validated.autoFinalizeOrdersAlways,
          openingText: validated.openingText,
        },
      });
      res.json({
        tone: store.tone,
        style: store.style,
        customInstructions: store.customInstructions,
        autoFinalizeOrdersAlways: store.autoFinalizeOrdersAlways,
        openingText: store.openingText || '',
        openingImageUrl: store.openingImageUrl || undefined,
      });
    } catch (err: any) {
      console.error('Update persona error:', err);
      res.status(500).json({ error: 'Failed to update persona' });
    }
  });

  // Upload the opening-greeting photo (multipart/form-data, field: "image")
  app.post('/api/persona/opening-image', requireAuth, requireProfileComplete, openingImageUpload.single('image'), async (req: AuthedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided.' });
      }
      const storeId = req.auth!.storeId;
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      const previousImageUrl = store.openingImageUrl;
      let publicUrl: string;
      try {
        publicUrl = await saveOpeningImageFile(storeId, req.file.buffer);
      } catch {
        return res.status(400).json({ error: 'Unsupported image format. Use JPEG, PNG, WebP, or GIF.' });
      }
      const updated = await prisma.store.update({ where: { id: storeId }, data: { openingImageUrl: publicUrl } });
      await deleteOpeningImageFile(storeId, previousImageUrl);
      res.json({ openingImageUrl: updated.openingImageUrl || undefined });
    } catch (err: any) {
      console.error('Opening image upload error');
      res.status(500).json({ error: 'Failed to upload greeting image' });
    }
  });

  // Remove the opening-greeting photo
  app.delete('/api/persona/opening-image', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const storeId = req.auth!.storeId;
      const store = await prisma.store.findUnique({ where: { id: storeId } });
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      const previousImageUrl = store.openingImageUrl;
      await prisma.store.update({ where: { id: storeId }, data: { openingImageUrl: null } });
      await deleteOpeningImageFile(storeId, previousImageUrl);
      res.json({ openingImageUrl: undefined });
    } catch (err: any) {
      console.error('Opening image delete error');
      res.status(500).json({ error: 'Failed to remove greeting image' });
    }
  });



  // Derived, real-time notifications: unread/complaint conversations + low-stock products.
  // Computed on the fly rather than stored, since these all resolve naturally elsewhere
  // (opening a conversation marks it read; restocking a product clears its low-stock alert).
  app.get('/api/notifications', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const storeId = req.auth!.storeId;
      const [conversations, lowStockProducts] = await Promise.all([
        prisma.conversation.findMany({
          where: { storeId },
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
          orderBy: { lastMessageAt: 'desc' },
          take: 20,
        }),
        prisma.product.findMany({ where: { storeId, inventory: { lt: 10 } }, orderBy: { inventory: 'asc' } }),
      ]);

      const notifications: any[] = [];

      for (const c of conversations) {
        const last = c.messages[0];
        if (last && last.sender === 'CUSTOMER') {
          notifications.push({
            id: `msg-${c.id}`,
            type: 'message',
            title: c.isComplaint ? 'Complaint Needs Attention' : 'New Message',
            body: `${c.customerName || 'A customer'}: "${last.text.slice(0, 60)}"`,
            time: last.createdAt,
            platform: CHANNEL_TO_PLATFORM[c.channelType] || 'websocket',
          });
        }
      }

      for (const p of lowStockProducts) {
        notifications.push({
          id: `stock-${p.id}`,
          type: 'inventory',
          title: 'Inventory Alert',
          body: `${p.name} is running low (${p.inventory} unit${p.inventory === 1 ? '' : 's'} left)`,
          time: null,
          platform: 'system',
        });
      }

      notifications.sort((a, b) => {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return new Date(b.time).getTime() - new Date(a.time).getTime();
      });

      res.json(notifications.slice(0, 15));
    } catch (err: any) {
      console.error('Fetch notifications error:', err);
      res.status(500).json({ error: 'Failed to load notifications' });
    }
  });

  // List this store's conversations across all channels
  app.get('/api/conversations', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { storeId: req.auth!.storeId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
        orderBy: { lastMessageAt: 'desc' },
      });
      res.json(conversations.map(toPublicConversation));
    } catch (err: any) {
      console.error('List conversations error:', err);
      res.status(500).json({ error: 'Failed to load conversations' });
    }
  });

  // Update a conversation's status (AI Managed / Active / Closed) or cart
  app.patch('/api/conversations/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      if (!conversationPatchHasOnlyAllowedKeys(req.body)) {
        return res.status(400).json({ error: 'Invalid request.' });
      }

      const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
      if (!conversation || conversation.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const { status, cart, isComplaint, isArchived, isSpam } = req.body;
      const dataToUpdate: {
        status?: 'AI_MANAGED' | 'ACTIVE' | 'CLOSED';
        cart?: { sku: string; quantity: number }[];
        isComplaint?: boolean;
        isArchived?: boolean;
        isSpam?: boolean;
      } = {};

      if (status) {
        const mappedStatus = FRONTEND_TO_STATUS[status] as 'AI_MANAGED' | 'ACTIVE' | 'CLOSED' | undefined;
        if (!mappedStatus) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        dataToUpdate.status = mappedStatus;
      }

      if (cart !== undefined) {
        const sanitizedCart = sanitizeCartInput(cart);
        if (sanitizedCart === null) {
          return res.status(400).json({ error: 'Invalid cart data.' });
        }
        if (sanitizedCart.length > 0) {
          const storeProducts = await prisma.product.findMany({
            where: { storeId: req.auth!.storeId },
            select: { sku: true },
          });
          const storeSkus = new Set(storeProducts.map((p) => p.sku));
          if (!validateCartSkusInStore(sanitizedCart, storeSkus)) {
            return res.status(400).json({ error: 'Invalid cart data.' });
          }
        }
        dataToUpdate.cart = sanitizedCart;
      }

      if (isComplaint !== undefined) {
        dataToUpdate.isComplaint = Boolean(isComplaint);
      }

      if (isArchived !== undefined) {
        dataToUpdate.isArchived = Boolean(isArchived);
      }

      if (isSpam !== undefined) {
        dataToUpdate.isSpam = Boolean(isSpam);
      }

      if (Object.keys(dataToUpdate).length === 0) {
        return res.status(400).json({ error: 'Invalid request.' });
      }

      const updated = await prisma.conversation.update({
        where: { id: conversation.id },
        data: dataToUpdate,
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      res.json(toPublicConversation(updated));
    } catch (err: any) {
      console.error('Update conversation error:', err);
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  });

  // Delete a conversation
  app.delete('/api/conversations/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
      if (!conversation || conversation.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      // Delete associated messages first then conversation
      await prisma.message.deleteMany({ where: { conversationId: conversation.id } });
      await prisma.conversation.delete({ where: { id: conversation.id } });

      res.json({ success: true });
    } catch (err: any) {
      console.error('Delete conversation error:', err);
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  });

  // Sends a message into a conversation. `sender: 'merchant'` posts the merchant's own
  // reply (delivered to the real customer via the channel adapter when applicable, e.g.
  // Facebook Messenger); omitting it (or 'customer') simulates an incoming customer
  // message for demo/testing channels that have no real external customer, and triggers
  // an AI reply if the conversation is AI-managed.
  app.post('/api/conversations/:id/messages', requireAuth, requireProfileComplete, aiLimiter, async (req: AuthedRequest, res) => {
    if (!isProduction) {
      console.log('[ROUTE] POST /api/conversations/:id/messages — id:', req.params.id, '| sender:', req.body?.sender);
    }
    try {
      const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
      if (!conversation || conversation.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const { text, sender, discardDraftId } = req.body;
      if (!text) {
        return res.status(400).json({ error: 'Message text is required' });
      }

      if (sender === 'merchant') {
        if (discardDraftId) {
          // Merchant edited an AI draft before sending — remove the superseded draft
          // rather than leaving a stale unsent card sitting in the thread.
          await prisma.message.deleteMany({ where: { id: discardDraftId, conversationId: conversation.id, pending: true } });
        }

        await prisma.message.create({ data: { conversationId: conversation.id, sender: 'MERCHANT', text } });
        await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

        if (conversation.channelType === 'FACEBOOK' && conversation.externalUserId) {
          const pageAccessToken = await getPageAccessTokenForStore(conversation.storeId);
          if (pageAccessToken) {
            try {
              await sendMessengerMessage(pageAccessToken, conversation.externalUserId, text);
            } catch (err) {
              console.error('Failed to deliver merchant reply to Messenger:', err);
            }
          }
        }

        if (conversation.channelType === 'WHATSAPP' && conversation.externalUserId) {
          const waCreds = await getWhatsAppCredentialsForStore(conversation.storeId);
          if (waCreds) {
            try {
              await sendWhatsAppMessage(waCreds.phoneNumberId, waCreds.accessToken, conversation.externalUserId, text);
            } catch (err) {
              console.error('Failed to deliver merchant reply to WhatsApp:', err);
            }
          }
        }

        if (conversation.channelType === 'INSTAGRAM' && conversation.externalUserId) {
          const igCreds = await getInstagramCredentialsForStore(conversation.storeId);
          if (igCreds) {
            try {
              await sendInstagramMessage(igCreds.igAccountId, igCreds.accessToken, conversation.externalUserId, text);
            } catch (err) {
              console.error('Failed to deliver merchant reply to Instagram:', err);
            }
          }
        }

        const updated = await prisma.conversation.findUnique({
          where: { id: conversation.id },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        });
        return res.json(toPublicConversation(updated));
      }

      await prisma.message.create({ data: { conversationId: conversation.id, sender: 'CUSTOMER', text } });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
      await generateAndStoreAgentReply(conversation, text);

      const updated = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      res.json(toPublicConversation(updated));
    } catch (err: any) {
      console.error('Send message error:', err);
      res.status(500).json({ error: 'Unable to process request' });
    }
  });

  // Approves a pending AI draft (Copilot-off mode): delivers it to the real customer
  // (e.g. via Messenger/WhatsApp) when applicable, and marks it as sent.
  app.post('/api/conversations/:id/messages/:messageId/approve', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
      if (!conversation || conversation.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }
      const message = await prisma.message.findUnique({ where: { id: req.params.messageId } });
      if (!message || message.conversationId !== conversation.id || !message.pending) {
        return res.status(404).json({ error: 'Pending draft not found' });
      }

      if (conversation.channelType === 'FACEBOOK' && conversation.externalUserId) {
        const pageAccessToken = await getPageAccessTokenForStore(conversation.storeId);
        if (pageAccessToken) {
          try {
            await sendMessengerMessage(pageAccessToken, conversation.externalUserId, message.text);
            if (message.imageUrl) await sendMessengerImage(pageAccessToken, conversation.externalUserId, message.imageUrl);
          } catch (err) {
            console.error('Failed to deliver approved draft to Messenger:', err);
          }
        }
      }

      if (conversation.channelType === 'WHATSAPP' && conversation.externalUserId) {
        const waCreds = await getWhatsAppCredentialsForStore(conversation.storeId);
        if (waCreds) {
          try {
            await sendWhatsAppMessage(waCreds.phoneNumberId, waCreds.accessToken, conversation.externalUserId, message.text);
            if (message.imageUrl) await sendWhatsAppImage(waCreds.phoneNumberId, waCreds.accessToken, conversation.externalUserId, message.imageUrl);
          } catch (err) {
            console.error('Failed to deliver approved draft to WhatsApp:', err);
          }
        }
      }

      if (conversation.channelType === 'INSTAGRAM' && conversation.externalUserId) {
        const igCreds = await getInstagramCredentialsForStore(conversation.storeId);
        if (igCreds) {
          try {
            await sendInstagramMessage(igCreds.igAccountId, igCreds.accessToken, conversation.externalUserId, message.text);
            if (message.imageUrl) await sendInstagramImage(igCreds.igAccountId, igCreds.accessToken, conversation.externalUserId, message.imageUrl);
          } catch (err) {
            console.error('Failed to deliver approved draft to Instagram:', err);
          }
        }
      }

      await prisma.message.update({ where: { id: message.id }, data: { pending: false } });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

      const updated = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      res.json(toPublicConversation(updated));
    } catch (err: any) {
      console.error('Approve draft error:', err);
      res.status(500).json({ error: 'Failed to approve draft' });
    }
  });

  // Dev-only AI sandbox. Unused by the SPA (Inbox uses /api/conversations/:id/messages).
  // Disabled in production; in development requires auth and uses the merchant's real
  // store persona/catalog — never client-supplied catalog/persona or raw error details.
  app.post('/api/chat', (req, res, next) => {
    if (isProduction) {
      return res.status(404).json({ error: 'Not found' });
    }
    next();
  }, aiLimiter, requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
    try {
      const { message, history = [] } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const [store, products] = await Promise.all([
        prisma.store.findUnique({ where: { id: req.auth!.storeId } }),
        prisma.product.findMany({ where: { storeId: req.auth!.storeId } }),
      ]);
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }

      const persona = {
        tone: store.tone,
        style: store.style,
        customInstructions: store.customInstructions,
      };
      const catalog = products.map((p) => ({
        name: p.name,
        sku: p.sku,
        price: Number(p.price),
        inventory: p.inventory,
        status: p.status === 'TRAINED' ? 'Trained' : 'Pending',
      }));

      const safeHistory = Array.isArray(history)
        ? history
            .filter((h: any) => h && typeof h.text === 'string' && typeof h.sender === 'string')
            .slice(-10)
            .map((h: any) => ({ sender: h.sender, text: h.text }))
        : [];

      const promptCatalog = selectRelevantCatalog(catalog, message, safeHistory.map((h) => h.text), new Set());
      const result = await generateAgentReply({ message, history: safeHistory, persona, catalog, promptCatalog });
      return res.json(result);
    } catch (err: any) {
      console.error('Server error handling chat');
      res.status(500).json({ error: 'Unable to process request' });
    }
  });

  // Public website-widget endpoints. No merchant session/JWT — the widget script embeds a
  // store's widgetKey directly on an arbitrary business's own site, so the trust boundary is
  // the widgetKey itself, not Origin/cookies (requireTrustedOrigin exempts this prefix, see
  // server/auth.ts). CORS is opened wide (Access-Control-Allow-Origin: *) since any site is a
  // legitimate embedder and no credentials/cookies are ever involved.
  const MAX_WIDGET_MESSAGE_LENGTH = 4000;

  function applyWidgetCors(res: Response) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  }

  app.options('/api/widget/message', (_req, res) => { applyWidgetCors(res); res.sendStatus(204); });
  app.options('/api/widget/messages', (_req, res) => { applyWidgetCors(res); res.sendStatus(204); });

  // Resolves widgetKey -> Store, and confirms the merchant has actually enabled the widget
  // (Channel row connected) — mirrors how Messenger/WhatsApp/Instagram drop events for
  // unconnected Pages/numbers rather than trusting the payload alone.
  async function resolveConnectedWidgetStore(widgetKey: unknown): Promise<{ id: string } | null> {
    if (!widgetKey || typeof widgetKey !== 'string') return null;
    const store = await prisma.store.findUnique({ where: { widgetKey } });
    if (!store) return null;
    const channel = await prisma.channel.findUnique({ where: { storeId_type: { storeId: store.id, type: 'WIDGET' } } });
    if (!channel?.connected) return null;
    return store;
  }

  app.post('/api/widget/message', widgetLimiter, async (req, res) => {
    applyWidgetCors(res);
    try {
      const { widgetKey, visitorId, text } = req.body || {};
      if (!visitorId || typeof visitorId !== 'string') {
        return res.status(400).json({ error: 'visitorId is required' });
      }
      if (!text || typeof text !== 'string' || text.length > MAX_WIDGET_MESSAGE_LENGTH) {
        return res.status(400).json({ error: 'A non-empty message is required' });
      }

      const store = await resolveConnectedWidgetStore(widgetKey);
      if (!store) {
        return res.status(404).json({ error: 'Widget not found' });
      }

      let conversation = await prisma.conversation.findFirst({
        where: { storeId: store.id, channelType: 'WIDGET', externalUserId: visitorId },
      });
      const isNewConversation = !conversation;
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: { storeId: store.id, channelType: 'WIDGET', externalUserId: visitorId, lastMessageAt: new Date() },
        });
      }

      await prisma.message.create({ data: { conversationId: conversation.id, sender: 'CUSTOMER', text } });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

      const greetedInstead = await sendOpeningGreetingIfNew(isNewConversation, conversation);
      if (!greetedInstead) {
        await generateAndStoreAgentReply(conversation, text);
      }

      const updated = await prisma.conversation.findUnique({
        where: { id: conversation.id },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      res.json(toPublicWidgetConversation(updated));
    } catch (err: any) {
      console.error('Widget message error:', err);
      res.status(500).json({ error: 'Unable to process message' });
    }
  });

  app.get('/api/widget/messages', widgetLimiter, async (req, res) => {
    applyWidgetCors(res);
    try {
      const widgetKey = req.query.widgetKey;
      const visitorId = req.query.visitorId;
      if (!visitorId || typeof visitorId !== 'string') {
        return res.status(400).json({ error: 'visitorId is required' });
      }

      const store = await resolveConnectedWidgetStore(widgetKey);
      if (!store) {
        return res.status(404).json({ error: 'Widget not found' });
      }

      const conversation = await prisma.conversation.findFirst({
        where: { storeId: store.id, channelType: 'WIDGET', externalUserId: visitorId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });
      if (!conversation) {
        return res.json({ messages: [] });
      }
      res.json(toPublicWidgetConversation(conversation));
    } catch (err: any) {
      console.error('Widget messages poll error:', err);
      res.status(500).json({ error: 'Unable to fetch messages' });
    }
  });

  // Meta webhook verification handshake (Messenger/Instagram/WhatsApp all use this same shape)
  app.get('/webhooks/meta', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });


  async function handleIncomingMessengerMessage(pageId: string, senderPsid: string, messageText: string, externalMessageId: string) {
    if (!isProduction) {
      console.log('[WEBHOOK] handleIncomingMessengerMessage — messageId:', externalMessageId);
    }
    // Meta's webhook delivery is "at-least-once" — it may redeliver the same event.
    // Bail out immediately if we've already recorded this exact message.
    const alreadyProcessed = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (alreadyProcessed) {
      console.log('Duplicate Messenger webhook event, skipping');
      return;
    }

    // A real self-serve OAuth connection always has a Channel row keyed by this exact
    // Page ID (see finalizeFacebookConnection). There is no fallback: a Page that hasn't
    // been connected through that flow has no known store to attach the message to, so
    // it's dropped rather than guessed at. Ownership comes only from the Channel row.
    const channel = await resolveConnectedChannelByExternalId('FACEBOOK', pageId);
    if (!channel) {
      console.error('Ignoring Messenger event for unconnected Page');
      return;
    }
    const storeId = channel.storeId;

    let conversation = await prisma.conversation.findFirst({
      where: { storeId, channelType: 'FACEBOOK', externalUserId: senderPsid },
    });
    const isNewConversation = !conversation;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { storeId, channelType: 'FACEBOOK', externalUserId: senderPsid, lastMessageAt: new Date() },
      });
    }

    // Backfill the customer's real name/avatar if we don't have both yet — covers both
    // brand-new conversations and older ones created before this profile lookup existed.
    if (!conversation.customerName || !conversation.avatarUrl) {
      const pageAccessToken = await getPageAccessTokenForStore(storeId);
      const profile = pageAccessToken ? await fetchMessengerProfile(pageAccessToken, senderPsid) : { name: null, profilePicUrl: null };
      const updateData: any = {};
      if (profile.name && !conversation.customerName) updateData.customerName = profile.name;
      if (profile.profilePicUrl && !conversation.avatarUrl) updateData.avatarUrl = profile.profilePicUrl;
      if (Object.keys(updateData).length > 0) {
        conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: updateData });
      }
    }

    try {
      await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'CUSTOMER', text: messageText, externalId: externalMessageId },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Lost a race with a concurrent redelivery of the same event — the other one wins.
        console.log('Duplicate Messenger webhook event (race), skipping');
        return;
      }
      throw err;
    }

    const greetedInstead = await sendOpeningGreetingIfNew(isNewConversation, conversation);
    if (!greetedInstead) {
      await generateAndStoreAgentReply(conversation, messageText);
    }
  }

  async function handleIncomingWhatsAppMessage(phoneNumberId: string, senderWaId: string, messageText: string, externalMessageId: string, customerName?: string) {
    const alreadyProcessed = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (alreadyProcessed) {
      console.log('Duplicate WhatsApp webhook event, skipping');
      return;
    }

    const channel = await resolveConnectedChannelByExternalId('WHATSAPP', phoneNumberId);
    if (!channel) {
      console.error('Ignoring WhatsApp event for unconnected Phone Number ID');
      return;
    }
    const storeId = channel.storeId;

    let conversation = await prisma.conversation.findFirst({
      where: { storeId, channelType: 'WHATSAPP', externalUserId: senderWaId },
    });
    const isNewConversation = !conversation;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          storeId,
          channelType: 'WHATSAPP',
          externalUserId: senderWaId,
          customerName: customerName || `WhatsApp User (+${senderWaId})`,
          lastMessageAt: new Date(),
        },
      });
    } else if (customerName && conversation.customerName !== customerName) {
      conversation = await prisma.conversation.update({
        where: { id: conversation.id },
        data: { customerName },
      });
    }

    try {
      await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'CUSTOMER', text: messageText, externalId: externalMessageId },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        console.log('Duplicate WhatsApp webhook event (race), skipping');
        return;
      }
      throw err;
    }

    const greetedInstead = await sendOpeningGreetingIfNew(isNewConversation, conversation);
    if (!greetedInstead) {
      await generateAndStoreAgentReply(conversation, messageText);
    }
  }

  async function handleIncomingInstagramMessage(igAccountId: string, senderIgUserId: string, messageText: string, externalMessageId: string) {
    const alreadyProcessed = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (alreadyProcessed) {
      console.log('Duplicate Instagram webhook event, skipping');
      return;
    }

    const channel = await resolveConnectedChannelByExternalId('INSTAGRAM', igAccountId);
    if (!channel) {
      console.error('Ignoring Instagram event for unconnected Account ID');
      return;
    }
    const storeId = channel.storeId;

    let conversation = await prisma.conversation.findFirst({
      where: { storeId, channelType: 'INSTAGRAM', externalUserId: senderIgUserId },
    });
    const isNewConversation = !conversation;
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { storeId, channelType: 'INSTAGRAM', externalUserId: senderIgUserId, lastMessageAt: new Date() },
      });
    }

    if (!conversation.customerName || !conversation.avatarUrl) {
      const igCreds = await getInstagramCredentialsForStore(storeId);
      const profile = igCreds ? await fetchInstagramProfile(igCreds.accessToken, senderIgUserId) : { name: null, profilePicUrl: null };
      const updateData: any = {};
      if (profile.name && !conversation.customerName) updateData.customerName = `@${profile.name}`;
      if (profile.profilePicUrl && !conversation.avatarUrl) updateData.avatarUrl = profile.profilePicUrl;
      if (Object.keys(updateData).length > 0) {
        conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: updateData });
      }
    }

    try {
      await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'CUSTOMER', text: messageText, externalId: externalMessageId },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        console.log('Duplicate Instagram webhook event (race), skipping');
        return;
      }
      throw err;
    }

    const greetedInstead = await sendOpeningGreetingIfNew(isNewConversation, conversation);
    if (!greetedInstead) {
      await generateAndStoreAgentReply(conversation, messageText);
    }
  }

  // Meta webhook receiver — signature-verified before any payload is trusted
  app.post('/webhooks/meta', async (req: RequestWithRawBody, res) => {
    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const appSecret = process.env.META_APP_SECRET;

    if (!appSecret || !req.rawBody || !verifyMetaSignature(req.rawBody, signature, appSecret)) {
      return res.sendStatus(401);
    }

    // Acknowledge immediately — Meta expects a fast 200 and will retry on timeout.
    res.sendStatus(200);

    try {
      const body = req.body;

      if (body.object === 'page') {
        for (const entry of body.entry || []) {
          const pageId = entry.id;
          for (const event of entry.messaging || []) {
            const senderPsid = event.sender?.id;
            const messageText = event.message?.text;
            const messageId = event.message?.mid;
            if (!senderPsid || !messageText || !messageId || event.message?.is_echo) continue;

            await handleIncomingMessengerMessage(pageId, senderPsid, messageText, messageId);
          }

          // Handle Facebook Post Comment webhooks (feed field)
          for (const change of entry.changes || []) {
            if (change.field === 'feed' && change.value) {
              const val = change.value;
              if (!isProduction) {
                console.log('[WEBHOOK] Received FB feed change event');
              }
              // Prefer Meta's stable comment_id. Do not fall back to post_id alone —
              // that would collide across comments on the same post and is not a
              // reliable per-event idempotency key.
              const commentId =
                typeof val.comment_id === 'string'
                  ? val.comment_id
                  : val.item === 'comment' && typeof val.id === 'string'
                    ? val.id
                    : null;
              const verb = val.verb || 'add';

              if (verb === 'add' && commentId) {
                const claimed = await claimWebhookEvent('meta', `facebook.comment.${commentId}`, 'facebook_comment');
                if (!claimed) {
                  console.log('Duplicate Facebook comment webhook event, skipping');
                  continue;
                }

                const messageText = val.message || '';
                const fromPsid = val.from?.id;
                const fromName = val.from?.name || 'Customer';

                if (messageText && (await isQuestionOrPriceInquiry(messageText))) {
                  if (!isProduction) {
                    console.log('[COMMENT BOT] Triggered for FB feed event');
                  }

                  const channel = await resolveConnectedChannelByExternalId('FACEBOOK', pageId);
                  if (channel) {
                    const pageAccessToken = await getPageAccessTokenForStore(channel.storeId);
                    if (pageAccessToken) {
                      // 1. Reply to comment in public comment section: "Check Inbox"
                      try {
                        await replyToFacebookComment(commentId, pageAccessToken, 'Check Inbox');
                      } catch (err: any) {
                        console.error('Failed to reply to Facebook comment');
                      }

                      // 2. Send private message in inbox: "Hello [customer_name] Please tell us about any inquiry you have"
                      const dmText = `Hello ${fromName} Please tell us about any inquiry you have`;
                      try {
                        if (fromPsid) {
                          await sendMessengerMessage(pageAccessToken, fromPsid, dmText);
                        } else {
                          await sendFacebookPrivateReply(commentId, pageAccessToken, dmText);
                        }
                      } catch (err: any) {
                        console.error('Failed to send Facebook inbox message for comment');
                      }
                    }
                  }
                } else if (!isProduction) {
                  console.log('[COMMENT BOT] Ignored FB feed event (not a question/price inquiry)');
                }
              }
            }
          }
        }
      } else if (body.object === 'instagram') {
        for (const entry of body.entry || []) {
          const igAccountId = entry.id;
          for (const event of entry.messaging || []) {
            const senderIgUserId = event.sender?.id;
            const messageText = event.message?.text;
            const messageId = event.message?.mid;
            if (!senderIgUserId || !messageText || !messageId || event.message?.is_echo) continue;

            await handleIncomingInstagramMessage(igAccountId, senderIgUserId, messageText, messageId);
          }

          // Handle Instagram Post Comment webhooks (comments field)
          for (const change of entry.changes || []) {
            if (change.field === 'comments' && change.value) {
              const val = change.value;
              const commentId = typeof val.id === 'string' ? val.id : null;
              if (!commentId) continue;

              const claimed = await claimWebhookEvent('meta', `instagram.comment.${commentId}`, 'instagram_comment');
              if (!claimed) {
                console.log('Duplicate Instagram comment webhook event, skipping');
                continue;
              }

              const messageText = val.text || '';
              const fromUser = val.from || {};
              const senderIgUserId = fromUser.id;
              let customerName = fromUser.username || fromUser.name || 'Customer';

              if (messageText && (await isQuestionOrPriceInquiry(messageText))) {
                if (!isProduction) {
                  console.log('[COMMENT BOT] Triggered for IG comment');
                }

                const channel = await resolveConnectedChannelByExternalId('INSTAGRAM', igAccountId);
                if (channel) {
                  const igCreds = await getInstagramCredentialsForStore(channel.storeId);
                  if (igCreds) {
                    if (senderIgUserId && customerName === 'Customer') {
                      const fetchedProfile = await fetchInstagramProfile(igCreds.accessToken, senderIgUserId);
                      if (fetchedProfile.name) customerName = fetchedProfile.name;
                    }

                    // 1. Reply to comment in public comment section: "Check Inbox"
                    try {
                      await replyToInstagramComment(commentId, igCreds.accessToken, 'Check Inbox');
                    } catch (err: any) {
                      console.error('Failed to reply to IG comment');
                    }

                    // 2. Send private message in inbox: "Hello [customer_name] Please tell us about any inquiry you have"
                    const dmText = `Hello ${customerName} Please tell us about any inquiry you have`;
                    try {
                      if (senderIgUserId) {
                        await sendInstagramPrivateReply(igCreds.igAccountId, igCreds.accessToken, senderIgUserId, dmText);
                      }
                    } catch (err: any) {
                      console.error('Failed to send IG inbox message for comment');
                    }
                  }
                }
              }
            }
          }
        }
      } else if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field !== 'messages') continue;
            const value = change.value;
            const phoneNumberId = value?.metadata?.phone_number_id;
            const contacts = value?.contacts || [];
            const messages = value?.messages || [];

            for (const msg of messages) {
              if (msg.type !== 'text' || !msg.text?.body) continue;
              const senderWaId = msg.from;
              const messageText = msg.text.body;
              const externalMessageId = msg.id;
              const contact = contacts.find((c: any) => c.wa_id === senderWaId);
              const customerName = contact?.profile?.name;

              if (phoneNumberId && senderWaId && messageText && externalMessageId) {
                await handleIncomingWhatsAppMessage(phoneNumberId, senderWaId, messageText, externalMessageId, customerName);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Meta webhook processing error:', err);
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', geminiActive: !!ai });
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global error handler — catches errors passed via next(err) that no route's own
  // try/catch handled, most notably Multer's upload rejections (oversized file, wrong
  // MIME type), which otherwise bypass every route's JSON error contract and fall
  // through to Express's default HTML error page.
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(err);
    if (err instanceof MulterError) {
      const maxBytes = req.path.includes('/products/')
        ? MAX_PRODUCT_IMAGE_BYTES
        : req.path.includes('/persona/')
          ? MAX_OPENING_IMAGE_BYTES
          : MAX_AVATAR_BYTES;
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? `Image must be ${Math.floor(maxBytes / (1024 * 1024))} MB or smaller`
          : 'Invalid file upload';
      return res.status(400).json({ error: message });
    }
    if (err?.message === 'Only image files are accepted') {
      return res.status(400).json({ error: err.message });
    }
    console.error('Unhandled request error:', err?.message);
    res.status(500).json({ error: 'Something went wrong' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

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
import { createWidgetRouter } from './server/routes/widget';
import type { RequestWithRawBody } from './server/types';
import { createWebhooksRouter } from './server/routes/webhooks';
import { createAnalyticsRouter } from './server/routes/analytics';
import { createPersonaRouter } from './server/routes/persona';
import { createProductsRouter } from './server/routes/products';
import { createOrdersRouter } from './server/routes/orders';
import { createConversationsRouter } from './server/routes/conversations';
import { createProfileRouter } from './server/routes/profile';
import {
  getPageAccessTokenForStore,
  getWhatsAppCredentialsForStore,
  getInstagramCredentialsForStore,
  selectRelevantCatalog,
  generateAndStoreAgentReply,
  sendOpeningGreetingIfNew,
} from './server/conversationEngine';

dotenv.config();

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
  app.use(createWidgetRouter());
  app.use(createWebhooksRouter());
  app.use(createAnalyticsRouter());
  app.use(createPersonaRouter());
  app.use(createProductsRouter());
  app.use(createOrdersRouter());
  app.use(createConversationsRouter());
  app.use(createProfileRouter());

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

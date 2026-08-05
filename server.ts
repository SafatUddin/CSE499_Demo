import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { prisma } from './server/db';
import { signToken, requireAuth, AuthedRequest, signState, verifyState } from './server/auth';
import { ollamaEnabled, warmUpOllama } from './server/ollama';
import { generateAgentReply } from './server/agent';
import {
  verifyMetaSignature,
  sendMessengerMessage,
  sendWhatsAppMessage,
  sendInstagramMessage,
  fetchMessengerProfileName,
  fetchInstagramProfileName,
  getFacebookOAuthUrl,
  exchangeCodeForUserToken,
  listManagedPages,
  listWhatsAppPhoneNumbers,
  subscribePageWebhook,
  ManagedPage,
} from './server/meta';
import { encryptSecret, decryptSecret } from './server/crypto';
import { buildGoogleAuthUrl, exchangeCodeForProfile } from './server/google';

dotenv.config();

interface RequestWithRawBody extends express.Request {
  rawBody?: Buffer;
}

async function startServer() {
  const app = express();
  app.use(express.json({
    verify: (req: RequestWithRawBody, _res, buf) => {
      req.rawBody = buf;
    },
  }));
  const PORT = Number(process.env.PORT) || 3000;

  const toPublicMerchant = (merchant: { id: string; name: string; email: string; avatarUrl: string | null }) => ({
    id: merchant.id,
    name: merchant.name,
    email: merchant.email,
    avatarUrl: merchant.avatarUrl,
  });

  // Signup: creates a Merchant + their Store, returns a JWT
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const { fullName, businessName, email, password } = req.body;

      if (!fullName || !businessName || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
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

      const token = signToken({ merchantId: merchant.id, storeId: store.id });
      res.json({
        token,
        merchant: toPublicMerchant(merchant),
        store: { id: store.id, name: store.name },
      });
    } catch (err: any) {
      console.error('Signup error:', err);
      res.status(500).json({ error: 'Failed to create account' });
    }
  });

  // Login: verifies credentials, returns a JWT
  app.post('/api/auth/login', async (req, res) => {
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

      const token = signToken({ merchantId: merchant.id, storeId: merchant.store.id });
      res.json({
        token,
        merchant: toPublicMerchant(merchant),
        store: { id: merchant.store.id, name: merchant.store.name },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to log in' });
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
        verifyState<{ purpose: string }>(state);
      } catch {
        return errorRedirect('Invalid or expired OAuth state');
      }
      if (!code) return errorRedirect('Missing authorization code');

      const profile = await exchangeCodeForProfile(code);

      // Upsert: find by googleId first, then by email, else create new
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
          if (byEmail.googleId && byEmail.googleId !== profile.googleId) {
            return errorRedirect('This email is already linked to a different Google account');
          }
          merchant = await prisma.merchant.update({
            where: { id: byEmail.id },
            data: {
              googleId: profile.googleId,
              ...(!byEmail.avatarUrl && profile.picture ? { avatarUrl: profile.picture } : {}),
            },
            include: { store: true },
          });
        } else {
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
      }

      if (!merchant.store) {
        return errorRedirect('Merchant has no store');
      }

      const token = signToken({ merchantId: merchant.id, storeId: merchant.store.id });
      const params = new URLSearchParams({
        googleToken: token,
        googleMerchant: JSON.stringify(toPublicMerchant(merchant)),
        googleStore: JSON.stringify({ id: merchant.store.id, name: merchant.store.name }),
      });
      res.redirect(`${appUrl}/#login?${params.toString()}`);
    } catch (err: any) {
      console.error('Google callback error:', err);
      errorRedirect('Google sign-in failed');
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
      res.json({
        merchant: toPublicMerchant(merchant),
        store: { id: merchant.store.id, name: merchant.store.name },
      });
    } catch (err: any) {
      console.error('Fetch profile error:', err);
      res.status(500).json({ error: 'Failed to load profile' });
    }
  });

  // Update profile: name, avatar, and/or password (requires current password to change it)
  app.patch('/api/me', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { name, email, avatarUrl, currentPassword, password } = req.body;
      const merchant = await prisma.merchant.findUnique({ where: { id: req.auth!.merchantId } });
      if (!merchant) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const data: { name?: string; email?: string; avatarUrl?: string; passwordHash?: string } = {};
      if (typeof name === 'string' && name.trim()) data.name = name;
      if (typeof avatarUrl === 'string') data.avatarUrl = avatarUrl;
      if (typeof email === 'string' && email.trim() && email !== merchant.email) {
        const emailTaken = await prisma.merchant.findUnique({ where: { email } });
        if (emailTaken) {
          return res.status(409).json({ error: 'An account with this email already exists' });
        }
        data.email = email;
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
        if (password.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        data.passwordHash = await bcrypt.hash(password, 12);
      }

      const updated = await prisma.merchant.update({ where: { id: merchant.id }, data });
      res.json({ merchant: toPublicMerchant(updated) });
    } catch (err: any) {
      console.error('Update profile error:', err);
      res.status(500).json({ error: 'Failed to update profile' });
    }
  });

  const CHANNEL_TYPE_TO_FRONTEND: Record<string, string> = {
    FACEBOOK: 'facebook',
    INSTAGRAM: 'instagram',
    WHATSAPP: 'whatsapp',
    WIDGET: 'websocket',
  };

  function getFacebookRedirectUri(): string {
    return `${process.env.APP_URL}/api/channels/facebook/callback`;
  }

  async function finalizeFacebookConnection(storeId: string, page: ManagedPage) {
    const credentials = { token: encryptSecret(page.access_token), name: page.name };
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

    try {
      await subscribePageWebhook(page.id, page.access_token);
    } catch (err) {
      console.error('Failed to auto-subscribe Facebook Page webhook:', err);
    }
  }

  async function finalizeWhatsAppConnection(storeId: string, numberObj: { id: string; display_phone_number: string; token: string }) {
    const credentials = {
      token: encryptSecret(numberObj.token),
      phoneNumberId: numberObj.id,
      phoneNumber: numberObj.display_phone_number,
    };
    await prisma.channel.upsert({
      where: { storeId_type: { storeId, type: 'WHATSAPP' } },
      update: { connected: true, externalId: numberObj.id, credentials },
      create: { storeId, type: 'WHATSAPP', connected: true, externalId: numberObj.id, credentials },
    });
  }

  // List this store's real channel connections (Facebook & WhatsApp)
  app.get('/api/channels', requireAuth, async (req: AuthedRequest, res) => {
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
  app.delete('/api/channels/:type', requireAuth, async (req: AuthedRequest, res) => {
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
  app.post('/api/channels/whatsapp/connect', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { phoneNumberId, accessToken, phoneNumber } = req.body;
      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({ error: 'Phone Number ID and Access Token are required' });
      }

      const credentials = {
        token: encryptSecret(accessToken),
        phoneNumberId,
        phoneNumber: phoneNumber || null,
      };

      await prisma.channel.upsert({
        where: { storeId_type: { storeId: req.auth!.storeId, type: 'WHATSAPP' } },
        update: { connected: true, externalId: phoneNumberId, credentials },
        create: { storeId: req.auth!.storeId, type: 'WHATSAPP', connected: true, externalId: phoneNumberId, credentials },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error('Connect WhatsApp channel error:', err);
      res.status(500).json({ error: 'Failed to connect WhatsApp channel' });
    }
  });

  // Start the Facebook OAuth flow. Browser navigation can't carry an Authorization
  // header, so the JWT is passed as a query param and verified inline here instead
  // of via the requireAuth middleware.
  app.get('/api/channels/facebook/connect', (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(401).send('Missing token');
      const auth = verifyState<{ merchantId: string; storeId: string }>(token);

      const state = signState({ storeId: auth.storeId }, '10m');
      const url = getFacebookOAuthUrl(getFacebookRedirectUri(), state);
      res.redirect(url);
    } catch (err) {
      console.error('Facebook connect error:', err);
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

      const { storeId } = verifyState<{ storeId: string }>(state);
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

      if (pages.length > 1) {
        const pendingToken = signState({ storeId, pages }, '10m');
        return res.redirect(`${frontendBase}/#integrations?fbPending=${encodeURIComponent(pendingToken)}`);
      }

      if (allWaNumbers.length > 1) {
        const waPendingToken = signState({ storeId, numbers: allWaNumbers }, '10m');
        return res.redirect(`${frontendBase}/#integrations?waPending=${encodeURIComponent(waPendingToken)}`);
      }

      if (pages.length === 0 && allWaNumbers.length === 0) {
        return res.redirect(`${frontendBase}/#integrations?fbError=no_pages`);
      }

      return res.redirect(`${frontendBase}/#integrations?fbConnected=1&waConnected=1`);
    } catch (err) {
      console.error('Meta OAuth callback error:', err);
      res.redirect(`${frontendBase}/#integrations?fbError=server_error`);
    }
  });

  // Returns candidate WhatsApp phone numbers for multi-number selection
  app.get('/api/channels/whatsapp/pending', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const pendingToken = req.query.token as string;
      const decoded = verifyState<{ storeId: string; numbers: any[] }>(pendingToken);
      if (decoded.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Token does not match your account' });
      }
      res.json({ numbers: decoded.numbers.map((n) => ({ id: n.id, display_phone_number: n.display_phone_number, name: n.name })) });
    } catch (err) {
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  // Finalizes WhatsApp connection after merchant picks a number
  app.post('/api/channels/whatsapp/select', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { pendingToken, phoneNumberId } = req.body;
      const decoded = verifyState<{ storeId: string; numbers: any[] }>(pendingToken);
      if (decoded.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Token does not match your account' });
      }
      const num = decoded.numbers.find((n) => n.id === phoneNumberId);
      if (!num) {
        return res.status(404).json({ error: 'Phone number not found in this selection' });
      }
      await finalizeWhatsAppConnection(decoded.storeId, num);
      res.json({ success: true });
    } catch (err) {
      console.error('WhatsApp number selection error:', err);
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  // Returns the candidate Pages for a pending multi-page selection (names only — the
  // access tokens stay server-side inside the signed pendingToken).
  app.get('/api/channels/facebook/pending', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const pendingToken = req.query.token as string;
      const decoded = verifyState<{ storeId: string; pages: ManagedPage[] }>(pendingToken);
      if (decoded.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Token does not match your account' });
      }
      res.json({ pages: decoded.pages.map((p) => ({ id: p.id, name: p.name })) });
    } catch (err) {
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  // Finalizes the connection once the merchant picks a Page from the multi-page list.
  app.post('/api/channels/facebook/select', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { pendingToken, pageId } = req.body;
      const decoded = verifyState<{ storeId: string; pages: ManagedPage[] }>(pendingToken);
      if (decoded.storeId !== req.auth!.storeId) {
        return res.status(403).json({ error: 'Token does not match your account' });
      }
      const page = decoded.pages.find((p) => p.id === pageId);
      if (!page) {
        return res.status(404).json({ error: 'Page not found in this selection' });
      }
      await finalizeFacebookConnection(decoded.storeId, page);
      res.json({ success: true });
    } catch (err) {
      console.error('Facebook page selection error:', err);
      res.status(400).json({ error: 'Invalid or expired selection. Please reconnect.' });
    }
  });

  const toPublicProduct = (p: { id: string; name: string; sku: string; price: any; inventory: number; status: string }) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: Number(p.price),
    inventory: p.inventory,
    status: p.status === 'TRAINED' ? 'Trained' : 'Pending',
  });

  // List this merchant's products
  app.get('/api/products', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const products = await prisma.product.findMany({
        where: { storeId: req.auth!.storeId },
        orderBy: { createdAt: 'desc' },
      });
      res.json(products.map(toPublicProduct));
    } catch (err: any) {
      console.error('List products error:', err);
      res.status(500).json({ error: 'Failed to load products' });
    }
  });

  // Add a product to this merchant's catalog
  app.post('/api/products', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { name, sku, price, inventory, status } = req.body;
      if (!name || !sku || price === undefined || price === null) {
        return res.status(400).json({ error: 'Name, SKU, and price are required' });
      }

      const existing = await prisma.product.findUnique({
        where: { storeId_sku: { storeId: req.auth!.storeId, sku } },
      });
      if (existing) {
        return res.status(409).json({ error: 'A product with this SKU already exists' });
      }

      const product = await prisma.product.create({
        data: {
          storeId: req.auth!.storeId,
          name,
          sku,
          price,
          inventory: inventory ?? 0,
          status: status === 'Pending' ? 'PENDING' : 'TRAINED',
        },
      });
      res.status(201).json(toPublicProduct(product));
    } catch (err: any) {
      console.error('Create product error:', err);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });

  // Remove a product from this merchant's catalog
  app.delete('/api/products/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const product = await prisma.product.findUnique({ where: { id: req.params.id } });
      if (!product || product.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Product not found' });
      }
      await prisma.product.delete({ where: { id: product.id } });
      res.status(204).end();
    } catch (err: any) {
      console.error('Delete product error:', err);
      res.status(500).json({ error: 'Failed to delete product' });
    }
  });

  const toPublicOrder = (o: { id: string; conversationId: string | null; items: any; customerName: string; address: string; status: string; total: any; createdAt: Date }) => ({
    id: o.id,
    conversationId: o.conversationId,
    items: o.items,
    customerName: o.customerName,
    address: o.address,
    status: o.status === 'FULFILLED' ? 'Fulfilled' : o.status === 'CANCELLED' ? 'Cancelled' : 'Pending',
    total: Number(o.total),
    createdAt: o.createdAt,
  });

  // List this store's orders
  app.get('/api/orders', requireAuth, async (req: AuthedRequest, res) => {
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

  // Update an order's fulfillment status
  app.patch('/api/orders/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { status } = req.body;
      const mapped = status === 'Fulfilled' ? 'FULFILLED' : status === 'Cancelled' ? 'CANCELLED' : status === 'Pending' ? 'PENDING' : null;
      if (!mapped) return res.status(400).json({ error: 'Invalid status' });

      const order = await prisma.order.findUnique({ where: { id: req.params.id } });
      if (!order || order.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Order not found' });
      }
      const updated = await prisma.order.update({ where: { id: order.id }, data: { status: mapped as any } });
      res.json(toPublicOrder(updated));
    } catch (err: any) {
      console.error('Update order error:', err);
      res.status(500).json({ error: 'Failed to update order' });
    }
  });

  // Creates a real Order from a conversation's current AI-built cart. A deliberate
  // merchant action (not automatic) — the AI can build a cart, but committing it to a
  // real order/financial record needs explicit confirmation, same reasoning as the
  // AI-Copilot pending-draft approval flow.
  // Shared by the manual "Generate Order" endpoint and the AI's auto-finalize path
  // (see generateAndStoreAgentReply) — validates stock, atomically decrements inventory,
  // creates the Order row, and clears the conversation's cart in one transaction.
  async function createOrderForConversation(
    conversation: { id: string; storeId: string; customerName: string | null },
    cart: { sku: string; quantity: number }[],
    address: string,
    customerNameOverride?: string
  ) {
    const insufficientStock = (message: string) => {
      const err = new Error(message) as Error & { code: string };
      err.code = 'INSUFFICIENT_STOCK';
      return err;
    };

    return prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { storeId: conversation.storeId, sku: { in: cart.map((item) => item.sku) } },
      });

      // M1: every cart line must resolve to a real product with enough stock.
      for (const cartItem of cart) {
        const quantity = Math.floor(Number(cartItem.quantity));
        if (!Number.isFinite(quantity) || quantity < 1) {
          throw insufficientStock(`Invalid quantity for SKU ${cartItem.sku}`);
        }
        const product = products.find((p) => p.sku === cartItem.sku);
        if (!product) {
          throw insufficientStock(`Product not found for SKU ${cartItem.sku}`);
        }
        if (product.inventory < quantity) {
          throw insufficientStock(
            `Insufficient stock for ${product.name} (SKU ${product.sku}). Requested ${quantity}, available ${product.inventory}.`
          );
        }
      }

      // M2: decrement under an inventory >= quantity predicate so concurrent checkouts
      // cannot both claim the same unit. Sort by product id for a stable lock order.
      const cartByProductId = [...cart].sort((a, b) => {
        const pa = products.find((p) => p.sku === a.sku)!;
        const pb = products.find((p) => p.sku === b.sku)!;
        return pa.id.localeCompare(pb.id);
      });

      for (const cartItem of cartByProductId) {
        const quantity = Math.floor(Number(cartItem.quantity));
        const product = products.find((p) => p.sku === cartItem.sku)!;
        const updated = await tx.product.updateMany({
          where: { id: product.id, inventory: { gte: quantity } },
          data: { inventory: { decrement: quantity } },
        });
        if (updated.count !== 1) {
          throw insufficientStock(
            `Insufficient stock for ${product.name} (SKU ${product.sku}).`
          );
        }
      }

      const items = cart.map((cartItem) => {
        const product = products.find((p) => p.sku === cartItem.sku)!;
        return {
          sku: cartItem.sku,
          name: product.name,
          price: Number(product.price),
          quantity: Math.floor(Number(cartItem.quantity)),
        };
      });
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const order = await tx.order.create({
        data: {
          storeId: conversation.storeId,
          conversationId: conversation.id,
          items,
          customerName: customerNameOverride || conversation.customerName || 'Customer',
          address,
          status: 'PENDING',
          total,
        },
      });

      // Checked out — clear the conversation's cart and reset order-flow state so a
      // later purchase in the same conversation starts a fresh confirmation cycle.
      await tx.conversation.update({
        where: { id: conversation.id },
        data: {
          cart: null,
          orderConfirmationRequested: false,
          orderConfirmed: false,
          orderSummaryShown: false,
          awaitingQuantityFor: null,
        },
      });

      return order;
    });
  }

  app.post('/api/conversations/:id/orders', requireAuth, async (req: AuthedRequest, res) => {
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
        return res.status(409).json({ error: err.message || 'Insufficient stock to create this order' });
      }
      console.error('Create order error:', err);
      res.status(500).json({ error: 'Failed to create order' });
    }
  });

  // Analytics: aggregated metrics for the authenticated merchant's store.
  // Returns a day-by-day series (suitable for the existing Recharts AreaChart),
  // summary KPIs, and a combined recent-activity feed — all scoped to the JWT
  // store. No schema changes are required; data is derived at query time.
  //
  // GET /api/analytics?range=30   (default)
  // GET /api/analytics?range=90
  app.get('/api/analytics', requireAuth, async (req: AuthedRequest, res) => {
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
      const [
        conversationsInRange,
        ordersInRange,
        aiMessageCount,
        recentOrders,
        recentComplaints,
        lowStockProducts,
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

        // Bucket converted sales — FULFILLED orders only.
        for (const o of ordersInRange) {
          if (o.status === 'FULFILLED') {
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

      // Average response time is omitted in M1. Computing reliable first-reply
      // latency requires pairing each CUSTOMER message with the next AI or
      // MERCHANT reply, accounting for pending drafts (Copilot mode) and human-
      // takeover gaps. That logic is out of scope for this milestone.
      const averageResponseTime: null = null;

      const orderCount = ordersInRange.length;

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
        s === 'FULFILLED' ? 'Fulfilled' : s === 'CANCELLED' ? 'Cancelled' : 'Pending';

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
          averageResponseTime,
          orderCount,
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
  app.get('/api/persona', requireAuth, async (req: AuthedRequest, res) => {
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
      });
    } catch (err: any) {
      console.error('Fetch persona error:', err);
      res.status(500).json({ error: 'Failed to load persona' });
    }
  });

  // Update this store's AI persona
  app.put('/api/persona', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { tone, style, customInstructions, autoFinalizeOrdersAlways } = req.body;
      if (!tone || !style) {
        return res.status(400).json({ error: 'Tone and style are required' });
      }
      const store = await prisma.store.update({
        where: { id: req.auth!.storeId },
        data: {
          tone,
          style,
          customInstructions: customInstructions ?? '',
          autoFinalizeOrdersAlways: !!autoFinalizeOrdersAlways,
        },
      });
      res.json({
        tone: store.tone,
        style: store.style,
        customInstructions: store.customInstructions,
        autoFinalizeOrdersAlways: store.autoFinalizeOrdersAlways,
      });
    } catch (err: any) {
      console.error('Update persona error:', err);
      res.status(500).json({ error: 'Failed to update persona' });
    }
  });

  const CHANNEL_TO_PLATFORM: Record<string, string> = {
    FACEBOOK: 'facebook',
    INSTAGRAM: 'instagram',
    WHATSAPP: 'whatsapp',
    WIDGET: 'websocket',
  };
  const STATUS_TO_FRONTEND: Record<string, string> = {
    AI_MANAGED: 'AI Managed',
    ACTIVE: 'Active',
    CLOSED: 'Closed',
  };
  const FRONTEND_TO_STATUS: Record<string, string> = {
    'AI Managed': 'AI_MANAGED',
    'Active': 'ACTIVE',
    'Closed': 'CLOSED',
  };
  const SENDER_TO_FRONTEND: Record<string, string> = {
    CUSTOMER: 'customer',
    AI: 'ai',
    MERCHANT: 'merchant',
  };

  function toPublicConversation(c: any) {
    const messages = c.messages.map((m: any) => ({
      id: m.id,
      sender: SENDER_TO_FRONTEND[m.sender] || 'customer',
      text: m.text,
      time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      pending: !!m.pending,
    }));
    const last = messages[messages.length - 1];
    return {
      id: c.id,
      customerName: c.customerName || 'New Customer',
      platform: CHANNEL_TO_PLATFORM[c.channelType] || 'websocket',
      lastMessage: last?.text || '',
      time: last?.time || '',
      unread: !!last && last.sender === 'customer',
      status: STATUS_TO_FRONTEND[c.status] || 'AI Managed',
      messages,
      isComplaint: c.isComplaint,
      cart: c.cart || undefined,
      detectedAddress: c.detectedAddress || undefined,
      orderConfirmed: !!c.orderConfirmed,
      orderConfirmationRequested: !!c.orderConfirmationRequested,
    };
  }

  // Only the real self-serve OAuth connection's per-store token is used — there is no
  // manual/env-var fallback, so a store with no completed Facebook connection simply
  // can't send or fetch anything via Messenger.
  async function getPageAccessTokenForStore(storeId: string): Promise<string | null> {
    const channel = await prisma.channel.findUnique({ where: { storeId_type: { storeId, type: 'FACEBOOK' } } });
    if (channel?.connected && channel.credentials) {
      try {
        const { token } = channel.credentials as { token: string };
        return decryptSecret(token);
      } catch (err) {
        console.error('Failed to decrypt stored Facebook token:', err);
      }
    }
    return null;
  }

  async function getWhatsAppCredentialsForStore(storeId: string): Promise<{ phoneNumberId: string; accessToken: string } | null> {
    const channel = await prisma.channel.findUnique({ where: { storeId_type: { storeId, type: 'WHATSAPP' } } });
    if (channel?.connected && channel.credentials) {
      try {
        const { token, phoneNumberId } = channel.credentials as { token: string; phoneNumberId: string };
        return { phoneNumberId, accessToken: decryptSecret(token) };
      } catch (err) {
        console.error('Failed to decrypt stored WhatsApp credentials:', err);
      }
    }
    return null;
  }

  async function getInstagramCredentialsForStore(storeId: string): Promise<{ igAccountId: string; accessToken: string } | null> {
    const channel = await prisma.channel.findUnique({ where: { storeId_type: { storeId, type: 'INSTAGRAM' } } });
    if (channel?.connected && channel.credentials && channel.externalId) {
      try {
        const { token } = channel.credentials as { token: string };
        return { igAccountId: channel.externalId, accessToken: decryptSecret(token) };
      } catch (err) {
        console.error('Failed to decrypt stored Instagram credentials:', err);
      }
    }
    return null;
  }

  // Generates an AI reply for a conversation and either delivers it immediately (Copilot
  // on / AI_MANAGED) or stores it as a pending draft awaiting merchant approval (Copilot
  // off / manual). Only delivers externally (e.g. Messenger) when actually sent.
  async function generateAndStoreAgentReply(conversation: { id: string; storeId: string; status: string; channelType: string; externalUserId: string | null; isComplaint: boolean }, customerText: string) {
    const [store, products, recentMessages, currentConversation] = await Promise.all([
      prisma.store.findUnique({ where: { id: conversation.storeId } }),
      prisma.product.findMany({ where: { storeId: conversation.storeId } }),
      prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' } }),
      prisma.conversation.findUnique({ where: { id: conversation.id } }),
    ]);
    if (!store || !currentConversation) return;

    const persona = { tone: store.tone, style: store.style, customInstructions: store.customInstructions };
    const catalog = products.map((p) => ({
      name: p.name,
      sku: p.sku,
      price: Number(p.price),
      inventory: p.inventory,
      status: p.status === 'TRAINED' ? 'Trained' : 'Pending',
    }));
    // Cap history sent to the model — an unbounded prompt grows with every message in a
    // long-running conversation, which slows down local LLM inference noticeably.
    const history = recentMessages.slice(0, -1).slice(-10).map((m) => ({ sender: m.sender.toLowerCase(), text: m.text }));

    const existingCart: { sku: string; quantity: number }[] = (currentConversation.cart as any) || [];

    // Decode the prefix-encoded state stored in awaitingQuantityFor:
    //   "CONFIRM:SKU:QTY"  → customer gave quantity; AI asked to confirm; waiting for yes/no
    //   "DETAILS:SKU:QTY"  → customer confirmed; AI asked for phone+address; waiting for contact info
    //   "SKU"              → existing two-step: AI asked how many for this SKU
    //   null               → idle
    const rawAWQ = currentConversation.awaitingQuantityFor;
    const isConfirmState = rawAWQ?.startsWith('CONFIRM:') ?? false;
    const isDetailsState = rawAWQ?.startsWith('DETAILS:') ?? false;

    let pendingEncodedSku: string | null = null;
    let pendingEncodedQty = 0;
    if ((isConfirmState || isDetailsState) && rawAWQ) {
      const parts = rawAWQ.split(':');
      if (parts.length >= 3) {
        pendingEncodedSku = parts[1];
        pendingEncodedQty = parseInt(parts[2], 10) || 0;
      }
    }
    const pendingProduct = pendingEncodedSku ? products.find((p) => p.sku === pendingEncodedSku) : null;

    const orderState = {
      // Pass null to the model when in CONFIRM/DETAILS states so it doesn't think we're
      // still waiting for a plain quantity answer.
      awaitingQuantityFor: isConfirmState || isDetailsState ? null : rawAWQ,
      orderConfirmationRequested: currentConversation.orderConfirmationRequested,
      hasCartItems: existingCart.length > 0,
      hasAddress: !!currentConversation.detectedAddress,
      cartItems: existingCart.map((item) => ({
        sku: item.sku,
        name: products.find((p) => p.sku === item.sku)?.name || item.sku,
        quantity: item.quantity,
      })),
      // CONFIRM state: decoded pending item so the model/fallback can show it and ask yes/no
      pendingItem: isConfirmState && pendingProduct && pendingEncodedQty > 0 ? {
        sku: pendingEncodedSku!,
        name: pendingProduct.name,
        quantity: pendingEncodedQty,
        unitPrice: Number(pendingProduct.price),
        lineTotal: Number(pendingProduct.price) * pendingEncodedQty,
      } : undefined,
      // DETAILS state: signals to the model/fallback to extract phone+address
      awaitingContactDetails: isDetailsState,
    };

    const result = await generateAgentReply({ message: customerText, history, persona, catalog, orderState });
    const isAutopilot = conversation.status === 'AI_MANAGED';

    // CART-ADD INTERCEPTION: If the agent (Ollama or fallback) returned cartAction='add',
    // redirect through the confirmation-first flow rather than writing to cart immediately.
    // This fires when Ollama ignores our "NEVER cartAction='add'" instruction (quantized models
    // frequently do) and is a no-op when the fallback is used (fallback already produces the
    // CONFIRM: prefix natively and never sets action='add').
    if (
      result.cartAction?.action === 'add' &&
      result.cartAction.sku &&
      result.cartAction.quantity > 0 &&
      !isConfirmState &&
      !isDetailsState &&
      !currentConversation.orderConfirmationRequested
    ) {
      const interceptProduct = products.find((p) => p.sku === result.cartAction.sku);
      if (interceptProduct && interceptProduct.inventory > 0) {
        const qty = Math.max(1, Math.floor(result.cartAction.quantity));
        const price = Number(interceptProduct.price);
        const total = price * qty;
        result.replyText = `You'd like ${qty}x ${interceptProduct.name} at $${price.toFixed(2)} each — total $${total.toFixed(2)}. Would you like to confirm this order?`;
        result.cartAction = { action: 'none', sku: '', quantity: 0 };
        result.askQuantityForSku = `CONFIRM:${interceptProduct.sku}:${qty}`;
        result.orderConfirmationRequested = false;
        result.orderConfirmed = false;
        result.orderCancelled = false;
      }
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: 'AI', text: result.replyText, meta: result as any, pending: !isAutopilot },
    });

    // Build the cart from the AI's detected intent — only ever adds a real, in-stock
    // catalog item, never invents one. This is separate from actually placing an order,
    // which either the merchant confirms explicitly (Generate Order) or the AI
    // auto-finalizes once the customer confirms, if the store allows it (see below).
    const conversationData: any = { lastMessageAt: new Date(), isComplaint: result.isComplaint || conversation.isComplaint };

    // Detect "start fresh" / "clear cart" / "remove everything" intent — reset cart and all order state.
    const lowerCustomerText = customerText.toLowerCase();
    const isStartFresh =
      lowerCustomerText.includes('start fresh') ||
      lowerCustomerText.includes('start over') ||
      lowerCustomerText.includes('clear cart') ||
      lowerCustomerText.includes('empty my cart') ||
      lowerCustomerText.includes('empty the cart') ||
      lowerCustomerText.includes('reset cart') ||
      lowerCustomerText.includes('shuru theke') ||
      lowerCustomerText.includes('cancel everything') ||
      lowerCustomerText.includes('remove everything') ||
      lowerCustomerText.includes('remove all') ||
      lowerCustomerText.includes('delete everything') ||
      lowerCustomerText.includes('shob delete') ||
      lowerCustomerText.includes('shob remove') ||
      lowerCustomerText.includes('naya shuru') ||
      lowerCustomerText.includes('notun kore');
    if (isStartFresh) {
      conversationData.cart = [];
      conversationData.awaitingQuantityFor = null;
      conversationData.detectedAddress = null;
      conversationData.orderConfirmationRequested = false;
      conversationData.orderConfirmed = false;
      conversationData.orderSummaryShown = false;
      // Still save the AI's reply (which will say "Done! I've cleared your cart...")
      await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'AI', text: result.replyText, meta: result as any, pending: !isAutopilot },
      });
      await prisma.conversation.update({ where: { id: conversation.id }, data: conversationData });
      return;
    }

    let updatedCart = existingCart;

    // SERVER-SIDE CART GUARD: Allow a cart write in two cases:
    //   (a) Two-step flow: the AI was explicitly waiting for a quantity for this exact SKU
    //       (awaitingQuantityFor === cartAction.sku).
    //   (b) One-step flow: the customer stated a product name and quantity in one message
    //       (e.g. "I want 2 Coca Cola") and awaitingQuantityFor is null — no prior
    //       quantity-request turn is required when the quantity is already explicit.
    // Both cases still require the SKU to resolve to a real, in-stock product (checked
    // in the block below). Confirmation turns, price-inquiry turns, and address turns are
    // all rejected because the AI returns action='none' on those turns.
    // The new flow never uses cartAction='add' — cart writes happen server-side in the
    // DETAILS state transition. This guard now only applies to legacy direct-cart-add paths.
    const cartAddAllowed =
      result.cartAction?.action === 'add' &&
      result.cartAction.sku &&
      result.cartAction.quantity > 0 &&
      !isConfirmState &&
      !isDetailsState &&
      (currentConversation.awaitingQuantityFor === result.cartAction.sku ||
       (currentConversation.awaitingQuantityFor === null && !currentConversation.orderConfirmationRequested));

    if (cartAddAllowed) {
      const product = products.find((p) => p.sku === result.cartAction.sku);
      if (product && product.inventory > 0) {
        const quantity = result.cartAction.quantity && result.cartAction.quantity > 0 ? Math.floor(result.cartAction.quantity) : 1;
        const existingItem = existingCart.find((item) => item.sku === product.sku);
        updatedCart = existingItem
          ? existingCart.map((item) => (item.sku === product.sku ? { ...item, quantity } : item))
          : [...existingCart, { sku: product.sku, quantity }];
        conversationData.cart = updatedCart;
        conversationData.awaitingQuantityFor = null;
      }
    }

    if (result.askQuantityForSku) {
      conversationData.awaitingQuantityFor = result.askQuantityForSku;
    }

    let updatedAddress = currentConversation.detectedAddress;
    if (result.extractedAddress && result.extractedAddress.trim()) {
      updatedAddress = result.extractedAddress.trim();
      conversationData.detectedAddress = updatedAddress;
    }

    if (result.orderConfirmationRequested) {
      conversationData.orderConfirmationRequested = true;
      conversationData.orderSummaryShown = true;
    }

    // Only trust a customer's "yes" as a real confirmation if the AI actually asked for
    // one in a previous turn — otherwise a stray "yes" to an unrelated question could
    // trigger a real order.
    const customerConfirmedForReal = result.orderConfirmed && currentConversation.orderConfirmationRequested;
    if (customerConfirmedForReal) {
      conversationData.orderConfirmed = true;
    }

    // When the customer explicitly cancels a pending confirmation, reset confirmation
    // flags so the conversation returns to a normal shopping state. Cart and address are
    // deliberately kept so the customer can modify items and re-confirm later if they wish.
    const customerCancelledForReal = result.orderCancelled && currentConversation.orderConfirmationRequested;
    if (customerCancelledForReal) {
      conversationData.orderConfirmationRequested = false;
      conversationData.orderConfirmed = false;
    }

    // === NEW CHECKOUT STATE MACHINE ===
    // After all standard state writes above, explicitly manage the CONFIRM/DETAILS states.
    // These assignments override whatever result.askQuantityForSku wrote into conversationData.

    if (isConfirmState) {
      if (result.orderConfirmed && pendingEncodedSku && pendingEncodedQty > 0) {
        // Customer confirmed the pre-add summary → move to DETAILS state
        conversationData.awaitingQuantityFor = `DETAILS:${pendingEncodedSku}:${pendingEncodedQty}`;
      } else if (result.orderCancelled) {
        // Customer declined → clear state entirely, keep cart (which is empty at this stage)
        conversationData.awaitingQuantityFor = null;
      } else {
        // No clear answer yet (unclear message / re-ask) → stay in CONFIRM state
        conversationData.awaitingQuantityFor = rawAWQ;
      }
    } else if (isDetailsState) {
      // Use address from this turn, OR from a prior turn (Ollama sometimes stores address in
      // replyText / detectedAddress without re-emitting it in extractedAddress).
      const detailsContactInfo = result.extractedAddress || currentConversation.detectedAddress || '';
      if (detailsContactInfo && pendingEncodedSku && pendingEncodedQty > 0) {
        // We have everything needed to create the order — clear DETAILS state.
        conversationData.awaitingQuantityFor = null;
        if (result.extractedAddress) {
          conversationData.detectedAddress = result.extractedAddress;
        }
      } else {
        // Still waiting for contact info — stay in DETAILS state.
        conversationData.awaitingQuantityFor = rawAWQ;
      }
    }

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: conversationData,
    });

    // DETAILS state: customer provided phone+address (or already had address on file and
    // confirmed) → add the pending item to cart and create the order atomically.
    // Use extractedAddress from this turn OR the previously stored detectedAddress so that
    // an Ollama model that notes the address in replyText but forgets to fill extractedAddress
    // still triggers order creation on a subsequent "Yes" / affirmative turn.
    if (isDetailsState && pendingEncodedSku && pendingEncodedQty > 0) {
      const detailsContactInfo = result.extractedAddress || currentConversation.detectedAddress || '';
      if (detailsContactInfo) {
        const detailsProduct = products.find((p) => p.sku === pendingEncodedSku);
        if (detailsProduct && detailsProduct.inventory >= pendingEncodedQty) {
          try {
            await createOrderForConversation(
              { id: conversation.id, storeId: conversation.storeId, customerName: currentConversation.customerName },
              [{ sku: pendingEncodedSku!, quantity: pendingEncodedQty }],
              detailsContactInfo,
            );
          } catch (err: any) {
            console.error('New-flow order creation failed:', err.message);
          }
        } else {
          console.warn(`New-flow order skipped: product "${pendingEncodedSku}" not found in catalog or insufficient inventory (need ${pendingEncodedQty})`);
        }
      }
    }

    // Auto-finalize: only when the customer's confirmation is genuine, there's actually
    // something to order, and the store has opted into AI-driven finalization for this
    // conversation's Copilot mode (autopilot always qualifies; manual mode only if the
    // merchant has separately turned on "always auto-finalize" for the store).
    //
    // The new confirmation-first flow clears the cart before order creation, so also
    // handle the case where the cart is empty but a pending item is available from the
    // CONFIRM/DETAILS encoded state (Ollama may drive `orderConfirmationRequested` outside
    // our prefix system; the pending item gives us the SKU+qty to order in that case).
    if (customerConfirmedForReal && updatedAddress) {
      const eligible = isAutopilot || store.autoFinalizeOrdersAlways;
      if (eligible) {
        if (updatedCart.length > 0) {
          // Standard path: cart has items (old flow or fallback with items already added)
          try {
            await createOrderForConversation(
              { id: conversation.id, storeId: conversation.storeId, customerName: currentConversation.customerName },
              updatedCart,
              updatedAddress
            );
          } catch (err) {
            console.error('Auto-finalize order failed:', err);
          }
        } else if (pendingEncodedSku && pendingEncodedQty > 0) {
          // New-flow path: cart empty but we have the pending item from CONFIRM/DETAILS state
          const pendingCartProduct = products.find((p) => p.sku === pendingEncodedSku);
          if (pendingCartProduct && pendingCartProduct.inventory >= pendingEncodedQty) {
            try {
              await createOrderForConversation(
                { id: conversation.id, storeId: conversation.storeId, customerName: currentConversation.customerName },
                [{ sku: pendingEncodedSku!, quantity: pendingEncodedQty }],
                updatedAddress,
              );
            } catch (err) {
              console.error('Auto-finalize new-flow order failed:', err);
            }
          }
        }
      }
    }

    if (isAutopilot && conversation.channelType === 'FACEBOOK' && conversation.externalUserId) {
      const pageAccessToken = await getPageAccessTokenForStore(conversation.storeId);
      if (pageAccessToken) {
        try {
          await sendMessengerMessage(pageAccessToken, conversation.externalUserId, result.replyText);
        } catch (err) {
          console.error('Failed to deliver AI reply to Messenger:', err);
        }
      }
    }

    if (isAutopilot && conversation.channelType === 'WHATSAPP' && conversation.externalUserId) {
      const waCreds = await getWhatsAppCredentialsForStore(conversation.storeId);
      if (waCreds) {
        try {
          await sendWhatsAppMessage(waCreds.phoneNumberId, waCreds.accessToken, conversation.externalUserId, result.replyText);
        } catch (err) {
          console.error('Failed to deliver AI reply to WhatsApp:', err);
        }
      }
    }

    if (isAutopilot && conversation.channelType === 'INSTAGRAM' && conversation.externalUserId) {
      const igCreds = await getInstagramCredentialsForStore(conversation.storeId);
      if (igCreds) {
        try {
          await sendInstagramMessage(igCreds.igAccountId, igCreds.accessToken, conversation.externalUserId, result.replyText);
        } catch (err) {
          console.error('Failed to deliver AI reply to Instagram:', err);
        }
      }
    }
  }

  // Derived, real-time notifications: unread/complaint conversations + low-stock products.
  // Computed on the fly rather than stored, since these all resolve naturally elsewhere
  // (opening a conversation marks it read; restocking a product clears its low-stock alert).
  app.get('/api/notifications', requireAuth, async (req: AuthedRequest, res) => {
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
  app.get('/api/conversations', requireAuth, async (req: AuthedRequest, res) => {
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
  app.patch('/api/conversations/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const conversation = await prisma.conversation.findUnique({ where: { id: req.params.id } });
      if (!conversation || conversation.storeId !== req.auth!.storeId) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const { status, cart } = req.body;
      const dataToUpdate: any = {};

      if (status) {
        const mappedStatus = FRONTEND_TO_STATUS[status];
        if (!mappedStatus) {
          return res.status(400).json({ error: 'Invalid status' });
        }
        dataToUpdate.status = mappedStatus;
      }

      if (cart !== undefined) {
        dataToUpdate.cart = cart;
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

  // Sends a message into a conversation. `sender: 'merchant'` posts the merchant's own
  // reply (delivered to the real customer via the channel adapter when applicable, e.g.
  // Facebook Messenger); omitting it (or 'customer') simulates an incoming customer
  // message for demo/testing channels that have no real external customer, and triggers
  // an AI reply if the conversation is AI-managed.
  app.post('/api/conversations/:id/messages', requireAuth, async (req: AuthedRequest, res) => {
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
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  // Approves a pending AI draft (Copilot-off mode): delivers it to the real customer
  // (e.g. via Messenger/WhatsApp) when applicable, and marks it as sent.
  app.post('/api/conversations/:id/messages/:messageId/approve', requireAuth, async (req: AuthedRequest, res) => {
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

  // API endpoint for AI responses
  app.post('/api/chat', async (req, res) => {
    try {
      const { message, history = [], persona, catalog = [] } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const result = await generateAgentReply({ message, history, persona, catalog });
      return res.json(result);
    } catch (err: any) {
      console.error('Server error handling chat:', err);
      res.status(500).json({ error: 'Failed to process conversation: ' + err.message });
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
    // Meta's webhook delivery is "at-least-once" — it may redeliver the same event.
    // Bail out immediately if we've already recorded this exact message.
    const alreadyProcessed = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (alreadyProcessed) {
      console.log('Duplicate Messenger webhook event, skipping:', externalMessageId);
      return;
    }

    // A real self-serve OAuth connection always has a Channel row keyed by this exact
    // Page ID (see finalizeFacebookConnection). There is no fallback: a Page that hasn't
    // been connected through that flow has no known store to attach the message to, so
    // it's dropped rather than guessed at.
    const channel = await prisma.channel.findFirst({ where: { type: 'FACEBOOK', connected: true, externalId: pageId } });
    if (!channel) {
      console.error('Ignoring Messenger event for unconnected Page:', pageId);
      return;
    }
    const storeId = channel.storeId;

    let conversation = await prisma.conversation.findFirst({
      where: { storeId, channelType: 'FACEBOOK', externalUserId: senderPsid },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { storeId, channelType: 'FACEBOOK', externalUserId: senderPsid, lastMessageAt: new Date() },
      });
    }

    // Backfill the customer's real name if we don't have one yet — covers both brand-new
    // conversations and older ones created before this profile lookup existed.
    if (!conversation.customerName) {
      const pageAccessToken = await getPageAccessTokenForStore(storeId);
      const customerName = pageAccessToken ? await fetchMessengerProfileName(pageAccessToken, senderPsid) : null;
      if (customerName) {
        conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: { customerName } });
      }
    }

    try {
      await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'CUSTOMER', text: messageText, externalId: externalMessageId },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Lost a race with a concurrent redelivery of the same event — the other one wins.
        console.log('Duplicate Messenger webhook event (race), skipping:', externalMessageId);
        return;
      }
      throw err;
    }

    await generateAndStoreAgentReply(conversation, messageText);
  }

  async function handleIncomingWhatsAppMessage(phoneNumberId: string, senderWaId: string, messageText: string, externalMessageId: string, customerName?: string) {
    const alreadyProcessed = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (alreadyProcessed) {
      console.log('Duplicate WhatsApp webhook event, skipping:', externalMessageId);
      return;
    }

    const channel = await prisma.channel.findFirst({ where: { type: 'WHATSAPP', connected: true, externalId: phoneNumberId } });
    if (!channel) {
      console.error('Ignoring WhatsApp event for unconnected Phone Number ID:', phoneNumberId);
      return;
    }
    const storeId = channel.storeId;

    let conversation = await prisma.conversation.findFirst({
      where: { storeId, channelType: 'WHATSAPP', externalUserId: senderWaId },
    });
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
        console.log('Duplicate WhatsApp webhook event (race), skipping:', externalMessageId);
        return;
      }
      throw err;
    }

    await generateAndStoreAgentReply(conversation, messageText);
  }

  async function handleIncomingInstagramMessage(igAccountId: string, senderIgUserId: string, messageText: string, externalMessageId: string) {
    const alreadyProcessed = await prisma.message.findUnique({ where: { externalId: externalMessageId } });
    if (alreadyProcessed) {
      console.log('Duplicate Instagram webhook event, skipping:', externalMessageId);
      return;
    }

    const channel = await prisma.channel.findFirst({ where: { type: 'INSTAGRAM', connected: true, externalId: igAccountId } });
    if (!channel) {
      console.error('Ignoring Instagram event for unconnected Account ID:', igAccountId);
      return;
    }
    const storeId = channel.storeId;

    let conversation = await prisma.conversation.findFirst({
      where: { storeId, channelType: 'INSTAGRAM', externalUserId: senderIgUserId },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { storeId, channelType: 'INSTAGRAM', externalUserId: senderIgUserId, lastMessageAt: new Date() },
      });
    }

    if (!conversation.customerName) {
      const igCreds = await getInstagramCredentialsForStore(storeId);
      const customerName = igCreds ? await fetchInstagramProfileName(igCreds.accessToken, senderIgUserId) : null;
      if (customerName) {
        conversation = await prisma.conversation.update({ where: { id: conversation.id }, data: { customerName: `@${customerName}` } });
      }
    }

    try {
      await prisma.message.create({
        data: { conversationId: conversation.id, sender: 'CUSTOMER', text: messageText, externalId: externalMessageId },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        console.log('Duplicate Instagram webhook event (race), skipping:', externalMessageId);
        return;
      }
      throw err;
    }

    await generateAndStoreAgentReply(conversation, messageText);
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
    res.json({ status: 'ok', ollamaEnabled });
  });

  // Static privacy policy page (required by Meta's App Basic Settings to enable
  // Facebook Login / App Domains). Plain HTML on purpose — it's a legal document,
  // not part of the SPA's tab-based navigation.
  app.get('/privacy', (req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Privacy Policy — ShopMate AI</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { background:#070708; color:#e2e2e2; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 48px 24px; line-height: 1.6; }
  h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
  h2 { font-size: 1.15rem; margin-top: 2rem; color: #fff; }
  p, li { color: #b8b8bc; font-size: 0.95rem; }
  a { color: #e2e2e2; }
</style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p>ShopMate AI is a student capstone project (CSE499) that lets a merchant connect a Facebook Page so an AI assistant can help answer customer messages using the merchant's own product catalog.</p>

  <h2>What we collect</h2>
  <ul>
    <li>Merchant account info: name, email, password (hashed, never stored in plain text).</li>
    <li>Product catalog data the merchant enters (names, SKUs, prices, inventory).</li>
    <li>Customer conversation content from connected channels (Facebook Messenger, or the website chat widget), so the AI can generate relevant replies and the merchant can review the conversation history.</li>
    <li>The Facebook Page Access Token issued when a merchant connects their Page via Facebook Login, stored encrypted, used only to receive and send messages on that Page's behalf.</li>
  </ul>

  <h2>How it's used</h2>
  <p>Conversation content is sent to Google's Gemini API to generate a suggested or automatic reply. It is not sold, shared with advertisers, or used for any purpose beyond powering this messaging assistant.</p>

  <h2>Data retention</h2>
  <p>Data is retained for as long as the merchant's account is active. As this is an educational project, data may be periodically reset during development and testing.</p>

  <h2>Third parties</h2>
  <p>We use Meta's Graph API (to send/receive Facebook Messenger messages) and Google's Gemini API (to generate AI replies). Each is governed by its own respective privacy policy.</p>

  <h2>Contact</h2>
  <p>Questions about this policy can be directed to the project maintainers via the contact email on file with this app's Meta Developer account.</p>
</body>
</html>`);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    warmUpOllama();
  });
}

startServer();

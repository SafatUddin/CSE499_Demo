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
  fetchMessengerProfileName,
  getFacebookOAuthUrl,
  exchangeCodeForUserToken,
  listManagedPages,
  subscribePageWebhook,
  ManagedPage,
} from './server/meta';
import { encryptSecret, decryptSecret } from './server/crypto';

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
    try {
      await subscribePageWebhook(page.id, page.access_token);
    } catch (err) {
      console.error('Failed to auto-subscribe Facebook Page webhook:', err);
    }
  }

  // List this store's real channel connections (currently just Facebook; other
  // platforms in the UI are still mock toggles, see CLAUDE.md)
  app.get('/api/channels', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const channels = await prisma.channel.findMany({ where: { storeId: req.auth!.storeId } });
      res.json(channels.map((c) => ({
        type: CHANNEL_TYPE_TO_FRONTEND[c.type] || c.type.toLowerCase(),
        connected: c.connected,
        name: (c.credentials as any)?.name || null,
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

  // Facebook redirects here after the merchant approves (or denies) access.
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

      if (pages.length === 0) {
        return res.redirect(`${frontendBase}/#integrations?fbError=no_pages`);
      }

      if (pages.length === 1) {
        await finalizeFacebookConnection(storeId, pages[0]);
        return res.redirect(`${frontendBase}/#integrations?fbConnected=1`);
      }

      // Multiple Pages — let the merchant choose. Their tokens travel only inside this
      // short-lived signed token, never exposed to the frontend directly.
      const pendingToken = signState({ storeId, pages }, '10m');
      res.redirect(`${frontendBase}/#integrations?fbPending=${encodeURIComponent(pendingToken)}`);
    } catch (err) {
      console.error('Facebook OAuth callback error:', err);
      res.redirect(`${frontendBase}/#integrations?fbError=server_error`);
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
  // (see generateAndStoreAgentReply) — builds line items from the current catalog,
  // creates the Order row, and clears the conversation's cart.
  async function createOrderForConversation(
    conversation: { id: string; storeId: string; customerName: string | null },
    cart: { sku: string; quantity: number }[],
    address: string,
    customerNameOverride?: string
  ) {
    const products = await prisma.product.findMany({
      where: { storeId: conversation.storeId, sku: { in: cart.map((item) => item.sku) } },
    });

    const items = cart.map((cartItem) => {
      const product = products.find((p) => p.sku === cartItem.sku);
      return {
        sku: cartItem.sku,
        name: product?.name || cartItem.sku,
        price: product ? Number(product.price) : 0,
        quantity: cartItem.quantity,
      };
    });
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await prisma.order.create({
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
    await prisma.conversation.update({
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
      console.error('Create order error:', err);
      res.status(500).json({ error: 'Failed to create order' });
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
    const orderState = {
      awaitingQuantityFor: currentConversation.awaitingQuantityFor,
      orderConfirmationRequested: currentConversation.orderConfirmationRequested,
      hasCartItems: existingCart.length > 0,
      hasAddress: !!currentConversation.detectedAddress,
      cartItems: existingCart.map((item) => ({
        sku: item.sku,
        name: products.find((p) => p.sku === item.sku)?.name || item.sku,
        quantity: item.quantity,
      })),
    };

    const result = await generateAgentReply({ message: customerText, history, persona, catalog, orderState });
    const isAutopilot = conversation.status === 'AI_MANAGED';

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

    // SERVER-SIDE CART GUARD: Only allow a cart write when the AI was explicitly waiting
    // for a quantity answer for that exact SKU. This prevents the Ollama model from
    // autonomously adding items on price-inquiry turns, confirmation turns, or any other
    // turn where the customer didn't actually state a quantity.
    const cartAddAllowed =
      result.cartAction?.action === 'add' &&
      result.cartAction.sku &&
      currentConversation.awaitingQuantityFor === result.cartAction.sku;

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

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: conversationData,
    });

    // Auto-finalize: only when the customer's confirmation is genuine, there's actually
    // something to order, and the store has opted into AI-driven finalization for this
    // conversation's Copilot mode (autopilot always qualifies; manual mode only if the
    // merchant has separately turned on "always auto-finalize" for the store).
    if (customerConfirmedForReal && updatedCart.length > 0 && updatedAddress) {
      const eligible = isAutopilot || store.autoFinalizeOrdersAlways;
      if (eligible) {
        try {
          await createOrderForConversation(
            { id: conversation.id, storeId: conversation.storeId, customerName: currentConversation.customerName },
            updatedCart,
            updatedAddress
          );
        } catch (err) {
          console.error('Auto-finalize order failed:', err);
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
  // (e.g. via Messenger) when applicable, and marks it as sent.
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
      if (body.object !== 'page') return;

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

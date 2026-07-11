import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { prisma } from './server/db';
import { signToken, requireAuth, AuthedRequest } from './server/auth';
import { ai } from './server/gemini';
import { generateAgentReply } from './server/agent';
import { verifyMetaSignature, sendMessengerMessage } from './server/meta';

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

  // Get this store's AI persona
  app.get('/api/persona', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const store = await prisma.store.findUnique({ where: { id: req.auth!.storeId } });
      if (!store) {
        return res.status(404).json({ error: 'Store not found' });
      }
      res.json({ tone: store.tone, style: store.style, customInstructions: store.customInstructions });
    } catch (err: any) {
      console.error('Fetch persona error:', err);
      res.status(500).json({ error: 'Failed to load persona' });
    }
  });

  // Update this store's AI persona
  app.put('/api/persona', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { tone, style, customInstructions } = req.body;
      if (!tone || !style) {
        return res.status(400).json({ error: 'Tone and style are required' });
      }
      const store = await prisma.store.update({
        where: { id: req.auth!.storeId },
        data: { tone, style, customInstructions: customInstructions ?? '' },
      });
      res.json({ tone: store.tone, style: store.style, customInstructions: store.customInstructions });
    } catch (err: any) {
      console.error('Update persona error:', err);
      res.status(500).json({ error: 'Failed to update persona' });
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

  async function handleIncomingMessengerMessage(pageId: string, senderPsid: string, messageText: string) {
    const pageAccessToken = process.env.META_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
      console.error('META_PAGE_ACCESS_TOKEN not set; cannot reply to Messenger');
      return;
    }

    // This manual-token test phase has no self-serve "Connect with Facebook" flow yet
    // (that's Option B in the roadmap), so there's no Channel row created via OAuth.
    // Attach this Page to whichever store doesn't already have a Facebook channel.
    let channel = await prisma.channel.findFirst({ where: { type: 'FACEBOOK', externalId: pageId } });
    let storeId: string;
    if (channel) {
      storeId = channel.storeId;
    } else {
      const store = await prisma.store.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!store) {
        console.error('No store found to attach the Facebook channel to');
        return;
      }
      storeId = store.id;
      await prisma.channel.upsert({
        where: { storeId_type: { storeId, type: 'FACEBOOK' } },
        update: { connected: true, externalId: pageId },
        create: { storeId, type: 'FACEBOOK', connected: true, externalId: pageId },
      });
    }

    let conversation = await prisma.conversation.findFirst({
      where: { storeId, channelType: 'FACEBOOK', externalUserId: senderPsid },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { storeId, channelType: 'FACEBOOK', externalUserId: senderPsid, lastMessageAt: new Date() },
      });
    }

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: 'CUSTOMER', text: messageText },
    });

    if (conversation.status !== 'AI_MANAGED') {
      // Merchant has taken over this conversation manually; don't auto-reply.
      return;
    }

    const [store, products, recentMessages] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId } }),
      prisma.product.findMany({ where: { storeId } }),
      prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'asc' }, take: 20 }),
    ]);
    if (!store) return;

    const persona = { tone: store.tone, style: store.style, customInstructions: store.customInstructions };
    const catalog = products.map((p) => ({
      name: p.name,
      sku: p.sku,
      price: Number(p.price),
      inventory: p.inventory,
      status: p.status === 'TRAINED' ? 'Trained' : 'Pending',
    }));
    // Drop the last entry — it's the customer message we just inserted, sent separately below.
    const history = recentMessages.slice(0, -1).map((m) => ({ sender: m.sender.toLowerCase(), text: m.text }));

    const result = await generateAgentReply({ message: messageText, history, persona, catalog });

    await prisma.message.create({
      data: { conversationId: conversation.id, sender: 'AI', text: result.replyText, meta: result as any },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), isComplaint: result.isComplaint || conversation.isComplaint },
    });

    try {
      await sendMessengerMessage(pageAccessToken, senderPsid, result.replyText);
    } catch (err) {
      console.error('Failed to send Messenger reply:', err);
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
      if (body.object !== 'page') return;

      for (const entry of body.entry || []) {
        const pageId = entry.id;
        for (const event of entry.messaging || []) {
          const senderPsid = event.sender?.id;
          const messageText = event.message?.text;
          if (!senderPsid || !messageText || event.message?.is_echo) continue;

          await handleIncomingMessengerMessage(pageId, senderPsid, messageText);
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

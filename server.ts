import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { prisma } from './server/db';
import { signToken, requireAuth, AuthedRequest } from './server/auth';

dotenv.config();

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json());
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

      // Format catalog description for the model context
      const catalogText = catalog
        .map(
          (p: any) =>
            `- Name: ${p.name}, SKU: ${p.sku}, Price: $${p.price}, Inventory: ${p.inventory} units, Status: ${p.status}`
        )
        .join('\n');

      const toneText = persona?.tone || 'Direct, helpful, and highly sophisticated.';
      const styleText =
        persona?.style === 'bullets'
          ? 'Use bullet points for lists, specifications, or pricing whenever possible.'
          : 'Use a fluid, warm, conversational narrative style. Do not use bullets.';
      const customInst = persona?.customInstructions || '';

      const systemInstruction = `You are ShopMate AI, an elite autonomous sales agent representing the merchant's store.
Your goal is to answer customer questions with surgical precision, handle complaints or objections, and actively guide the conversation toward adding items to their cart or closing a sale.

You must respond with a JSON object containing the exact properties specified in the response schema:
1. replyText: Your conversational response to the customer. Maintain your persona.
2. isComplaint: Set to true if the customer is expressing dissatisfaction, complaining, reporting issues, or requesting refunds/exchanges.
3. cartAction: An object with 'action' ('add' or 'none') and 'sku' (string). Set action to 'add' if the customer expresses explicit intent to buy, purchase, or add an item to their cart, and specify the product SKU.
4. suggestedProductsSKUs: An array of strings representing product SKUs to cross-sell or recommend as alternatives based on their interest.

Core Directives:
1. Use the provided Product Catalog below to reference accurate prices, names, and stock levels. Never invent products or hallucinate details.
2. Keep your answers concise, engaging, and professional. 
3. Under no circumstances mention that you are a language model or AI assistant from Google. You are ShopMate AI, built natively for this merchant.
4. If a product is out of stock (inventory is 0), do not add it to the cart; instead, politely inform the customer and suggest an alternative product that is in stock.
5. Support multilingual queries naturally (Bangla, English, and "Banglish" - romanized/code-mixed Bangla). Respond in the same language register the customer used.

Tone of Voice:
${toneText}

Response Style:
${styleText}

Additional Store Instructions:
${customInst}

Available Product Catalog:
${catalogText || 'No products registered in catalog.'}`;

      // Assemble chat format for Gemini API
      const contentsPayload: any[] = [];
      
      // Map history to part structure
      history.forEach((h: any) => {
        contentsPayload.push({
          role: h.sender === 'customer' ? 'user' : 'model',
          parts: [{ text: h.text }],
        });
      });

      // Push latest user message
      contentsPayload.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // If AI client is configured, run the live model
      if (ai) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: contentsPayload,
            config: {
              systemInstruction,
              temperature: 0.7,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  replyText: {
                    type: Type.STRING,
                    description: 'The conversational response to the customer. Under no circumstances mention you are an AI from Google.'
                  },
                  isComplaint: {
                    type: Type.BOOLEAN,
                    description: 'Whether the user is complaining or dissatisfied.'
                  },
                  cartAction: {
                    type: Type.OBJECT,
                    description: 'Action to build customer cart.',
                    properties: {
                      action: {
                        type: Type.STRING,
                        description: "Can be 'add' or 'none'. Set to 'add' if customer wants to purchase or checkout."
                      },
                      sku: {
                        type: Type.STRING,
                        description: 'The exact SKU of the product to add to cart, e.g., NX-402-B.'
                      }
                    },
                    required: ['action', 'sku']
                  },
                  suggestedProductsSKUs: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'SKUs of relevant products to suggest for cross-sell.'
                  }
                },
                required: ['replyText', 'isComplaint', 'cartAction', 'suggestedProductsSKUs']
              }
            },
          });

          if (response.text) {
            const parsed = JSON.parse(response.text.trim());
            return res.json(parsed);
          }
        } catch (geminiError: any) {
          console.error('Gemini call failed, falling back to simulated logic:', geminiError.message);
          // Fall through to fallback simulator
        }
      }

      // High-fidelity local fallback simulation if Gemini is not set up
      const lowerMsg = message.toLowerCase();
      let replyText = '';
      let isComplaint = false;
      let cartAction = { action: 'none', sku: '' };
      let suggestedProductsSKUs: string[] = [];

      // Detect complaints
      if (
        lowerMsg.includes('broken') ||
        lowerMsg.includes('scam') ||
        lowerMsg.includes('worst') ||
        lowerMsg.includes('refund') ||
        lowerMsg.includes('fake') ||
        lowerMsg.includes('cancel') ||
        lowerMsg.includes('bad') ||
        lowerMsg.includes('defect') ||
        lowerMsg.includes('late') ||
        lowerMsg.includes('unhappy')
      ) {
        isComplaint = true;
        replyText = `I am truly sorry to hear that you are experiencing this issue. Your feedback is extremely important to us. I have logged this immediately as a high-priority support ticket and escalated this conversation to our senior management team for a direct review. We will contact you within the hour to resolve this.`;
      } 
      // Detect checkout intents
      else if (
        lowerMsg.includes('checkout') ||
        lowerMsg.includes('buy') ||
        lowerMsg.includes('order') ||
        lowerMsg.includes('purchase') ||
        lowerMsg.includes('add to cart') ||
        lowerMsg.includes('link')
      ) {
        // Try to match a product SKU or name
        const found = catalog.find((p: any) => 
          lowerMsg.includes(p.name.toLowerCase().split(' ')[0]) || 
          lowerMsg.includes(p.sku.toLowerCase())
        ) || catalog[0];

        if (found) {
          if (found.inventory <= 0) {
            replyText = `The ${found.name} is currently out of stock. Would you be interested in any other premium item from our catalog?`;
          } else {
            cartAction = { action: 'add', sku: found.sku };
            replyText = `Excellent choice! I have successfully added the ${found.name} (SKU: ${found.sku}, Price: $${found.price}) to your digital shopping cart. I have generated your order checkout summary below. Tap 'Complete Checkout' to finalize your purchase!`;
            // Recommend some other SKUs as upsell
            suggestedProductsSKUs = catalog
              .filter((p: any) => p.sku !== found.sku)
              .slice(0, 2)
              .map((p: any) => p.sku);
          }
        } else {
          replyText = `I'd love to help you purchase! Which specific product would you like me to add to your shopping cart?`;
        }
      } 
      // Handle product specific queries
      else {
        const found = catalog.find((p: any) => 
          lowerMsg.includes(p.name.toLowerCase().split(' ')[0]) || 
          lowerMsg.includes(p.sku.toLowerCase())
        );

        if (found) {
          suggestedProductsSKUs = catalog
            .filter((p: any) => p.sku !== found.sku)
            .slice(0, 2)
            .map((p: any) => p.sku);

          if (persona?.style === 'bullets') {
            replyText = `Here is the product catalog analysis for the premium ${found.name}:
• **Price**: $${found.price} USD
• **SKU**: ${found.sku}
• **Available Inventory**: ${found.inventory} units in stock
• **Automation Status**: Certified ${found.status}

Would you like me to add this to your active shopping cart?`;
          } else {
            replyText = `Ah, the ${found.name}! That is a remarkable choice. It is currently available in our catalog for $${found.price} with ${found.inventory} units ready for immediate packing and delivery. Standard delivery takes 2-3 business days. Shall I lock this into your cart for you?`;
          }
        } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi ') || lowerMsg.includes('hey') || lowerMsg.includes('kemon')) {
          replyText = `Hello! Welcome to our store. I am ShopMate AI, your dedicated brand ambassador. I speak English, Bangla, and Banglish! How can I elevate your shopping experience today?`;
          suggestedProductsSKUs = catalog.slice(0, 2).map((p: any) => p.sku);
        } else if (lowerMsg.includes('shipping') || lowerMsg.includes('deliver') || lowerMsg.includes('pathao')) {
          replyText = `We provide pristine, high-security packaging and lightning-fast standard shipping (2-3 business days) nationwide. If you order within the hour, your package will be dispatched with top-tier priority!`;
        } else {
          // Generic brand ambassador response
          const first = catalog[0];
          replyText = `I appreciate you reaching out! Regarding your query, I'd highly recommend taking a look at our featured product: ${first?.name || 'Store Item'} available for just $${first?.price || '0.00'}. Would you like me to share more specifications or add it to your order?`;
          if (first) suggestedProductsSKUs = [first.sku];
        }
      }

      return res.json({
        replyText,
        isComplaint,
        cartAction,
        suggestedProductsSKUs
      });
    } catch (err: any) {
      console.error('Server error handling chat:', err);
      res.status(500).json({ error: 'Failed to process conversation: ' + err.message });
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

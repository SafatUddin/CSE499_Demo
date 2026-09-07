import express from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth';
import { requireProfileComplete } from '../profileCompletion';
import { validateProductInput } from '../inputValidation';
import { productImageUpload, saveProductImageFile, deleteProductImageFile } from '../mediaStorage';

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

export function createProductsRouter(): express.Router {
  const router = express.Router();

  // List this merchant's products & catalog source info
  router.get('/api/products', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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
  router.post('/api/products', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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

  router.patch('/api/products/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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
  router.post('/api/products/:id/image', requireAuth, requireProfileComplete, productImageUpload.single('image'), async (req: AuthedRequest, res) => {
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
  router.delete('/api/products/:id/image', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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
  router.delete('/api/products/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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

  return router;
}

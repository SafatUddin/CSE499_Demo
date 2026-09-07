import express from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth';
import { requireProfileComplete } from '../profileCompletion';
import { createOrderForConversation } from '../orderCreation';

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

export function createOrdersRouter(): express.Router {
  const router = express.Router();

  // List this store's orders
  router.get('/api/orders', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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
  router.patch('/api/orders/:id', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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

  router.post('/api/conversations/:id/orders', requireAuth, requireProfileComplete, async (req: AuthedRequest, res) => {
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

  return router;
}

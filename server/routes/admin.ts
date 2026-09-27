import express from 'express';
import { prisma } from '../db';
import { requireAuth, AuthedRequest } from '../auth';

export function createAdminRouter(): express.Router {
  const router = express.Router();

  // Middleware to check if user is admin
  const requireAdmin = (req: AuthedRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.auth?.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  };

  // GET /api/admin/analytics - Get merchant analytics with time filter
  router.get('/api/admin/analytics', requireAuth, requireAdmin, async (req: AuthedRequest, res) => {
    try {
      const { timeFilter } = req.query;
      
      // Calculate date threshold based on filter
      let dateThreshold: Date | null = null;
      const now = new Date();
      
      switch (timeFilter) {
        case '1month':
          dateThreshold = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case '3months':
          dateThreshold = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
          break;
        case '6months':
          dateThreshold = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
          break;
        case 'all':
        default:
          dateThreshold = null;
          break;
      }

      // Admin email to exclude from analytics
      const ADMIN_EMAIL = 'remlin75@gmail.com';

      // Get all merchants with their stores, excluding admin
      const merchants = await prisma.merchant.findMany({
        where: {
          email: { not: ADMIN_EMAIL },
        },
        include: {
          store: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Build analytics for each merchant
      const analytics = await Promise.all(
        merchants.map(async (merchant) => {
          if (!merchant.store) {
            return null;
          }

          const storeId = merchant.store.id;

          // Build where clause for time filtering
          const whereClause: any = { storeId };
          if (dateThreshold) {
            whereClause.createdAt = { gte: dateThreshold };
          }

          // Count total conversations
          const totalConversations = await prisma.conversation.count({
            where: whereClause,
          });

          // Count AI messages (messages with sender = AI)
          const totalAiMessages = await prisma.message.count({
            where: {
              conversation: {
                storeId,
                ...(dateThreshold ? { createdAt: { gte: dateThreshold } } : {}),
              },
              sender: 'AI',
            },
          });

          // Get orders with time filter
          const orders = await prisma.order.findMany({
            where: whereClause,
            select: {
              total: true,
              conversationId: true,
            },
          });

          // Count converted conversations (conversations that have orders)
          const conversationIdsWithOrders = new Set(
            orders.filter((o) => o.conversationId).map((o) => o.conversationId)
          );
          const convertedConversations = conversationIdsWithOrders.size;

          // Calculate total sales
          const totalSales = orders.reduce((sum, order) => sum + Number(order.total), 0);

          return {
            merchantId: merchant.id,
            merchantName: merchant.name,
            merchantEmail: merchant.email,
            totalConversations,
            convertedConversations,
            totalSales,
            totalAiMessages,
            joinedAt: merchant.createdAt.toISOString(),
          };
        })
      );

      // Filter out null entries (merchants without stores)
      const validAnalytics = analytics.filter((a) => a !== null);

      res.json(validAnalytics);
    } catch (err: any) {
      console.error('Admin analytics error:', err);
      res.status(500).json({ error: 'Failed to load analytics' });
    }
  });

  return router;
}

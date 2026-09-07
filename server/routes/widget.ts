import express from 'express';
import type { Response } from 'express';
import { prisma } from '../db';
import { widgetLimiter } from '../rateLimiters';
import { toPublicWidgetConversation } from '../publicViews';
import { generateAndStoreAgentReply, sendOpeningGreetingIfNew } from '../conversationEngine';

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

export function createWidgetRouter(): express.Router {
  const router = express.Router();

  router.options('/api/widget/message', (_req, res) => { applyWidgetCors(res); res.sendStatus(204); });
  router.options('/api/widget/messages', (_req, res) => { applyWidgetCors(res); res.sendStatus(204); });

  router.post('/api/widget/message', widgetLimiter, async (req, res) => {
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

  router.get('/api/widget/messages', widgetLimiter, async (req, res) => {
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

  return router;
}

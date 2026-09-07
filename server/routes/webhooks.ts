import express from 'express';
import { prisma } from '../db';
import type { RequestWithRawBody } from '../types';
import {
  verifyMetaSignature,
  sendMessengerMessage,
  fetchMessengerProfile,
  fetchInstagramProfile,
  replyToFacebookComment,
  sendFacebookPrivateReply,
  replyToInstagramComment,
  sendInstagramPrivateReply,
} from '../meta';
import { isQuestionOrPriceInquiry } from '../agent';
import { resolveConnectedChannelByExternalId } from '../channelSecurity';
import { claimWebhookEvent } from '../webhookIdempotency';
import {
  getPageAccessTokenForStore,
  getInstagramCredentialsForStore,
  generateAndStoreAgentReply,
  sendOpeningGreetingIfNew,
} from '../conversationEngine';

const isProduction = process.env.NODE_ENV === 'production';

export function createWebhooksRouter(): express.Router {
  const router = express.Router();

  // Meta webhook verification handshake (Messenger/Instagram/WhatsApp all use this same shape)
  router.get('/webhooks/meta', (req, res) => {
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
  router.post('/webhooks/meta', async (req: RequestWithRawBody, res) => {
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

  return router;
}

// The AI reply pipeline shared by every channel — Messenger/WhatsApp/Instagram webhooks,
// the website widget, and the merchant's own test-chat sandbox all funnel through
// generateAndStoreAgentReply (and sendOpeningGreetingIfNew for a customer's first message).
// None of it is channel-specific except the final "push it out" branches at the bottom of
// generateAndStoreAgentReply, which simply don't match for channels with no push API (WIDGET).
import { prisma } from './db';
import { decryptSecret } from './crypto';
import { generateAgentReply } from './agent';
import {
  sendMessengerMessage,
  sendMessengerImage,
  sendWhatsAppMessage,
  sendWhatsAppImage,
  sendInstagramMessage,
  sendInstagramImage,
} from './meta';
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
} from './checkoutSecurity';
import { createOrderForConversation } from './orderCreation';

const isProduction = process.env.NODE_ENV === 'production';

// Only the real self-serve OAuth connection's per-store token is used — there is no
// manual/env-var fallback, so a store with no completed Facebook connection simply
// can't send or fetch anything via Messenger.
export async function getPageAccessTokenForStore(storeId: string): Promise<string | null> {
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

export async function getWhatsAppCredentialsForStore(storeId: string): Promise<{ phoneNumberId: string; accessToken: string } | null> {
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

export async function getInstagramCredentialsForStore(storeId: string): Promise<{ igAccountId: string; accessToken: string } | null> {
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

// Below this many products, the full catalog is small enough that filtering it isn't
// worth the risk of ever omitting something relevant — send it as-is.
const CATALOG_LEXICAL_FILTER_THRESHOLD = 15;

const CATALOG_FILTER_STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'do', 'does', 'you', 'have', 'has', 'i', 'want', 'to',
  'buy', 'of', 'for', 'and', 'in', 'on', 'it', 'this', 'that', 'what', 'how', 'much',
  'price', 'can', 'please', 'me', 'my', 'with', 'pcs', 'piece', 'pieces', 'item', 'items',
  'order', 'get', 'like', 'any', 'your', 'there', 'hello', 'hi', 'hey',
]);

function tokenizeForCatalogFilter(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter(
    (w) => w.length > 2 && !CATALOG_FILTER_STOPWORDS.has(w)
  );
}

// Narrows what actually gets listed in the Gemini prompt to the products plausibly
// relevant to the current turn, so a large catalog doesn't inflate every request's
// latency. Pure lexical overlap (no embeddings/vector search needed at this scale —
// worth revisiting as real RAG only once a store's catalog grows much larger than a
// few dozen items). Falls back to the full catalog whenever nothing matches, so the
// model is never worse-informed than before, only faster when it doesn't need to be.
export function selectRelevantCatalog<T extends { name: string; sku: string }>(
  fullCatalog: T[],
  message: string,
  historyTexts: string[],
  pinnedSkus: Set<string>
): T[] {
  if (fullCatalog.length <= CATALOG_LEXICAL_FILTER_THRESHOLD) return fullCatalog;

  const queryTokens = new Set([
    ...tokenizeForCatalogFilter(message),
    ...historyTexts.flatMap(tokenizeForCatalogFilter),
  ]);
  if (queryTokens.size === 0) return fullCatalog;

  const matched = fullCatalog.filter((p) => {
    if (pinnedSkus.has(p.sku)) return true;
    return tokenizeForCatalogFilter(`${p.name} ${p.sku}`).some((t) => queryTokens.has(t));
  });

  return matched.length > 0 ? matched : fullCatalog;
}

// Generates an AI reply for a conversation and either delivers it immediately (Copilot
// on / AI_MANAGED) or stores it as a pending draft awaiting merchant approval (Copilot
// off / manual). Only delivers externally (e.g. Messenger) when actually sent.
export async function generateAndStoreAgentReply(conversation: { id: string; storeId: string; status: string; channelType: string; externalUserId: string | null; isComplaint: boolean }, customerText: string) {
  if (!isProduction) {
    console.log('[AGENT REPLY] generateAndStoreAgentReply — conversationId:', conversation.id, '| storeId:', conversation.storeId);
  }
  const [store, products, recentMessages, currentConversation, conversationOrders] = await Promise.all([
    prisma.store.findUnique({ where: { id: conversation.storeId } }),
    prisma.product.findMany({ where: { storeId: conversation.storeId } }),
    // Only the last 11 are ever used below (10 for history + the just-inserted customer
    // message that gets dropped) — fetching the whole thread wastes DB work on long-running
    // conversations. desc + take, then reversed in JS, to get "last N in chronological order".
    prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, take: 11 }),
    prisma.conversation.findUnique({ where: { id: conversation.id } }),
    prisma.order.findMany({
      where: {
        storeId: conversation.storeId,
        conversationId: conversation.id,
        status: { in: ['PROCESSING', 'ON_THE_WAY'] },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  if (!store || !currentConversation) return;

  const persona = {
    tone: store.tone,
    style: store.style,
    customInstructions: store.customInstructions,
    merchantBusinessInfo: {
      businessPhone: store.businessPhone || undefined,
      website: store.website || undefined,
      streetAddress: store.streetAddress || undefined,
      city: store.city || undefined,
      province: store.province || undefined,
      postalCode: store.postalCode || undefined,
      country: store.country || undefined,
    },
    shareBusinessInfo: store.shareBusinessInfo,
  };
  const catalog = products.map((p) => ({
    name: p.name,
    sku: p.sku,
    price: Number(p.price),
    inventory: p.inventory,
    status: p.status === 'TRAINED' ? 'Trained' : 'Pending',
    imageUrl: p.imageUrl || undefined,
  }));
  // Cap history sent to the model — an unbounded prompt grows with every message in a
  // long-running conversation, which slows down local LLM inference noticeably.
  const history = recentMessages.slice().reverse().slice(0, -1).map((m) => ({ sender: m.sender.toLowerCase(), text: m.text }));

  const existingCart: { sku: string; quantity: number }[] = (currentConversation.cart as any) || [];

  // Decode + validate the prefix-encoded state stored in awaitingQuantityFor.
  // LLM never authoritatively sets business state — invalid encodings are cleared.
  const rawAWQ = currentConversation.awaitingQuantityFor;
  const parsedAWQ = parseAwaitingQuantityFor(rawAWQ);
  const isConfirmState = parsedAWQ.kind === 'confirm';
  const isDetailsState = parsedAWQ.kind === 'details';
  const isCancelPendingState = parsedAWQ.kind === 'cancel_pending';

  let pendingEncodedSku: string | null = null;
  let pendingEncodedQty = 0;
  let pendingCancelOrderId: string | null = null;

  if (parsedAWQ.kind === 'confirm' || parsedAWQ.kind === 'details') {
    const validated = validateSkuAndQuantity(products, parsedAWQ.sku, parsedAWQ.qty);
    if (validated.ok) {
      pendingEncodedSku = validated.sku;
      pendingEncodedQty = validated.qty;
    }
  } else if (parsedAWQ.kind === 'cancel_pending') {
    const owned = conversationOrders.find((o) => o.id === parsedAWQ.orderId);
    if (owned) pendingCancelOrderId = owned.id;
  }

  // Drop corrupt / cross-SKU / over-inventory encodings so they cannot drive checkout.
  const pendingProduct = pendingEncodedSku ? products.find((p) => p.sku === pendingEncodedSku) : null;
  const confirmDetailsValid =
    (isConfirmState || isDetailsState) && !!pendingProduct && pendingEncodedQty > 0;
  const cancelPendingValid = isCancelPendingState && !!pendingCancelOrderId;

  const orderState = {
    // Pass null to the model when in CONFIRM/DETAILS/CANCEL_PENDING so it doesn't think
    // we're still waiting for a plain quantity answer.
    awaitingQuantityFor:
      isConfirmState || isDetailsState || isCancelPendingState
        ? null
        : parsedAWQ.kind === 'ask_qty'
          ? parsedAWQ.sku
          : null,
    orderConfirmationRequested: currentConversation.orderConfirmationRequested,
    hasCartItems: existingCart.length > 0,
    hasAddress: !!currentConversation.detectedAddress,
    cartItems: existingCart.map((item) => ({
      sku: item.sku,
      name: products.find((p) => p.sku === item.sku)?.name || item.sku,
      quantity: item.quantity,
    })),
    pendingItem:
      isConfirmState && confirmDetailsValid && pendingProduct
        ? {
            sku: pendingEncodedSku!,
            name: pendingProduct.name,
            quantity: pendingEncodedQty,
            unitPrice: Number(pendingProduct.price),
            lineTotal: Number(pendingProduct.price) * pendingEncodedQty,
          }
        : undefined,
    awaitingContactDetails: isDetailsState && confirmDetailsValid,
    pendingCancelOrder:
      cancelPendingValid
        ? (() => {
            const o = conversationOrders.find((ord) => ord.id === pendingCancelOrderId)!;
            return {
              id: o.id,
              status: o.status === 'ON_THE_WAY' ? 'On the Way' : 'Processing',
              total: Number(o.total),
            };
          })()
        : null,
    ongoingOrders: conversationOrders.map((o) => ({
      id: o.id,
      items: ((o.items as any[]) || []).map((i) => ({ name: i.name, quantity: i.quantity, price: Number(i.price) })),
      status: o.status === 'ON_THE_WAY' ? 'On the Way' : 'Processing',
      createdAt: o.createdAt.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      total: Number(o.total),
    })),
  };

  const pinnedCatalogSkus = new Set(existingCart.map((c) => c.sku));
  if (pendingEncodedSku) pinnedCatalogSkus.add(pendingEncodedSku);
  const promptCatalog = selectRelevantCatalog(
    catalog,
    customerText,
    history.map((h) => h.text),
    pinnedCatalogSkus
  );

  const result = await generateAgentReply({ message: customerText, history, persona, catalog, promptCatalog, orderState });
  const isAutopilot = conversation.status === 'AI_MANAGED';
  const autoFinalizeEligible = isAutopilot || !!store.autoFinalizeOrdersAlways;
  let orderCreatedThisTurn = false;

  // CART-ADD INTERCEPTION: If the agent returned cartAction='add', redirect through the
  // confirmation-first flow after validating SKU/qty against this store's catalog.
  if (
    result.cartAction?.action === 'add' &&
    result.cartAction.sku &&
    !isConfirmState &&
    !isDetailsState &&
    !isCancelPendingState &&
    !currentConversation.orderConfirmationRequested
  ) {
    const requestedSku = result.cartAction.sku;
    const validated = validateSkuAndQuantity(products, requestedSku, result.cartAction.quantity);
    if (validated.ok) {
      const price = Number(validated.product.price);
      const total = price * validated.qty;
      result.replyText = `You'd like ${validated.qty}x ${validated.product.name} at $${price.toFixed(2)} each — total $${total.toFixed(2)}. Would you like to confirm this order?`;
      result.cartAction = { action: 'none', sku: '', quantity: 0 };
      result.askQuantityForSku = encodeConfirm(validated.sku, validated.qty);
      result.orderConfirmationRequested = false;
      result.orderConfirmed = false;
      result.orderCancelled = false;
    } else {
      // Reject invalid LLM cartAction — never write cross-store or overselling qty.
      const failReason = (validated as { ok: false; reason: 'invalid_sku' | 'invalid_qty' | 'insufficient_inventory' }).reason;
      result.cartAction = { action: 'none', sku: '', quantity: 0 };
      if (failReason === 'insufficient_inventory') {
        const p = products.find((x) => x.sku === requestedSku);
        result.replyText = p
          ? `Sorry, we only have ${p.inventory} unit(s) of ${p.name} available. How many would you like (up to ${Math.min(p.inventory, MAX_CHECKOUT_QUANTITY)})?`
          : `Sorry, that quantity isn't available. Please choose another amount.`;
        if (p && p.inventory > 0) result.askQuantityForSku = p.sku;
      } else if (failReason === 'invalid_qty') {
        result.replyText = `Please choose a quantity between 1 and ${MAX_CHECKOUT_QUANTITY}.`;
      } else {
        result.replyText = `Sorry, I couldn't find that product in our catalog. Which item would you like?`;
        result.askQuantityForSku = '';
      }
    }
  }

  const imageProduct = result.showImageForSku ? products.find((p) => p.sku === result.showImageForSku) : undefined;
  const resolvedImageUrl = imageProduct?.imageUrl || undefined;

  await prisma.message.create({
    data: { conversationId: conversation.id, sender: 'AI', text: result.replyText, imageUrl: resolvedImageUrl, meta: result as any, pending: !isAutopilot },
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
    await prisma.conversation.update({ where: { id: conversation.id }, data: conversationData });
    return;
  }

  let updatedCart = existingCart;

  // SERVER-SIDE CART GUARD: legacy direct-cart-add paths only; CONFIRM/DETAILS write cart server-side.
  const cartAddQty = normalizeCheckoutQuantity(result.cartAction?.quantity);
  const cartAddAllowed =
    result.cartAction?.action === 'add' &&
    !!result.cartAction.sku &&
    cartAddQty !== null &&
    !isConfirmState &&
    !isDetailsState &&
    !isCancelPendingState &&
    (currentConversation.awaitingQuantityFor === result.cartAction.sku ||
      (currentConversation.awaitingQuantityFor === null && !currentConversation.orderConfirmationRequested));

  if (cartAddAllowed) {
    const validated = validateSkuAndQuantity(products, result.cartAction.sku, cartAddQty);
    if (validated.ok) {
      const existingItem = existingCart.find((item) => item.sku === validated.sku);
      updatedCart = existingItem
        ? existingCart.map((item) => (item.sku === validated.sku ? { ...item, quantity: validated.qty } : item))
        : [...existingCart, { sku: validated.sku, quantity: validated.qty }];
      conversationData.cart = updatedCart;
      conversationData.awaitingQuantityFor = null;
    }
  }

  // Never trust raw LLM askQuantityForSku — sanitize to catalog SKU or CONFIRM:SKU:QTY.
  const sanitizedAsk = sanitizeAskQuantityForSku(result.askQuantityForSku, products);
  if (sanitizedAsk) {
    conversationData.awaitingQuantityFor = sanitizedAsk;
  } else if (result.askQuantityForSku) {
    // Invalid LLM encoding — ignore transition.
    conversationData.awaitingQuantityFor = currentConversation.awaitingQuantityFor;
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
  // one in a previous turn or we are in the multi-step checkout state machine.
  const customerConfirmedForReal =
    result.orderConfirmed &&
    (currentConversation.orderConfirmationRequested || (isConfirmState && confirmDetailsValid) || (isDetailsState && confirmDetailsValid));
  if (customerConfirmedForReal) {
    conversationData.orderConfirmed = true;
  }

  // When the customer explicitly cancels a pending checkout confirmation, reset flags.
  const customerCancelledForReal = result.orderCancelled && currentConversation.orderConfirmationRequested;
  if (customerCancelledForReal) {
    conversationData.orderConfirmationRequested = false;
    conversationData.orderConfirmed = false;
  }

  // === H3: Ongoing order cancellation requires explicit confirmation ===
  // Never cancel from a single ambiguous keyword or raw LLM orderCancelled alone.
  if (cancelPendingValid && pendingCancelOrderId) {
    if (isAffirmativeMessage(customerText)) {
      const orderToCancel = conversationOrders.find((o) => o.id === pendingCancelOrderId);
      if (
        orderToCancel &&
        orderToCancel.storeId === conversation.storeId &&
        orderToCancel.conversationId === conversation.id &&
        orderToCancel.status !== 'CANCELLED' &&
        orderToCancel.status !== 'DELIVERED'
      ) {
        try {
          await prisma.$transaction(async (tx) => {
            const items = (orderToCancel.items as any[]) || [];
            for (const item of items) {
              const qty = Math.floor(Number(item.quantity));
              if (item.sku && Number.isFinite(qty) && qty > 0) {
                await tx.product.updateMany({
                  where: { storeId: orderToCancel.storeId, sku: item.sku },
                  data: { inventory: { increment: qty } },
                });
              }
            }
            await tx.order.update({
              where: { id: orderToCancel.id },
              data: { status: 'CANCELLED' },
            });
          });
          conversationData.awaitingQuantityFor = null;
          const cancelOkText = `Your order (#${orderToCancel.id.slice(-8).toUpperCase()}) has been cancelled successfully. Inventory for those items has been restored. Thank you!`;
          await prisma.message.updateMany({
            where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
            data: { text: cancelOkText },
          });
          result.replyText = cancelOkText;
        } catch {
          console.error('[ORDER CANCEL] Failed to cancel confirmed order');
          conversationData.awaitingQuantityFor = encodeCancelPending(pendingCancelOrderId);
        }
      } else {
        conversationData.awaitingQuantityFor = null;
        const cancelFailText = `I couldn't safely cancel that order. Please contact the store for help.`;
        await prisma.message.updateMany({
          where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
          data: { text: cancelFailText },
        });
        result.replyText = cancelFailText;
      }
    } else if (isCancelDeclineMessage(customerText)) {
      conversationData.awaitingQuantityFor = null;
    } else {
      // Stay in pending-cancel until a clear yes/no.
      conversationData.awaitingQuantityFor = encodeCancelPending(pendingCancelOrderId);
    }
  } else if (
    !isConfirmState &&
    !isDetailsState &&
    !currentConversation.orderConfirmationRequested &&
    isOngoingOrderCancelIntent(customerText)
  ) {
    // First-turn cancel intent (server-detected): ask for confirmation; do not cancel yet.
    // Do not trust raw LLM orderCancelled alone.
    const orderToAsk = conversationOrders[0];
    if (orderToAsk && orderToAsk.storeId === conversation.storeId) {
      conversationData.awaitingQuantityFor = encodeCancelPending(orderToAsk.id);
      const items = ((orderToAsk.items as any[]) || []).map((i: any) => `${i.quantity}x ${i.name}`).join(', ');
      const askText = `I found your active order #${orderToAsk.id.slice(-8).toUpperCase()} — ${items || 'items'}, total $${Number(orderToAsk.total).toFixed(2)}. Do you want me to cancel this order? Reply "yes, cancel it" to confirm, or "no" to keep it.`;
      await prisma.message.updateMany({
        where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
        data: { text: askText },
      });
      result.replyText = askText;
      result.orderCancelled = false;
    } else {
      const noneText = `I couldn't find an active order to cancel in this conversation. Please share more details if you still need help.`;
      await prisma.message.updateMany({
        where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
        data: { text: noneText },
      });
      result.replyText = noneText;
      result.orderCancelled = false;
    }
  } else if (isCancelPendingState && !cancelPendingValid) {
    // Spoofed / foreign / unknown CANCEL_PENDING encoding — drop it.
    conversationData.awaitingQuantityFor = null;
  }

  // === CHECKOUT STATE MACHINE (CONFIRM → DETAILS) — server-validated only ===
  if (isConfirmState && confirmDetailsValid) {
    if (result.orderConfirmed && pendingEncodedSku && pendingEncodedQty > 0) {
      // Re-validate inventory at transition time.
      const recheck = validateSkuAndQuantity(products, pendingEncodedSku, pendingEncodedQty);
      if (recheck.ok) {
        conversationData.awaitingQuantityFor = encodeDetails(recheck.sku, recheck.qty);
        conversationData.cart = [{ sku: recheck.sku, quantity: recheck.qty }];
        updatedCart = conversationData.cart;
      } else {
        const failReason = (recheck as { ok: false; reason: 'invalid_sku' | 'invalid_qty' | 'insufficient_inventory' }).reason;
        conversationData.awaitingQuantityFor = null;
        conversationData.cart = [];
        const failText =
          failReason === 'insufficient_inventory'
            ? `Sorry, that quantity is no longer available. Please choose a different quantity.`
            : `Sorry, we couldn't continue checkout for that item. Please try again.`;
        await prisma.message.updateMany({
          where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
          data: { text: failText },
        });
        result.replyText = failText;
      }
    } else if (result.orderCancelled) {
      conversationData.awaitingQuantityFor = null;
      conversationData.cart = [];
    } else {
      conversationData.awaitingQuantityFor = encodeConfirm(pendingEncodedSku!, pendingEncodedQty);
    }
  } else if (isDetailsState && confirmDetailsValid) {
    const detailsContactInfo = result.extractedAddress || currentConversation.detectedAddress || '';
    if (detailsContactInfo && pendingEncodedSku && pendingEncodedQty > 0) {
      conversationData.awaitingQuantityFor = null;
      conversationData.orderConfirmed = true;
      conversationData.cart = [{ sku: pendingEncodedSku, quantity: pendingEncodedQty }];
      updatedCart = conversationData.cart;
      if (result.extractedAddress) {
        conversationData.detectedAddress = result.extractedAddress;
      }
    } else {
      conversationData.awaitingQuantityFor = encodeDetails(pendingEncodedSku!, pendingEncodedQty);
    }
  } else if ((isConfirmState || isDetailsState) && !confirmDetailsValid) {
    // Corrupt encoded state — clear rather than acting on it.
    conversationData.awaitingQuantityFor = null;
  }

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: conversationData,
  });

  // Auto-finalize (H1): DETAILS / confirmation paths create a real Order only when the
  // merchant is eligible (AI Managed, or autoFinalizeOrdersAlways). Otherwise preserve
  // cart + address for the merchant "Generate Order" workflow and correct the customer reply.
  const detailsContactInfo =
    (isDetailsState && confirmDetailsValid
      ? result.extractedAddress || currentConversation.detectedAddress || ''
      : '') || '';
  const shouldAttemptFinalize =
    !orderCreatedThisTurn &&
    ((isDetailsState && confirmDetailsValid && !!detailsContactInfo) ||
      (customerConfirmedForReal && !!updatedAddress));

  if (shouldAttemptFinalize) {
    const finalizeAddress = (detailsContactInfo || updatedAddress || '').trim();
    const finalizeCart: { sku: string; quantity: number }[] =
      updatedCart.length > 0
        ? updatedCart
        : pendingEncodedSku && pendingEncodedQty > 0
          ? [{ sku: pendingEncodedSku, quantity: pendingEncodedQty }]
          : [];

    // Validate every cart line against this store before ordering.
    const cartValid =
      finalizeCart.length > 0 &&
      finalizeCart.every((line) => validateSkuAndQuantity(products, line.sku, line.quantity).ok);

    if (!finalizeAddress || !cartValid) {
      if (isDetailsState && detailsContactInfo && !cartValid) {
        const errText = `Sorry, we couldn't place that order with the requested items/quantity. Please adjust and try again.`;
        await prisma.message.updateMany({
          where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
          data: { text: errText },
        });
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { awaitingQuantityFor: null },
        });
      }
    } else if (!autoFinalizeEligible) {
      // H1: not eligible — keep cart/address for merchant review; do not create Order / decrement stock.
      const pendingText = `Thank you! I've saved your order details and notified the store. A team member will finalize your order shortly. Delivery info on file: ${finalizeAddress}`;
      await prisma.message.updateMany({
        where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
        data: { text: pendingText },
      });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          cart: finalizeCart,
          detectedAddress: finalizeAddress,
          awaitingQuantityFor: null,
          orderConfirmed: true,
          orderConfirmationRequested: false,
        },
      });
    } else {
      try {
        await createOrderForConversation(
          { id: conversation.id, storeId: conversation.storeId, customerName: currentConversation.customerName },
          finalizeCart,
          finalizeAddress,
        );
        orderCreatedThisTurn = true;
        const placedText = `Thank you! Your order has been placed. We'll deliver to: ${finalizeAddress}. Thank you for shopping with us!`;
        await prisma.message.updateMany({
          where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
          data: { text: placedText },
        });
      } catch (err: any) {
        console.error('Auto-finalize order failed for conversation:', conversation.id);
        if (err?.code === 'INSUFFICIENT_STOCK') {
          const errText = `Sorry, we don't have enough stock to complete that order right now. Please adjust your quantity and try again.`;
          await prisma.message.updateMany({
            where: { conversationId: conversation.id, sender: 'AI', text: result.replyText },
            data: { text: errText },
          });
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { awaitingQuantityFor: null },
          });
        }
      }
    }
  }

  if (isAutopilot && conversation.channelType === 'FACEBOOK' && conversation.externalUserId) {
    const pageAccessToken = await getPageAccessTokenForStore(conversation.storeId);
    if (pageAccessToken) {
      try {
        await sendMessengerMessage(pageAccessToken, conversation.externalUserId, result.replyText);
        if (resolvedImageUrl) await sendMessengerImage(pageAccessToken, conversation.externalUserId, resolvedImageUrl);
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
        if (resolvedImageUrl) await sendWhatsAppImage(waCreds.phoneNumberId, waCreds.accessToken, conversation.externalUserId, resolvedImageUrl);
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
        if (resolvedImageUrl) await sendInstagramImage(igCreds.igAccountId, igCreds.accessToken, conversation.externalUserId, resolvedImageUrl);
      } catch (err) {
        console.error('Failed to deliver AI reply to Instagram:', err);
      }
    }
  }
}

// Sends the merchant's configured opening greeting (text + optional image) the very
// first time a customer messages the business on a real channel — fires once per brand
// new Conversation, and stands in for the AI's reply on that first message (the caller
// skips generateAndStoreAgentReply when this returns true) so the customer doesn't get
// two back-to-back greeting-shaped messages on their very first "hello."
export async function sendOpeningGreetingIfNew(
  isNewConversation: boolean,
  conversation: { id: string; storeId: string; status: string; channelType: string; externalUserId: string | null }
): Promise<boolean> {
  if (!isNewConversation) return false;
  const store = await prisma.store.findUnique({ where: { id: conversation.storeId } });
  if (!store || !store.openingText) return false;

  const isAutopilot = conversation.status === 'AI_MANAGED';
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      sender: 'AI',
      text: store.openingText,
      imageUrl: store.openingImageUrl || undefined,
      pending: !isAutopilot,
    },
  });
  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });

  if (!isAutopilot || !conversation.externalUserId) return true;
  try {
    if (conversation.channelType === 'FACEBOOK') {
      const pageAccessToken = await getPageAccessTokenForStore(conversation.storeId);
      if (pageAccessToken) {
        await sendMessengerMessage(pageAccessToken, conversation.externalUserId, store.openingText);
        if (store.openingImageUrl) await sendMessengerImage(pageAccessToken, conversation.externalUserId, store.openingImageUrl);
      }
    } else if (conversation.channelType === 'WHATSAPP') {
      const waCreds = await getWhatsAppCredentialsForStore(conversation.storeId);
      if (waCreds) {
        await sendWhatsAppMessage(waCreds.phoneNumberId, waCreds.accessToken, conversation.externalUserId, store.openingText);
        if (store.openingImageUrl) await sendWhatsAppImage(waCreds.phoneNumberId, waCreds.accessToken, conversation.externalUserId, store.openingImageUrl);
      }
    } else if (conversation.channelType === 'INSTAGRAM') {
      const igCreds = await getInstagramCredentialsForStore(conversation.storeId);
      if (igCreds) {
        await sendInstagramMessage(igCreds.igAccountId, igCreds.accessToken, conversation.externalUserId, store.openingText);
        if (store.openingImageUrl) await sendInstagramImage(igCreds.igAccountId, igCreds.accessToken, conversation.externalUserId, store.openingImageUrl);
      }
    }
  } catch (err) {
    console.error(`Failed to deliver opening greeting to ${conversation.channelType}:`, err);
  }
  return true;
}

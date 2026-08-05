import { ollamaChatJSON, ollamaEnabled } from './ollama';

export interface AgentPersona {
  tone?: string;
  style?: string;
  customInstructions?: string;
}

export interface AgentCatalogItem {
  name: string;
  sku: string;
  price: number;
  inventory: number;
  status: string;
}

export interface AgentHistoryItem {
  sender: string;
  text: string;
}

export interface AgentReply {
  replyText: string;
  isComplaint: boolean;
  cartAction: { action: string; sku: string; quantity: number };
  suggestedProductsSKUs: string[];
  extractedAddress: string;
  askQuantityForSku: string;
  orderConfirmationRequested: boolean;
  orderConfirmed: boolean;
  orderCancelled: boolean;
}

// Current order-flow state for this conversation, so the model knows whether it's mid
// quantity-clarification or waiting on a yes/no to a confirmation it already asked for.
export interface AgentOrderState {
  awaitingQuantityFor?: string | null;
  orderConfirmationRequested?: boolean;
  hasCartItems?: boolean;
  hasAddress?: boolean;
  cartItems?: { sku: string; name: string; quantity: number }[];
  // Set when the customer gave a quantity and the AI asked them to confirm the order.
  // The server decodes "CONFIRM:SKU:QTY" from awaitingQuantityFor and passes this.
  pendingItem?: { sku: string; name: string; quantity: number; unitPrice: number; lineTotal: number };
  // True after the customer confirmed the pending item; the AI must now collect phone+address.
  awaitingContactDetails?: boolean;
}

export async function generateAgentReply({
  message,
  history = [],
  persona,
  catalog = [],
  orderState = {},
}: {
  message: string;
  history?: AgentHistoryItem[];
  persona?: AgentPersona;
  catalog?: AgentCatalogItem[];
  orderState?: AgentOrderState;
}): Promise<AgentReply> {
  // Format catalog description for the model context
  const catalogText = catalog
    .map(
      (p) =>
        `- Name: ${p.name}, SKU: ${p.sku}, Price: $${p.price}, Inventory: ${p.inventory} units, Status: ${p.status}`
    )
    .join('\n');

  const toneText = persona?.tone || 'Direct, helpful, and highly sophisticated.';
  const styleText =
    persona?.style === 'bullets'
      ? 'Use bullet points for lists, specifications, or pricing whenever possible.'
      : 'Use a fluid, warm, conversational narrative style. Do not use bullets.';
  const customInst = persona?.customInstructions || '';

  const cartText = orderState.cartItems && orderState.cartItems.length > 0
    ? orderState.cartItems.map((item) => `${item.quantity}x ${item.name} (SKU: ${item.sku})`).join(', ')
    : 'empty';

  const orderStateText = [
    `The customer's cart currently contains: ${cartText}. This already reflects everything added so far — do NOT set cartAction to 'add' again for an item already in this list unless the customer is explicitly asking for additional/more units beyond what's shown. Simply discussing, confirming, or asking about an item already in the cart is NOT a reason to add it again.`,
    orderState.awaitingQuantityFor
      ? `You just asked the customer how many units of SKU "${orderState.awaitingQuantityFor}" they want. If their message answers that (a number, or a spelled-out quantity like "two"), treat it as the quantity for that SKU rather than a new unrelated request.`
      : '',
    // CONFIRM state: quantity was given, we need a yes/no before adding to cart
    orderState.pendingItem
      ? `The customer wants to buy ${orderState.pendingItem.quantity}x "${orderState.pendingItem.name}" at $${orderState.pendingItem.unitPrice.toFixed(2)} each (total $${orderState.pendingItem.lineTotal.toFixed(2)}). You just showed this and asked them to confirm. If their reply is affirmative (yes/confirm/ok/sure/proceed/go ahead), set orderConfirmed=true and cartAction=none. If they decline (no/cancel/never mind), set orderCancelled=true and cartAction=none.`
      : '',
    // DETAILS state: customer confirmed, now collect phone+address
    orderState.awaitingContactDetails
      ? `The customer confirmed their order. You must now ask for (or extract from this message) their phone number and delivery address together. Combine them as "Phone: <number> | Address: <full address>" and set that as extractedAddress. Set orderConfirmed=true once you have both. cartAction must be none.`
      : '',
    orderState.orderConfirmationRequested
      ? `You already showed the customer an order summary and asked them to confirm or cancel it. If their message is affirmative ("yes", "confirm", "go ahead", "place it", etc.), set orderConfirmed to true and cartAction to 'none' — do not re-add items on a confirmation turn. If their message is a cancellation ("cancel", "never mind", "stop", "don't order", etc.), set orderCancelled to true and cartAction to 'none'. If they're asking to change something, set neither.`
      : orderState.hasCartItems && orderState.hasAddress
      ? `The customer has items in their cart and a shipping address on file. If the conversation naturally reaches a checkout moment, show a clean order summary (product name, quantity, price per unit, line total, subtotal, shipping address) and ask "Would you like to confirm or cancel this order?" — set orderConfirmationRequested to true when you do this, and set cartAction to 'none' on that turn.`
      : '',
  ].filter(Boolean).join(' ');

  const systemInstruction = `You are ShopMate AI, an elite autonomous sales agent representing the merchant's store.
Your goal is to answer customer questions with precision, guide customers through their purchase, and strictly adhere to the following mandatory interaction rules:

CRITICAL CART RULE — READ THIS FIRST:
cartAction.action MUST always be 'none'. NEVER set cartAction='add'. The server manages cart writes based on the new checkout flow. Your job is to guide the customer through: quantity → confirm → phone+address.

Mandatory Interaction Rules:
1. PRICE INQUIRY → ASK TO BUY: If customer asks price (e.g. "price of X?", "how much?"), reply with the price and ask "Would you like to buy this product?". cartAction = none.
2. BUY INTENT WITHOUT QUANTITY → ASK HOW MANY: If customer says they want to buy something but does NOT give a number, reply with the price and ask "How many would you like to buy?". Set askQuantityForSku to that product's SKU. cartAction = none. DO NOT add to cart.
3. QUANTITY GIVEN → ASK TO CONFIRM (do NOT add to cart): When customer gives an explicit quantity for a product, show the price breakdown and ask "Would you like to confirm this order?". Set askQuantityForSku = "CONFIRM:<SKU>:<quantity>" (e.g. "CONFIRM:NX-402-B:2"). cartAction = none. Examples: "I want 2 Coca Cola", "ami 2ta nebo", "Yes 1 meter", "5 bottles please". A plain "yes" without a number is NOT a quantity — use Rule 4 instead.
4. PRE-ORDER CONFIRMED (pendingItem is in orderState) → ASK FOR CONTACT: When the customer says yes/confirm to the "Would you like to confirm?" question, reply "Please provide your phone number and delivery address to complete your order." Set orderConfirmed=true. cartAction = none. askQuantityForSku = "".
5. CONTACT DETAILS RECEIVED (awaitingContactDetails is true in orderState) → ORDER PLACED: Extract the customer's phone number and delivery address from their message. Combine as "Phone: <number> | Address: <full address>" and set that as extractedAddress. Reply confirming the order. Set orderConfirmed=true. cartAction = none.
6. ORDER CANCELLED: When pendingItem is set in orderState (or orderConfirmationRequested is true) and the customer cancels ("cancel", "never mind", "stop", "no", etc.), reply "No problem! Your order has been cancelled. Let me know if you'd like to order something else." Set orderCancelled=true.

FORBIDDEN:
- NEVER set cartAction='add' under any circumstances.
- Never set orderCancelled=true unless pendingItem is in orderState or orderConfirmationRequested is already true.
- Never ask for confirmation if the customer has not yet given a quantity.
- Never ask for phone+address before the customer has confirmed (said yes to Rule 3).

Core Directives:
1. Use the provided Product Catalog below to reference accurate prices, names, and stock levels. Never invent products or hallucinate details.
2. Keep your answers concise, engaging, and professional.
3. Under no circumstances mention that you are a language model or AI assistant, or name any underlying model/vendor. You are ShopMate AI, built natively for this merchant.
4. If a product is out of stock (inventory is 0), do not add it to the cart; instead, politely inform the customer and suggest an alternative product that is in stock.
5. Support multilingual queries naturally (Bangla, English, and "Banglish" - romanized/code-mixed Bangla). Respond in the same language register the customer used.

Tone of Voice:
${toneText}

Response Style:
${styleText}

Additional Store Instructions:
${customInst}

Current Order State:
${orderStateText || 'No cart/address/confirmation in progress yet.'}

Available Product Catalog:
${catalogText || 'No products registered in catalog.'}`;

  // Assemble chat message history for Ollama's /api/chat
  const chatMessages = [
    { role: 'system' as const, content: systemInstruction },
    ...history.map((h) => ({
      role: (h.sender === 'customer' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: h.text,
    })),
    { role: 'user' as const, content: message },
  ];

  // If the local Ollama model is reachable, run it
  if (ollamaEnabled) {
    try {
      const content = await ollamaChatJSON(chatMessages, {
        type: 'object',
        properties: {
          replyText: {
            type: 'string',
            description: 'The conversational response to the customer.'
          },
          isComplaint: {
            type: 'boolean',
            description: 'Whether the user is complaining or dissatisfied.'
          },
          cartAction: {
            type: 'object',
            description: 'Action to build customer cart. Use action="none" unless customer explicitly specified a quantity to buy in this turn.',
            properties: {
              action: {
                type: 'string',
                description: "Can be 'add' or 'none'. Set to 'add' ONLY when customer explicitly specifies a quantity of a product to buy."
              },
              sku: {
                type: 'string',
                description: 'The exact SKU of the product to add to cart, e.g., NX-402-B.'
              },
              quantity: {
                type: 'integer',
                description: 'How many units to add based on customer request.'
              }
            },
            required: ['action', 'sku', 'quantity']
          },
          suggestedProductsSKUs: {
            type: 'array',
            items: { type: 'string' },
            description: 'SKUs of relevant products to suggest for cross-sell.'
          },
          extractedAddress: {
            type: 'string',
            description: 'A shipping/delivery address the customer has stated in the conversation, verbatim. Empty string if none was given.'
          },
          askQuantityForSku: {
            type: 'string',
            description: 'SKU to ask the customer for a quantity clarification on. Empty string otherwise.'
          },
          orderConfirmationRequested: {
            type: 'boolean',
            description: 'True only on the turn where replyText presents an order summary and asks "Would you like to confirm or cancel this order?".'
          },
          orderConfirmed: {
            type: 'boolean',
            description: 'True only when the customer explicitly confirms an order summary that was already presented in a previous turn.'
          },
          orderCancelled: {
            type: 'boolean',
            description: 'True only when orderConfirmationRequested is already true and the customer explicitly cancels ("cancel", "never mind", "stop", "don\'t order", etc.). Never set this to true on any other turn.'
          }
        },
        required: ['replyText', 'isComplaint', 'cartAction', 'suggestedProductsSKUs', 'extractedAddress', 'askQuantityForSku', 'orderConfirmationRequested', 'orderConfirmed', 'orderCancelled']
      });

      if (content) {
        const parsed = JSON.parse(content.trim()) as AgentReply;

        // Some quantized models (e.g. qwen2.5:3b) bleed their training-time XML tool-call
        // format into the replyText string even when a JSON schema is enforced. When that
        // happens the outer JSON is valid so no exception is thrown, but replyText contains
        // raw markup visible to the customer and cartAction is left as action='none'.
        // The two steps below detect and repair both problems before returning.

        // Step 1: Recover cartAction from embedded <CartData><Item .../></CartData> when
        // the model forgot to populate the structured cartAction field.
        if (
          parsed.cartAction?.action !== 'add' &&
          /<(?:CartData|[Ii]tem)\b/i.test(parsed.replyText)
        ) {
          const skuMatch = parsed.replyText.match(/<[Ii]tem[^>]+sku=["']([^"']+)["']/);
          const qtyMatch = parsed.replyText.match(/<[Ii]tem[^>]+quantity=["'](\d+)["']/);
          if (skuMatch && qtyMatch) {
            parsed.cartAction = {
              action: 'add',
              sku: skuMatch[1],
              quantity: parseInt(qtyMatch[1], 10),
            };
          }
        }

        // Step 2: Strip all XML tags from replyText so customers never see raw markup.
        // First unwrap <Response>...</Response> to preserve the human-readable text inside
        // it, then remove any remaining tags (<CartData>, <Item>, stray closes, etc.).
        parsed.replyText = parsed.replyText
          .replace(/<Response>([\s\S]*?)<\/Response>/gi, '$1')
          .replace(/<[^>]+>/g, '')
          .trim();

        return parsed;
      }
    } catch (ollamaError: any) {
      console.error('Ollama call failed, falling back to simulated logic:', ollamaError.message);
      // Fall through to fallback simulator
    }
  }

  // High-fidelity local fallback simulation implementing all 6 agent rules
  const lowerMsg = message.toLowerCase().trim();
  let replyText = '';
  let isComplaint = false;
  let cartAction = { action: 'none', sku: '', quantity: 0 };
  let suggestedProductsSKUs: string[] = [];

  // Extract address if customer provided one in message
  let extractedAddress = '';
  const addressMatch = message.match(/(?:address\s*(?:is|:)?\s*|deliver\s*to\s*|ship\s*to\s*)([^\n,\.]{4,}(?:[,\n][^\n,\.]{2,})*)/i)
    || message.match(/(?:house|road|block|street|sector|avenue|dhaka|chittagong|sylhet|rajshahi|khulna|barisal|chattogram)[^\n,\.]{0,60}/i);
  if (addressMatch) {
    extractedAddress = addressMatch[0].trim();
  }

  // Cancellation must be checked before the complaint handler because 'cancel' appears in
  // both lists. When a confirmation is in progress, "cancel" is a checkout action, not a
  // complaint — the complaint handler must not intercept it.
  const isOrderCancellation = orderState.orderConfirmationRequested && (
    lowerMsg.includes('cancel') ||
    lowerMsg.includes('never mind') ||
    lowerMsg.includes('nevermind') ||
    lowerMsg.includes("don't order") ||
    lowerMsg.includes('dont order') ||
    lowerMsg.includes('stop order') ||
    lowerMsg.includes('na thak') ||
    lowerMsg.includes('dorkaar nai')
  );

  if (isOrderCancellation) {
    return {
      replyText: `No problem! Your order has been cancelled. Your cart is still saved — feel free to keep shopping or start a new order.`,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress,
      askQuantityForSku: '',
      orderConfirmationRequested: false,
      orderConfirmed: false,
      orderCancelled: true,
    };
  }

  // CONFIRM state: customer is responding to "Would you like to confirm this order?"
  // The server set pendingItem when awaitingQuantityFor starts with "CONFIRM:SKU:QTY".
  if (orderState.pendingItem) {
    const isPreConfirm =
      lowerMsg === 'yes' || lowerMsg === 'ha' || lowerMsg === 'haa' || lowerMsg === 'ok' ||
      lowerMsg.includes('confirm') || lowerMsg.includes('sure') || lowerMsg.includes('proceed') ||
      lowerMsg.includes('go ahead') || lowerMsg.includes('place') || lowerMsg.includes('haan') ||
      lowerMsg.includes('korbo') || lowerMsg.includes('dao') || lowerMsg.includes('nao');
    const isPreCancel =
      lowerMsg.includes('cancel') || lowerMsg.includes('never mind') ||
      lowerMsg.includes('nevermind') || lowerMsg.includes("don't") ||
      lowerMsg.includes('dont') || lowerMsg.includes('na thak') ||
      lowerMsg === 'no' || lowerMsg === 'na';

    if (isPreConfirm) {
      return {
        replyText: `Great! Please provide your phone number and delivery address to complete your order.`,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress: '',
        askQuantityForSku: '',
        orderConfirmationRequested: false,
        orderConfirmed: true,
        orderCancelled: false,
      };
    }
    if (isPreCancel) {
      return {
        replyText: `No problem! I've cancelled that. Let me know if you'd like to order something else.`,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress: '',
        askQuantityForSku: '',
        orderConfirmationRequested: false,
        orderConfirmed: false,
        orderCancelled: true,
      };
    }
    // Unclear response — re-ask the confirmation
    return {
      replyText: `You'd like ${orderState.pendingItem.quantity}x ${orderState.pendingItem.name} at $${orderState.pendingItem.unitPrice.toFixed(2)} each (total $${orderState.pendingItem.lineTotal.toFixed(2)}). Would you like to confirm this order?`,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress: '',
      askQuantityForSku: '',
      orderConfirmationRequested: false,
      orderConfirmed: false,
      orderCancelled: false,
    };
  }

  // DETAILS state: customer confirmed and is now providing phone + address.
  // The server set awaitingContactDetails=true when awaitingQuantityFor starts with "DETAILS:".
  if (orderState.awaitingContactDetails) {
    const phoneMatch = message.match(/(?:\+?880|01)[0-9\s\-]{7,12}/);
    const phone = phoneMatch ? phoneMatch[0].replace(/[\s\-]/g, '') : '';

    const addrFromKeyword =
      message.match(/(?:address\s*(?:is|:)?\s*|deliver\s*to\s*|ship\s*to\s*)([^\n]{4,})/i) ||
      message.match(/(?:house|road|block|street|sector|avenue|dhaka|chittagong|sylhet|rajshahi|khulna|barisal|chattogram)[^\n,\.]{0,80}/i);
    const addr = addrFromKeyword ? addrFromKeyword[0].trim() : (phone ? '' : message.trim());

    const hasSomething = phone || addr;
    if (hasSomething) {
      const combined = [
        phone ? `Phone: ${phone}` : '',
        addr ? `Address: ${addr}` : '',
      ].filter(Boolean).join(' | ');

      return {
        replyText: `Thank you! Your order is being confirmed. We'll deliver to: ${combined}. Thank you for shopping with us!`,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress: combined,
        askQuantityForSku: '',
        orderConfirmationRequested: false,
        orderConfirmed: true,
        orderCancelled: false,
      };
    }
    // No phone or address found — re-ask
    return {
      replyText: `Could you please provide your phone number and delivery address so we can complete your order?`,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress: '',
      askQuantityForSku: '',
      orderConfirmationRequested: false,
      orderConfirmed: false,
      orderCancelled: false,
    };
  }

  // Check if customer is complaining
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
    return {
      replyText,
      isComplaint,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress,
      askQuantityForSku: '',
      orderConfirmationRequested: false,
      orderConfirmed: false,
      orderCancelled: false,
    };
  }

  // "What's in my cart?" — show current cart contents
  const isCartViewIntent =
    lowerMsg.includes('my cart') ||
    lowerMsg.includes('cart e ki') ||
    lowerMsg.includes('cart এ কি') ||
    lowerMsg.includes('cart dekha') ||
    lowerMsg.includes('whats in') ||
    lowerMsg.includes("what's in") ||
    lowerMsg.includes('show cart') ||
    lowerMsg.includes('see my cart') ||
    lowerMsg.includes('cart show');

  if (isCartViewIntent && !lowerMsg.includes('remove') && !lowerMsg.includes('clear') && !lowerMsg.includes('delete')) {
    if (orderState.cartItems && orderState.cartItems.length > 0) {
      const cartList = orderState.cartItems
        .map((i) => {
          const p = catalog.find((prod) => prod.sku === i.sku);
          const pr = p ? p.price : 0;
          return `• ${i.quantity}x ${i.name} — $${(pr * i.quantity).toFixed(2)}`;
        })
        .join('\n');
      const total = orderState.cartItems.reduce((sum, i) => {
        const p = catalog.find((prod) => prod.sku === i.sku);
        return sum + (p ? p.price * i.quantity : 0);
      }, 0);
      replyText = `Here's what's in your cart:\n${cartList}\n\nTotal: $${total.toFixed(2)}\n\nWould you like to proceed to checkout?`;
    } else {
      replyText = `Your cart is currently empty. Would you like to browse our products?`;
    }
    return {
      replyText,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress,
      askQuantityForSku: '',
      orderConfirmationRequested: false,
      orderConfirmed: false,
      orderCancelled: false,
    };
  }

  // "Remove everything / clear my cart" — acknowledge the reset (server.ts handles the actual clearing)
  const isClearCartIntent =
    (lowerMsg.includes('remove') || lowerMsg.includes('clear') || lowerMsg.includes('delete') || lowerMsg.includes('empty')) &&
    (lowerMsg.includes('cart') || lowerMsg.includes('everything') || lowerMsg.includes('all') || lowerMsg.includes('shob'));

  if (isClearCartIntent) {
    replyText = `Done! I've cleared your cart. Would you like to start fresh and add new items?`;
    return {
      replyText,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: catalog.slice(0, 2).map((p) => p.sku),
      extractedAddress,
      askQuantityForSku: '',
      orderConfirmationRequested: false,
      orderConfirmed: false,
      orderCancelled: false,
    };
  }

  // Rule 6: After the order is confirmed paste the order info and then tell them thank you for shopping with us
  const isConfirmationResponse = orderState.orderConfirmationRequested && (
    lowerMsg === 'yes' || lowerMsg === 'ha' || lowerMsg === 'haa' ||
    lowerMsg.includes('confirm') || lowerMsg.includes('place order') ||
    lowerMsg.includes('proceed') || lowerMsg.includes('do it') || lowerMsg.includes('sure') ||
    lowerMsg.includes('korun') || lowerMsg.includes('korbo') || lowerMsg.includes('confirm koro') ||
    lowerMsg.includes('haan') || lowerMsg.includes('joldi') || lowerMsg.includes('ok')
  );

  if (isConfirmationResponse) {
    const itemsText = (orderState.cartItems || [])
      .map((item) => {
        const p = catalog.find((prod) => prod.sku === item.sku);
        const price = p ? p.price : 0;
        return `• ${item.quantity}x ${item.name} ($${price.toFixed(2)} each)`;
      })
      .join('\n');
    const totalPrice = (orderState.cartItems || []).reduce((sum, item) => {
      const p = catalog.find((prod) => prod.sku === item.sku);
      return sum + (p ? p.price * item.quantity : 0);
    }, 0);
    const finalAddress = extractedAddress || (orderState.hasAddress ? 'Address on file' : 'Standard Shipping Address');

    replyText = `Your order has been confirmed!\n\nOrder Info:\n${itemsText || 'Cart Items'}\nShipping Address: ${finalAddress}\nTotal Price: $${totalPrice.toFixed(2)}\n\nThank you for shopping with us!`;
    return {
      replyText,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress,
      askQuantityForSku: '',
      orderConfirmationRequested: false,
      orderConfirmed: true,
      orderCancelled: false,
    };
  }

  // Check if quantity is stated in customer message (e.g. "2", "3 units", "5 pcs", "3ta", "2ti", "ami 3ta nibo")
  const qtyMatch =
    message.match(/\b(\d+)\s*(?:ta|ti|te|টা|টি)?\s*(?:units?|pcs?|pieces?|items?|nibo|nebo|kinbo|debo|lagbe)?\b/i) ||
    message.match(/\b(\d+)\b/);
  const statedQuantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  // Two-step flow: customer previously asked about a product, AI asked "how many?",
  // now customer is providing the quantity. Ask them to confirm BEFORE adding to cart.
  if (orderState.awaitingQuantityFor && statedQuantity && statedQuantity > 0) {
    const targetSku = orderState.awaitingQuantityFor;
    const product = catalog.find((p) => p.sku === targetSku);
    const productName = product ? product.name : targetSku;
    const pricePer = product ? product.price : 0;
    const lineTotal = pricePer * statedQuantity;

    return {
      replyText: `You'd like ${statedQuantity}x ${productName} at $${pricePer.toFixed(2)} each — total $${lineTotal.toFixed(2)}. Would you like to confirm this order?`,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress,
      askQuantityForSku: `CONFIRM:${targetSku}:${statedQuantity}`,
      orderConfirmationRequested: false,
      orderConfirmed: false,
      orderCancelled: false,
    };
  }

  // Rule 3: When user asks to buy any product, say the price and ask how many they want to buy (DO NOT ADD TO CART UNTIL QUANTITY IS GIVEN)
  // Includes Banglish: kinbo=will buy, nibo=will take, lagbe=need, nite chai=want to take, kinte chai=want to buy
  const isBuyIntent =
    lowerMsg.includes('buy') ||
    lowerMsg.includes('purchase') ||
    lowerMsg.includes('want to buy') ||
    lowerMsg.includes('add to cart') ||
    lowerMsg.includes('kinbo') ||
    lowerMsg.includes('nibo') ||
    lowerMsg.includes('nebo') ||
    lowerMsg.includes('lagbe') ||
    lowerMsg.includes('nite chai') ||
    lowerMsg.includes('kinte chai') ||
    lowerMsg.includes('kibo');

  if (isBuyIntent) {
    const found =
      catalog.find((p) => lowerMsg.includes(p.name.toLowerCase().split(' ')[0]) || lowerMsg.includes(p.sku.toLowerCase())) ||
      (orderState.awaitingQuantityFor ? catalog.find((p) => p.sku === orderState.awaitingQuantityFor) : catalog[0]);

    if (found) {
      if (statedQuantity && statedQuantity > 0) {
        // One-step: customer gave product + quantity together (e.g. "I want 2 Coca Cola").
        // Ask to confirm BEFORE adding to cart.
        const pricePer = found.price;
        const lineTotal = pricePer * statedQuantity;

        return {
          replyText: `You'd like ${statedQuantity}x ${found.name} at $${pricePer.toFixed(2)} each — total $${lineTotal.toFixed(2)}. Would you like to confirm this order?`,
          isComplaint: false,
          cartAction: { action: 'none', sku: '', quantity: 0 },
          suggestedProductsSKUs: [],
          extractedAddress,
          askQuantityForSku: `CONFIRM:${found.sku}:${statedQuantity}`,
          orderConfirmationRequested: false,
          orderConfirmed: false,
          orderCancelled: false,
        };
      } else {
        // Customer said they want to buy, BUT HAS NOT SPECIFIED QUANTITY YET.
        // DO NOT add to cart! Set action='none' and ask how many they want to buy.
        replyText = `The price of ${found.name} is $${found.price.toFixed(2)}. How many would you like to buy?`;
        return {
          replyText,
          isComplaint: false,
          cartAction: { action: 'none', sku: '', quantity: 0 },
          suggestedProductsSKUs: [],
          extractedAddress,
          askQuantityForSku: found.sku,
          orderConfirmationRequested: false,
          orderConfirmed: false,
          orderCancelled: false,
        };
      }
    }
  }

  // Rule 1: Ask customer if they want to buy the product after they ask the price
  // Includes Banglish: dam koto=how much (price), koto taka=how much money, er price=its price, daam=price
  const isPriceInquiry =
    lowerMsg.includes('price') || lowerMsg.includes('how much') || lowerMsg.includes('cost') ||
    lowerMsg.includes('rate') || lowerMsg.includes('dam') || lowerMsg.includes('daam') ||
    lowerMsg.includes('koto taka') || lowerMsg.includes('taka koto') || lowerMsg.includes('er price') ||
    lowerMsg.includes('price koto') || lowerMsg.includes('koto diye');

  if (isPriceInquiry) {
    const found =
      catalog.find((p) => lowerMsg.includes(p.name.toLowerCase().split(' ')[0]) || lowerMsg.includes(p.sku.toLowerCase())) || catalog[0];

    if (found) {
      replyText = `The price of ${found.name} (SKU: ${found.sku}) is $${found.price.toFixed(2)}. Would you like to buy this product?`;
      return {
        replyText,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: catalog.filter((p) => p.sku !== found.sku).slice(0, 2).map((p) => p.sku),
        extractedAddress,
        askQuantityForSku: '',
        orderConfirmationRequested: false,
        orderConfirmed: false,
        orderCancelled: false,
      };
    }
  }

  // Rule 4 & Rule 2: Address provided or confirmation requested
  if (extractedAddress || lowerMsg.includes('confirm') || lowerMsg.includes('checkout')) {
    const addressToUse = extractedAddress || (orderState.hasAddress ? 'Address on file' : '');
    if (!addressToUse) {
      // Rule 2: Ask address before confirming order
      replyText = `Could you please provide your shipping address before we confirm your order?`;
      return {
        replyText,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress,
        askQuantityForSku: '',
        orderConfirmationRequested: false,
        orderConfirmed: false,
        orderCancelled: false,
      };
    } else if (orderState.hasCartItems) {
      // Rule 5: Show clean order summary and ask to confirm or cancel
      const lines = (orderState.cartItems || []).map((i) => {
        const p = catalog.find((prod) => prod.sku === i.sku);
        const pr = p ? p.price : 0;
        return `• ${i.name} — ${i.quantity} × $${pr.toFixed(2)} = $${(pr * i.quantity).toFixed(2)}`;
      }).join('\n');
      const subtotal = (orderState.cartItems || []).reduce((sum, i) => {
        const p = catalog.find((prod) => prod.sku === i.sku);
        return sum + (p ? p.price * i.quantity : 0);
      }, 0);

      replyText = `Order Summary:\n${lines}\n\nSubtotal: $${subtotal.toFixed(2)}\nShipping Address: ${addressToUse}\n\nWould you like to confirm or cancel this order?`;
      return {
        replyText,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress,
        askQuantityForSku: '',
        orderConfirmationRequested: true,
        orderConfirmed: false,
        orderCancelled: false,
      };
    }
  }

  // Default response - no cart action
  const defaultProduct = catalog[0];
  replyText = defaultProduct
    ? `The price of ${defaultProduct.name} is $${defaultProduct.price.toFixed(2)}. Would you like to buy this product?`
    : `Hello! How can I assist you with your shopping today?`;

  return {
    replyText,
    isComplaint,
    cartAction: { action: 'none', sku: '', quantity: 0 },
    suggestedProductsSKUs: defaultProduct ? [defaultProduct.sku] : [],
    extractedAddress,
    askQuantityForSku: '',
    orderConfirmationRequested: false,
    orderConfirmed: false,
    orderCancelled: false,
  };
}

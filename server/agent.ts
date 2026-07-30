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
}

// Current order-flow state for this conversation, so the model knows whether it's mid
// quantity-clarification or waiting on a yes/no to a confirmation it already asked for.
export interface AgentOrderState {
  awaitingQuantityFor?: string | null;
  orderConfirmationRequested?: boolean;
  hasCartItems?: boolean;
  hasAddress?: boolean;
  cartItems?: { sku: string; name: string; quantity: number }[];
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
    orderState.orderConfirmationRequested
      ? `You already showed the customer an order summary and asked them to confirm it. If their message is an affirmative reply ("yes", "confirm", "go ahead", "place it", etc.), set orderConfirmed to true and set cartAction to 'none' — do not re-add items on a confirmation turn. If they're asking to change something instead, don't set orderConfirmed.`
      : orderState.hasCartItems && orderState.hasAddress
      ? `The customer has items in their cart and a shipping address on file. If the conversation naturally reaches a checkout moment, summarize the cart and address in your reply and ask them to confirm before you place the order — set orderConfirmationRequested to true when you do this, and set cartAction to 'none' on that turn.`
      : '',
  ].filter(Boolean).join(' ');

  const systemInstruction = `You are ShopMate AI, an elite autonomous sales agent representing the merchant's store.
Your goal is to answer customer questions with surgical precision, handle complaints or objections, and actively guide the conversation toward adding items to their cart or closing a sale.

You must respond with a JSON object containing the exact properties specified in the response schema:
1. replyText: Your conversational response to the customer. Maintain your persona.
2. isComplaint: Set to true if the customer is expressing dissatisfaction, complaining, reporting issues, or requesting refunds/exchanges.
3. cartAction: An object with 'action' ('add' or 'none'), 'sku' (string), and 'quantity' (number). Set action to 'add' ONLY when the customer is asking for an item that is not already in their cart (see Current Order State below), or explicitly asking for more/additional units of something already there. Set quantity to whatever number they stated; if they didn't state one, use 1 as a sane default UNLESS you're setting askQuantityForSku instead (see below). Otherwise, action must be 'none'.
4. suggestedProductsSKUs: An array of strings representing product SKUs to cross-sell or recommend as alternatives based on their interest.
5. extractedAddress: If the customer has stated a shipping/delivery address anywhere in the conversation (street, city, or similarly specific delivery details), return it here as a single string. Otherwise return an empty string. Never invent or guess an address.
6. askQuantityForSku: Only set this (to the SKU) if the customer's request is genuinely ambiguous about quantity AND you're asking them to clarify in replyText instead of defaulting to 1 — this should be rare, most requests can default to quantity 1. Empty string otherwise.
7. orderConfirmationRequested: Set to true only in the same turn where your replyText presents an order summary (cart + address) and explicitly asks the customer to confirm it.
8. orderConfirmed: Set to true only when the customer's message is an explicit "yes, confirm/place the order" reply to a summary you already asked them to confirm in a previous turn (see order state below). Never set this true on the same turn you set orderConfirmationRequested.

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
            description: 'Action to build customer cart.',
            properties: {
              action: {
                type: 'string',
                description: "Can be 'add' or 'none'. Set to 'add' if customer wants to purchase or checkout."
              },
              sku: {
                type: 'string',
                description: 'The exact SKU of the product to add to cart, e.g., NX-402-B.'
              },
              quantity: {
                type: 'integer',
                description: 'How many units to add. Default to 1 if the customer did not specify a number.'
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
            description: 'SKU to ask the customer for a quantity clarification on, if genuinely ambiguous. Empty string otherwise.'
          },
          orderConfirmationRequested: {
            type: 'boolean',
            description: 'True only on the turn where replyText presents an order summary and asks the customer to confirm it.'
          },
          orderConfirmed: {
            type: 'boolean',
            description: 'True only when the customer explicitly confirms an order summary that was already presented in a previous turn.'
          }
        },
        required: ['replyText', 'isComplaint', 'cartAction', 'suggestedProductsSKUs', 'extractedAddress', 'askQuantityForSku', 'orderConfirmationRequested', 'orderConfirmed']
      });

      if (content) {
        return JSON.parse(content.trim()) as AgentReply;
      }
    } catch (ollamaError: any) {
      console.error('Ollama call failed, falling back to simulated logic:', ollamaError.message);
      // Fall through to fallback simulator
    }
  }

  // High-fidelity local fallback simulation if Gemini is not set up
  const lowerMsg = message.toLowerCase();
  let replyText = '';
  let isComplaint = false;
  let cartAction = { action: 'none', sku: '', quantity: 1 };
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
    const found = catalog.find((p) =>
      lowerMsg.includes(p.name.toLowerCase().split(' ')[0]) ||
      lowerMsg.includes(p.sku.toLowerCase())
    ) || catalog[0];

    if (found) {
      if (found.inventory <= 0) {
        replyText = `The ${found.name} is currently out of stock. Would you be interested in any other premium item from our catalog?`;
      } else {
        cartAction = { action: 'add', sku: found.sku, quantity: 1 };
        replyText = `Excellent choice! I have successfully added the ${found.name} (SKU: ${found.sku}, Price: $${found.price}) to your digital shopping cart. I have generated your order checkout summary below. Tap 'Complete Checkout' to finalize your purchase!`;
        // Recommend some other SKUs as upsell
        suggestedProductsSKUs = catalog
          .filter((p) => p.sku !== found.sku)
          .slice(0, 2)
          .map((p) => p.sku);
      }
    } else {
      replyText = `I'd love to help you purchase! Which specific product would you like me to add to your shopping cart?`;
    }
  }
  // Handle product specific queries
  else {
    const found = catalog.find((p) =>
      lowerMsg.includes(p.name.toLowerCase().split(' ')[0]) ||
      lowerMsg.includes(p.sku.toLowerCase())
    );

    if (found) {
      suggestedProductsSKUs = catalog
        .filter((p) => p.sku !== found.sku)
        .slice(0, 2)
        .map((p) => p.sku);

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
      suggestedProductsSKUs = catalog.slice(0, 2).map((p) => p.sku);
    } else if (lowerMsg.includes('shipping') || lowerMsg.includes('deliver') || lowerMsg.includes('pathao')) {
      replyText = `We provide pristine, high-security packaging and lightning-fast standard shipping (2-3 business days) nationwide. If you order within the hour, your package will be dispatched with top-tier priority!`;
    } else {
      // Generic brand ambassador response
      const first = catalog[0];
      replyText = `I appreciate you reaching out! Regarding your query, I'd highly recommend taking a look at our featured product: ${first?.name || 'Store Item'} available for just $${first?.price || '0.00'}. Would you like me to share more specifications or add it to your order?`;
      if (first) suggestedProductsSKUs = [first.sku];
    }
  }

  return {
    replyText,
    isComplaint,
    cartAction,
    suggestedProductsSKUs,
    extractedAddress: '',
    askQuantityForSku: '',
    orderConfirmationRequested: false,
    orderConfirmed: false,
  };
}

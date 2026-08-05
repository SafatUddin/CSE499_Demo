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
Your goal is to answer customer questions with precision, guide customers through their purchase, and strictly adhere to the following mandatory interaction rules:

CRITICAL CART RULE — READ THIS FIRST:
cartAction.action must be 'add' IN ONE CASE ONLY: the customer's current message explicitly states a number of units to buy for a specific product (e.g. "3 units", "ami 2ta nebo", "I want 5"). In every other case — price inquiries, general questions, addresses, "yes I want to buy", order confirmations — cartAction MUST be { action: 'none', sku: '', quantity: 0 }.

Mandatory Interaction Rules:
1. PRICE INQUIRY → ASK TO BUY: If customer asks price (e.g. "price of X?", "how much?"), reply with the price and ask "Would you like to buy this product?". cartAction = none.
2. BUY INTENT WITHOUT QUANTITY → ASK HOW MANY: If customer says they want to buy something but does NOT give a number, reply with the price and ask "How many would you like to buy?". Set askQuantityForSku to that product's SKU. cartAction = none. DO NOT add to cart yet.
3. QUANTITY GIVEN → ADD TO CART: When customer explicitly gives a quantity (number) in their message for a specific product — whether or not awaitingQuantityFor is set — set cartAction = { action:'add', sku: <productSku>, quantity: <number> }. Clear askQuantityForSku after. Examples that qualify: "I want 2 Coca Cola", "Give me 3 Pepsi", "ami 2ta nebo", "5 bottles please". A plain "yes", "I want to buy", or any message without an explicit number does NOT qualify — use action='none' in those cases.
4. ADDRESS MISSING → ASK FOR ADDRESS: After adding to cart, if no address is on file, ask for their delivery address. cartAction = none.
5. CONFIRMATION PROMPT: Once cart has items AND address is on file, show a full order summary (items × qty × price, total, address) and ask "Do you want to confirm this order?". Set orderConfirmationRequested = true. cartAction = none.
6. ORDER CONFIRMED → THANK YOU: When customer confirms (says yes/confirm after step 5), show final order details and say "Thank you for shopping with us!". Set orderConfirmed = true. cartAction = none. DO NOT add any new products.

FORBIDDEN:
- Never set cartAction='add' on a price-inquiry turn.
- Never set cartAction='add' on a confirmation turn (when orderConfirmationRequested is already true).
- Never set cartAction='add' on an address-providing turn.
- Never set cartAction='add' when the customer just says "yes" without a number.
- Never add a product that the customer did not specifically ask about in the current message.

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
            description: 'True only on the turn where replyText presents an order summary (items, quantity, address, total) and asks "Do you want to confirm this order?".'
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
    };
  }

  // Check if quantity is stated in customer message (e.g. "2", "3 units", "5 pcs", "3ta", "2ti", "ami 3ta nibo")
  const qtyMatch =
    message.match(/\b(\d+)\s*(?:ta|ti|te|টা|টি)?\s*(?:units?|pcs?|pieces?|items?|nibo|nebo|kinbo|debo|lagbe)?\b/i) ||
    message.match(/\b(\d+)\b/);
  const statedQuantity = qtyMatch ? parseInt(qtyMatch[1], 10) : null;

  // Rule 5 & Rule 3: Customer explicitly specifies quantity for item being asked or bought
  if (orderState.awaitingQuantityFor && statedQuantity && statedQuantity > 0) {
    const targetSku = orderState.awaitingQuantityFor;
    const product = catalog.find((p) => p.sku === targetSku);
    const productName = product ? product.name : targetSku;
    const price = product ? product.price : 0;

    cartAction = { action: 'add', sku: targetSku, quantity: statedQuantity };
    const currentAddress = extractedAddress || (orderState.hasAddress ? 'Address on file' : '');

    // Rule 2: Ask address before confirming order
    if (!currentAddress) {
      replyText = `Great! I have updated your cart with ${statedQuantity}x ${productName} ($${price.toFixed(2)} each).\nCould you please provide your shipping address before we confirm your order?`;
      return {
        replyText,
        isComplaint: false,
        cartAction,
        suggestedProductsSKUs: [],
        extractedAddress,
        askQuantityForSku: '',
        orderConfirmationRequested: false,
        orderConfirmed: false,
      };
    } else {
      // Rule 4: Paste cart products, quantity, address & ask to confirm
      const tempCart = [...(orderState.cartItems || []).filter((i) => i.sku !== targetSku), { sku: targetSku, name: productName, quantity: statedQuantity }];
      const itemsSummary = tempCart
        .map((i) => {
          const p = catalog.find((prod) => prod.sku === i.sku);
          const pr = p ? p.price : 0;
          return `• ${i.quantity}x ${i.name} ($${pr.toFixed(2)} each)`;
        })
        .join('\n');
      const total = tempCart.reduce((sum, i) => {
        const p = catalog.find((prod) => prod.sku === i.sku);
        return sum + (p ? p.price * i.quantity : 0);
      }, 0);

      replyText = `Here is your order summary:\n${itemsSummary}\nShipping Address: ${currentAddress}\nTotal Price: $${total.toFixed(2)}\n\nDo you want to confirm this order?`;
      return {
        replyText,
        isComplaint: false,
        cartAction,
        suggestedProductsSKUs: [],
        extractedAddress,
        askQuantityForSku: '',
        orderConfirmationRequested: true,
        orderConfirmed: false,
      };
    }
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
        // User stated quantity directly in the buy request e.g. "I want to buy 2 Void Audio One" (Rule 3 + Rule 5)
        cartAction = { action: 'add', sku: found.sku, quantity: statedQuantity };
        const currentAddress = extractedAddress || (orderState.hasAddress ? 'Address on file' : '');

        // Rule 2: Ask address before confirming order
        if (!currentAddress) {
          replyText = `The price of ${found.name} is $${found.price.toFixed(2)} each. I have added ${statedQuantity} unit(s) to your cart.\nCould you please provide your shipping address before we confirm your order?`;
          return {
            replyText,
            isComplaint: false,
            cartAction,
            suggestedProductsSKUs: [],
            extractedAddress,
            askQuantityForSku: '',
            orderConfirmationRequested: false,
            orderConfirmed: false,
          };
        } else {
          // Rule 4: Paste cart products, quantity, address & ask to confirm
          const tempCart = [...(orderState.cartItems || []).filter((i) => i.sku !== found.sku), { sku: found.sku, name: found.name, quantity: statedQuantity }];
          const itemsSummary = tempCart
            .map((i) => {
              const p = catalog.find((prod) => prod.sku === i.sku);
              const pr = p ? p.price : 0;
              return `• ${i.quantity}x ${i.name} ($${pr.toFixed(2)} each)`;
            })
            .join('\n');
          const total = tempCart.reduce((sum, i) => {
            const p = catalog.find((prod) => prod.sku === i.sku);
            return sum + (p ? p.price * i.quantity : 0);
          }, 0);

          replyText = `The price of ${found.name} is $${found.price.toFixed(2)} each.\nHere is your order summary:\n${itemsSummary}\nShipping Address: ${currentAddress}\nTotal Price: $${total.toFixed(2)}\n\nDo you want to confirm this order?`;
          return {
            replyText,
            isComplaint: false,
            cartAction,
            suggestedProductsSKUs: [],
            extractedAddress,
            askQuantityForSku: '',
            orderConfirmationRequested: true,
            orderConfirmed: false,
          };
        }
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
      };
    } else if (orderState.hasCartItems) {
      // Rule 4: Paste cart, quantity, address & ask to confirm
      const itemsSummary = (orderState.cartItems || [])
        .map((i) => {
          const p = catalog.find((prod) => prod.sku === i.sku);
          const pr = p ? p.price : 0;
          return `• ${i.quantity}x ${i.name} ($${pr.toFixed(2)} each)`;
        })
        .join('\n');
      const total = (orderState.cartItems || []).reduce((sum, i) => {
        const p = catalog.find((prod) => prod.sku === i.sku);
        return sum + (p ? p.price * i.quantity : 0);
      }, 0);

      replyText = `Here is your order summary:\n${itemsSummary}\nShipping Address: ${addressToUse}\nTotal Price: $${total.toFixed(2)}\n\nDo you want to confirm this order?`;
      return {
        replyText,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress,
        askQuantityForSku: '',
        orderConfirmationRequested: true,
        orderConfirmed: false,
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
  };
}

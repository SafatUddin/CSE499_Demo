import { Type } from '@google/genai';
import { ai } from './gemini';

export interface AgentPersona {
  storeName?: string;
  tone?: string;
  style?: string;
  customInstructions?: string;
  merchantBusinessInfo?: {
    businessPhone?: string;
    website?: string;
    streetAddress?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  shareBusinessInfo?: boolean;
}

export interface AgentCatalogItem {
  name: string;
  sku: string;
  price: number;
  inventory: number;
  status: string;
  imageUrl?: string;
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
  /** SKU of a product to send a photo of, set by the AI when a picture would help (product shown/asked about). Empty if none. */
  showImageForSku?: string;
}

// Current order-flow state for this conversation, so the model knows whether it's mid
// quantity-clarification or waiting on a yes/no to a confirmation it already asked for.
export interface AgentOrderState {
  awaitingQuantityFor?: string | null;
  orderConfirmationRequested?: boolean;
  hasCartItems?: boolean;
  hasAddress?: boolean;
  cartItems?: { sku: string; name: string; quantity: number }[];
  pendingItem?: { sku: string; name: string; quantity: number; unitPrice: number; lineTotal: number };
  awaitingContactDetails?: boolean;
  /** Server is waiting for the customer to confirm cancelling this specific order. */
  pendingCancelOrder?: { id: string; status: string; total: number } | null;
  ongoingOrders?: { id: string; items: { name: string; quantity: number; price: number }[]; status: string; createdAt: string; total: number }[];
}

// --- Grounding guardrail (CO2 §3.2/§6.3) ---------------------------------------------
// The catalog and order-state numbers are handed to the model in full (no retrieval step
// needed at this catalog size — see docs/PLANNING.md), so "grounded" here means every
// dollar amount in the reply must trace back to one of those given numbers, not to a
// vector-search passage. Confidently-stated wrong prices/totals are the single most
// damaging hallucination class for a sales agent, so this is checked in code rather than
// left to the prompt alone.
export function extractDollarAmounts(text: string): number[] {
  const matches = text.match(/\$\s?\d+(?:,\d{3})*(?:\.\d{1,2})?/g) || [];
  return matches.map((m) => parseFloat(m.replace(/[$,\s]/g, '')));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function collectGroundedAmounts(catalog: AgentCatalogItem[], orderState: AgentOrderState): Set<number> {
  const allowed = new Set<number>();
  const add = (n: number | undefined | null) => {
    if (typeof n === 'number' && Number.isFinite(n)) allowed.add(round2(n));
  };
  for (const p of catalog) add(p.price);
  if (orderState.pendingItem) {
    add(orderState.pendingItem.unitPrice);
    add(orderState.pendingItem.lineTotal);
  }
  if (orderState.cartItems) {
    let subtotal = 0;
    for (const item of orderState.cartItems) {
      const p = catalog.find((c) => c.sku === item.sku);
      if (p) {
        add(p.price);
        add(round2(p.price * item.quantity));
        subtotal += p.price * item.quantity;
      }
    }
    if (orderState.cartItems.length > 0) add(subtotal);
  }
  if (orderState.pendingCancelOrder) add(orderState.pendingCancelOrder.total);
  if (orderState.ongoingOrders) {
    for (const o of orderState.ongoingOrders) {
      add(o.total);
      for (const item of o.items) add(item.price);
    }
  }
  return allowed;
}

// Returns the dollar amounts in `replyText` that aren't traceable to any catalog price or
// order-state number actually given to the model this turn — i.e. likely hallucinated.
export function findUngroundedAmounts(replyText: string, allowed: Set<number>): number[] {
  const stated = extractDollarAmounts(replyText);
  return stated.filter((amount) => !allowed.has(round2(amount)));
}

export async function generateAgentReply({
  message,
  history = [],
  persona,
  catalog = [],
  promptCatalog,
  orderState = {},
}: {
  message: string;
  history?: AgentHistoryItem[];
  persona?: AgentPersona;
  catalog?: AgentCatalogItem[];
  /** Subset of `catalog` actually listed in the prompt text (see selectRelevantCatalog in
   * server.ts) — keeps large catalogs from bloating every request. All SKU/cart/image
   * validation below still uses the full `catalog`, never this narrowed list, so a product
   * the model already committed to earlier in the conversation is never rejected as
   * "not in the catalog" just because it didn't come up in the current message. Defaults
   * to the full catalog when the caller doesn't narrow it. */
  promptCatalog?: AgentCatalogItem[];
  orderState?: AgentOrderState;
}): Promise<AgentReply> {
  // Format catalog description for the model context
  const catalogText = (promptCatalog ?? catalog)
    .map(
      (p) =>
        `- Name: ${p.name}, SKU: ${p.sku}, Price: $${p.price}, Inventory: ${p.inventory} units, Status: ${p.status}, Photo available: ${p.imageUrl ? 'yes' : 'no'}`
    )
    .join('\n');

  const storeName = persona?.storeName?.trim() || 'this store';
  const toneText = persona?.tone || 'Direct, helpful, and highly sophisticated.';
  const styleText =
    persona?.style === 'bullets'
      ? 'Use bullet points for lists, specifications, or pricing whenever possible.'
      : 'Use a fluid, warm, conversational narrative style. Do not use bullets.';
  const customInst = persona?.customInstructions || '';

  // Format merchant business information for the AI to share with customers when asked
  const businessInfo = persona?.merchantBusinessInfo;
  const shareBusinessInfo = persona?.shareBusinessInfo ?? true;
  const merchantBusinessInfoText = shareBusinessInfo && businessInfo
    ? [
        businessInfo.businessPhone ? `Business Phone: ${businessInfo.businessPhone}` : '',
        businessInfo.website ? `Website: ${businessInfo.website}` : '',
        businessInfo.streetAddress ? `Store Address: ${businessInfo.streetAddress}` : '',
        businessInfo.city ? `City: ${businessInfo.city}` : '',
        businessInfo.province ? `Province/State: ${businessInfo.province}` : '',
        businessInfo.postalCode ? `Postal Code: ${businessInfo.postalCode}` : '',
        businessInfo.country ? `Country: ${businessInfo.country}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const cartText = orderState.cartItems && orderState.cartItems.length > 0
    ? orderState.cartItems.map((item) => `${item.quantity}x ${item.name} (SKU: ${item.sku})`).join(', ')
    : 'empty';

  const ongoingOrdersText = orderState.ongoingOrders && orderState.ongoingOrders.length > 0
    ? orderState.ongoingOrders
        .map(
          (o) =>
            `- Order ID: ${o.id}, Status: ${o.status}, Placed: ${o.createdAt}, Total: $${o.total.toFixed(
              2
            )}, Items: ${o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}`
        )
        .join('\n')
    : 'No active ongoing orders (Processing or On the Way).';

  const orderStateText = [
    `The customer's cart currently contains: ${cartText}. This already reflects everything added so far — do NOT set cartAction to 'add' again for an item already in this list unless the customer is explicitly asking for additional/more units beyond what's shown. Simply discussing, confirming, or asking about an item already in the cart is NOT a reason to add it again.`,
    orderState.awaitingQuantityFor
      ? `You just asked the customer how many units of SKU "${orderState.awaitingQuantityFor}" they want. If their message answers that (a number, or a spelled-out quantity like "two"), treat it as the quantity for that SKU rather than a new unrelated request.`
      : '',
    orderState.pendingItem
      ? `The customer wants to buy ${orderState.pendingItem.quantity}x "${orderState.pendingItem.name}" at $${orderState.pendingItem.unitPrice.toFixed(2)} each (total $${orderState.pendingItem.lineTotal.toFixed(2)}). You just showed this and asked them to confirm. If their reply is affirmative (yes/confirm/ok/sure/proceed/go ahead), set orderConfirmed=true and cartAction=none. If they decline (no/cancel/never mind), set orderCancelled=true and cartAction=none.`
      : '',
    orderState.awaitingContactDetails
      ? `The customer confirmed their order. You must now ask for (or extract from this message) their phone number and delivery address together. Combine them as "Phone: <number> | Address: <full address>" and set that as extractedAddress. Set orderConfirmed=true once you have both. cartAction must be none. Do NOT claim the order is finalized — the server decides whether it can be placed.`
      : '',
    orderState.pendingCancelOrder
      ? `You already asked the customer to confirm cancelling order #${orderState.pendingCancelOrder.id.slice(-8).toUpperCase()}. If they clearly confirm (yes / yes cancel it / confirm), set orderCancelled=true and cartAction=none. If they decline, set orderCancelled=false and acknowledge you will keep the order. Do not invent a different order id.`
      : '',
    orderState.orderConfirmationRequested
      ? `You already showed the customer an order summary and asked them to confirm or cancel it. If their message is affirmative ("yes", "confirm", "go ahead", "place it", etc.), set orderConfirmed to true and cartAction to 'none' — do not re-add items on a confirmation turn. If their message is a cancellation ("cancel", "never mind", "stop", "don't order", etc.), set orderCancelled to true and cartAction to 'none'. If they're asking to change something, set neither.`
      : orderState.hasCartItems && orderState.hasAddress
      ? `The customer has items in their cart and a shipping address on file. If the conversation naturally reaches a checkout moment, show a clean order summary (product name, quantity, price per unit, line total, subtotal, shipping address) and ask "Would you like to confirm or cancel this order?" — set orderConfirmationRequested to true when you do this, and set cartAction to 'none' on that turn.`
      : '',
  ].filter(Boolean).join(' ');

  const systemInstruction = `You are ShopMate AI, an elite autonomous sales agent representing ${storeName}.
Your goal is to answer customer questions with precision, guide customers through their purchase, and strictly adhere to the following mandatory interaction rules:

Merchant Business Information:
${merchantBusinessInfoText
  ? `${merchantBusinessInfoText}
Important: When customers ask about the store's contact details, location, website, or any business information mentioned above, provide this information accurately. Examples of questions to answer with this information:
- "What's your website?" → Share the website URL
- "Where is your shop located?" / "What's your address?" → Share the store address
- "How can I contact you?" → Share the business phone number
- "Do you have a physical store?" → Mention the address if available`
  : `The merchant has chosen not to share detailed business contact information with customers.
Important: When customers ask about the store's physical location, address, or contact details, respond with: "We operate entirely online to bring you the best selection of products directly to your doorstep. You can browse our catalog and place orders right here through this chat!"
- Do NOT provide any physical address, phone number, or location details
- Focus on the convenience of online shopping and delivery
- Redirect to product browsing and ordering`
}

Mandatory Interaction Rules:
1. PRICE INQUIRY → ASK TO BUY: If customer asks price (e.g. "price of X?", "how much?"), reply with the price and ask "Would you like to buy this product?". cartAction = none.
2. BUY INTENT WITHOUT QUANTITY → ASK HOW MANY: If customer says they want to buy something but does NOT give a number, reply with the price and ask "How many would you like to buy?". Set askQuantityForSku to that product's SKU. cartAction = none. DO NOT add to cart.
3. QUANTITY GIVEN → SET cartAction='add': When customer explicitly gives a quantity (number) for a specific product, set cartAction = { action: 'add', sku: <exact product SKU>, quantity: <number> }. The server will ask for confirmation automatically — do NOT show a confirmation question yourself on this turn. Examples: "I want 2 Coca Cola", "ami 2ta nebo", "Yes 1 meter", "5 bottles please". A plain "yes" without a number is NOT a quantity. Quantity must be a positive integer and must not exceed that product's Inventory from the catalog.
4. CONTACT DETAILS RECEIVED (awaitingContactDetails is true in orderState) → DETAILS CAPTURED: Extract the customer's phone number and delivery address from their message. Combine as "Phone: <number> | Address: <full address>" and set that as extractedAddress. Reply that their details were received and their order request is being processed. Set orderConfirmed=true. cartAction = none. Do NOT invent order IDs. Do NOT claim payment was taken.
5. CANCEL AN EXISTING ORDER: If the customer asks to cancel an already-placed ongoing order, DO NOT cancel it in one step. Ask them to confirm which order / that they want to cancel. Only set orderCancelled=true when they clearly confirm after you asked. Never cancel from a single ambiguous "cancel". Never invent cancellations.
6. ONGOING ORDERS INQUIRIES: Use the Ongoing Orders context to answer questions like "Where is my order?", "What did I order?", "How many items?", "What's the status?", "Can I cancel?", "When was it placed?". Order status must always be one of: Processing, On the Way, Delivered, Cancelled.
7. SHOWING A PRODUCT PHOTO: If the customer asks to see a product, asks what it looks like, or you are introducing/recommending a specific product and it has "Photo available: yes" in the catalog, set showImageForSku to that product's exact SKU so its photo is sent alongside your reply. Only ever set this to a SKU with "Photo available: yes" — never a SKU with no photo, and never invent one. Leave showImageForSku empty ('') on every other turn.
8. COMPLAINT DETECTION → SET isComplaint=true: Set isComplaint=true whenever the customer expresses dissatisfaction, frustration, or a problem — not only sharp words like "scam"/"fake"/"broken"/"refund", but also softer frustration and delay complaints, which are just as real and easy to under-detect, especially in Bangla/Banglish. Treat all of these as complaints: "amar order ta onek deri hoyeche" (my order is very late), "ami hotasho" (I'm disappointed), "kobe pabo?" said with frustration after a delay, "eta thik na" (this isn't right), "আমি বিরক্ত" (I'm annoyed), as well as explicit anger/fraud accusations. When in doubt between "this is a neutral status question" and "this customer sounds unhappy," prefer flagging it as a complaint — a missed complaint (an upset customer with no human follow-up) is worse than an occasional unnecessary escalation. Do NOT set isComplaint=true for a neutral, calm status question with no frustration language (e.g. "Where is my order?" asked plainly) — that is rule 6, not a complaint.
9. UNCERTAIN / CANNOT UNDERSTAND → FLAG FOR REVIEW: If the customer's message is genuinely unclear, garbled, or asks something you have no basis to answer from the catalog/business info/order state above, do NOT guess, invent an answer, or make up details. Reply honestly (e.g. "I want to make sure I get this right for you — a team member will follow up shortly.") and set isComplaint = true so the conversation is flagged for human review. Do NOT set isComplaint=true just because a message is short, informal, or in Banglish you can parse — only when you truly cannot determine what the customer wants or needs.

FORBIDDEN:
- Do not invent products, SKUs, prices, or inventory that are not in the catalog.
- Do not set askQuantityForSku to values other than a real catalog SKU (the server encodes CONFIRM/DETAILS itself).
- Do not claim an order was cancelled or finalized unless the current orderState supports that step.
- Never set cartAction SKU to anything outside the catalog.
- Never set cartAction='add' unless the customer explicitly stated a number to buy in this exact message.
- Never set cartAction='add' on a price-inquiry turn, confirmation turn, or address-providing turn.
- Never guess or default quantities.

Core Directives:
1. Use the provided Product Catalog below to reference accurate prices, names, and stock levels. Never invent products or hallucinate details.
2. Keep your answers concise, engaging, and professional.
3. Under no circumstances mention that you are a language model or AI assistant, or name any underlying model/vendor. You are ShopMate AI, built natively for ${storeName}. Never use a bracketed placeholder like "[Merchant Name]" or "[Store Name]" — always use the actual name "${storeName}" given above.
4. If a product is out of stock (inventory is 0), do not add it to the cart; instead, politely inform the customer and suggest an alternative product that is in stock.
5. Support multilingual queries naturally (Bangla, English, and "Banglish" - romanized/code-mixed Bangla). Respond in the same language register the customer used. Examples across the rules above, in Bangla and Banglish:
   - Price inquiry: "এটার দাম কত?" / "dam koto?" / "price koto ei ta?" → state the price, then ask "কিনতে চান?" / "Want to buy this?" in the customer's register.
   - Buy intent, no quantity: "আমি এটা নিতে চাই" / "ami nite chai" / "eta lagbe" → ask how many, same as rule 2.
   - Buy intent with quantity: "আমি ২টা নিব" / "ami 2ta nibo" / "2ta lagbe" / "duita debo" → quantity is 2, same as rule 3.
   - Confirmation: "হ্যাঁ" / "ha" / "hae" / "thik ache" / "confirm korlam" all count as an affirmative "yes".
   - Cancellation: "না লাগবে না" / "na lagbe na" / "cancel kore dao" / "dorkar nai" all count as a decline/cancel.
   - Address: "ঢাকা, বাড্ডা, রোড ৫" or "Dhaka Badda Road 5 theke" should be extracted the same way as an English address.

Tone of Voice:
${toneText}

Response Style:
${styleText}

Additional Store Instructions:
${customInst}

Current Order State:
${orderStateText || 'No cart/address/confirmation in progress yet.'}

Customer Ongoing Orders:
${ongoingOrdersText}

Available Product Catalog:
${catalogText || 'No products registered in catalog.'}`;

  // If Gemini is configured, it's the primary model — noticeably better multilingual
  // (Bangla/Banglish) understanding than the self-hosted fallback model below.
  if (ai) {
    try {
      const contentsPayload = [
        ...history.map((h) => ({
          role: h.sender === 'customer' ? 'user' : 'model',
          parts: [{ text: h.text }],
        })),
        { role: 'user', parts: [{ text: message }] },
      ];

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          replyText: { type: Type.STRING },
          isComplaint: { type: Type.BOOLEAN },
          cartAction: {
            type: Type.OBJECT,
            properties: {
              action: { type: Type.STRING },
              sku: { type: Type.STRING },
              quantity: { type: Type.INTEGER },
            },
            required: ['action', 'sku', 'quantity'],
          },
          suggestedProductsSKUs: { type: Type.ARRAY, items: { type: Type.STRING } },
          extractedAddress: { type: Type.STRING },
          askQuantityForSku: { type: Type.STRING },
          orderConfirmationRequested: { type: Type.BOOLEAN },
          orderConfirmed: { type: Type.BOOLEAN },
          orderCancelled: { type: Type.BOOLEAN },
          showImageForSku: { type: Type.STRING },
        },
        required: [
          'replyText', 'isComplaint', 'cartAction', 'suggestedProductsSKUs',
          'extractedAddress', 'askQuantityForSku', 'orderConfirmationRequested', 'orderConfirmed', 'orderCancelled',
          'showImageForSku',
        ],
      };

      const callModel = (systemInstructionText: string) =>
        ai!.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: contentsPayload,
          config: {
            systemInstruction: systemInstructionText,
            temperature: 0.3,
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

      const groundedAmounts = collectGroundedAmounts(catalog, orderState);

      let response = await callModel(systemInstruction);
      let parsed: AgentReply | undefined = response.text ? (JSON.parse(response.text.trim()) as AgentReply) : undefined;

      if (parsed) {
        const ungrounded = findUngroundedAmounts(parsed.replyText, groundedAmounts);
        if (ungrounded.length > 0) {
          // One bounded retry with a stricter, narrower instruction rather than silently
          // shipping the ungrounded draft (CO2 §6.3: "any claim that fails this check is
          // stripped and the reply is regenerated").
          const correctionNote = `\n\nCORRECTION REQUIRED: Your previous draft stated ${ungrounded.map((a) => `$${a}`).join(', ')}, which does not match any price, total, or amount given in the catalog or order state above. Regenerate your reply using ONLY the exact numeric amounts given above — do not state any other dollar amount.`;
          response = await callModel(systemInstruction + correctionNote);
          parsed = response.text ? (JSON.parse(response.text.trim()) as AgentReply) : undefined;

          if (parsed && findUngroundedAmounts(parsed.replyText, groundedAmounts).length > 0) {
            // Still ungrounded after the retry — never ship a possibly-wrong price/total.
            // Fall back to a safe template and flag the conversation for merchant review.
            parsed = {
              ...parsed,
              replyText: `Let me double-check that and get back to you shortly — a team member will confirm the exact amount.`,
              isComplaint: true,
            };
          }
        }
      }

      if (parsed) {
        // Never trust the model's SKU blindly — only forward it if that exact product
        // actually has a photo on file, otherwise a hallucinated/stale SKU would silently
        // fail to attach an image or point at the wrong product's photo downstream.
        if (parsed.showImageForSku && !catalog.find((p) => p.sku === parsed.showImageForSku && p.imageUrl)) {
          parsed.showImageForSku = '';
        }
        return parsed;
      }
    } catch (geminiError: any) {
      console.error('Gemini call failed, falling back to simulated logic:', geminiError?.message || geminiError);
      // Fall through to the rule-based simulator
    }
  }

  // Last-resort product guess for a message that names no product (e.g. a bare "yes, 1"
  // continuing an earlier turn). Prefers the SKU the server already knows is pending
  // (awaitingQuantityFor), then scans recent history newest-first for the last product
  // actually mentioned, and only then falls back to catalog[0] — otherwise a short
  // confirmation reply could reference a completely unrelated, arbitrarily-ordered product.
  function findContextuallyRelevantProduct(): AgentCatalogItem | undefined {
    if (orderState.awaitingQuantityFor) {
      const pinned = catalog.find((p) => p.sku === orderState.awaitingQuantityFor);
      if (pinned) return pinned;
    }
    for (let i = history.length - 1; i >= 0; i--) {
      const text = history[i].text.toLowerCase();
      const mentioned = catalog.find((p) => text.includes(p.name.toLowerCase().split(' ')[0]) || text.includes(p.sku.toLowerCase()));
      if (mentioned) return mentioned;
    }
    return catalog[0];
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
        replyText: `Thank you! I've received your details (${combined}). Your order request is being processed — we'll follow up shortly. Thank you for shopping with us!`,
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

  // Pending cancel confirmation (server already asked the customer to confirm).
  if (orderState.pendingCancelOrder) {
    const o = orderState.pendingCancelOrder;
    const shortId = o.id.slice(-8).toUpperCase();
    const affirms =
      lowerMsg === 'yes' ||
      lowerMsg === 'ha' ||
      lowerMsg === 'haa' ||
      lowerMsg === 'ok' ||
      lowerMsg.includes('confirm') ||
      lowerMsg.includes('go ahead') ||
      (lowerMsg.includes('yes') && lowerMsg.includes('cancel')) ||
      lowerMsg.includes('cancel it') ||
      lowerMsg.includes('please cancel');
    const declines =
      lowerMsg === 'no' ||
      lowerMsg === 'na' ||
      lowerMsg.includes('keep') ||
      lowerMsg.includes("don't cancel") ||
      lowerMsg.includes('dont cancel') ||
      lowerMsg.includes('never mind') ||
      lowerMsg.includes('nevermind');

    if (affirms) {
      return {
        replyText: `Understood — confirming cancellation of order #${shortId} now.`,
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
    if (declines) {
      return {
        replyText: `No problem — I'll keep order #${shortId} active. Let me know if you need anything else.`,
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
    return {
      replyText: `Just to confirm: do you want me to cancel order #${shortId}? Please reply "yes, cancel it" or "no, keep it".`,
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

  // Ongoing orders inquiry or cancellation request
  const isCancelRequest =
    lowerMsg.includes('cancel') ||
    lowerMsg.includes('kore den') ||
    lowerMsg.includes('dorkar nai') ||
    lowerMsg.includes('na thak');

  const isOngoingOrderInquiry =
    isCancelRequest ||
    lowerMsg.includes('my order') ||
    lowerMsg.includes('where is my') ||
    lowerMsg.includes('order status') ||
    lowerMsg.includes('order kothay') ||
    lowerMsg.includes('what did i order') ||
    lowerMsg.includes('order details') ||
    lowerMsg.includes('track order') ||
    (lowerMsg.includes('when') && lowerMsg.includes('order')) ||
    (lowerMsg.includes('how many') && lowerMsg.includes('order'));

  if (isCancelRequest || (isOngoingOrderInquiry && orderState.ongoingOrders && orderState.ongoingOrders.length > 0)) {
    const orders = orderState.ongoingOrders || [];

    if (isCancelRequest) {
      if (orders.length === 0) {
        return {
          replyText: `I couldn't find an active order to cancel in this conversation. If you placed an order elsewhere, please share more details.`,
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
      const o = orders[0];
      const items = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
      return {
        replyText: `I found your active order #${o.id.slice(-8).toUpperCase()} (${o.status}) — ${items}, total $${o.total.toFixed(2)}. Do you want me to cancel this order? Reply "yes, cancel it" to confirm, or "no" to keep it.`,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress,
        askQuantityForSku: '',
        orderConfirmationRequested: false,
        orderConfirmed: false,
        // Server requires a second confirmation before actually cancelling.
        orderCancelled: false,
      };
    }
    // General inquiry — describe all ongoing orders
    const orderSummaries = orders.map((o) => {
      const items = o.items.map((i) => `${i.quantity}x ${i.name}`).join(', ');
      return `• Order #${o.id.slice(-8).toUpperCase()} — ${o.status}\n  Items: ${items}\n  Total: $${o.total.toFixed(2)}\n  Placed: ${o.createdAt}`;
    }).join('\n\n');

    replyText = `Here are your ongoing orders:\n\n${orderSummaries}\n\nWould you like to cancel any of these orders or need more information?`;
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



  // Check if customer is complaining (note: 'cancel' is handled separately for orders)
  if (
    lowerMsg.includes('broken') ||
    lowerMsg.includes('scam') ||
    lowerMsg.includes('worst') ||
    lowerMsg.includes('refund') ||
    lowerMsg.includes('fake') ||
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
    if (!product) {
      return {
        replyText: `Sorry, I couldn't match that product in our catalog. Which item would you like to buy?`,
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
    if (statedQuantity > 99 || statedQuantity > product.inventory) {
      const available = product.inventory;
      return {
        replyText:
          available < 1
            ? `Sorry, ${product.name} is currently out of stock. Would you like something else?`
            : `Sorry, we only have ${available} unit(s) of ${product.name} available. How many would you like (1–${Math.min(available, 99)})?`,
        isComplaint: false,
        cartAction: { action: 'none', sku: '', quantity: 0 },
        suggestedProductsSKUs: [],
        extractedAddress,
        askQuantityForSku: product.sku,
        orderConfirmationRequested: false,
        orderConfirmed: false,
        orderCancelled: false,
      };
    }
    const pricePer = product.price;
    const lineTotal = pricePer * statedQuantity;

    return {
      replyText: `You'd like ${statedQuantity}x ${product.name} at $${pricePer.toFixed(2)} each — total $${lineTotal.toFixed(2)}. Would you like to confirm this order?`,
      isComplaint: false,
      cartAction: { action: 'none', sku: '', quantity: 0 },
      suggestedProductsSKUs: [],
      extractedAddress,
      askQuantityForSku: `CONFIRM:${product.sku}:${statedQuantity}`,
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
    lowerMsg.includes('i want') ||
    lowerMsg.includes("i'd like") ||
    lowerMsg.includes('i would like') ||
    lowerMsg.includes('i need') ||
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
      findContextuallyRelevantProduct();

    if (found) {
      if (statedQuantity && statedQuantity > 0) {
        if (statedQuantity > 99 || statedQuantity > found.inventory) {
          const available = found.inventory;
          return {
            replyText:
              available < 1
                ? `Sorry, ${found.name} is currently out of stock. Would you like something else?`
                : `Sorry, we only have ${available} unit(s) of ${found.name} available. How many would you like (1–${Math.min(available, 99)})?`,
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
      catalog.find((p) => lowerMsg.includes(p.name.toLowerCase().split(' ')[0]) || lowerMsg.includes(p.sku.toLowerCase())) ||
      findContextuallyRelevantProduct();

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
      // Rule 5: Ask for shipping address AND phone number before confirming order
      replyText = `Before I confirm your order, I'll need your shipping address and phone number. Please provide both so we can complete your order.`;
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
      // Rule 6: Show complete order summary (per spec) and ask to confirm or cancel
      const lines = (orderState.cartItems || []).map((i) => {
        const p = catalog.find((prod) => prod.sku === i.sku);
        const pr = p ? p.price : 0;
        return `• ${i.name} — ${i.quantity} × $${pr.toFixed(2)} = $${(pr * i.quantity).toFixed(2)}`;
      }).join('\n');
      const subtotal = (orderState.cartItems || []).reduce((sum, i) => {
        const p = catalog.find((prod) => prod.sku === i.sku);
        return sum + (p ? p.price * i.quantity : 0);
      }, 0);

      // Extract phone from address string if present
      const phoneInAddr = addressToUse.match(/Phone:\s*[^|]+/);
      const addrPart = addressToUse.replace(/Phone:[^|]+\|?/, '').trim();
      const phoneLine = phoneInAddr ? `\nPhone: ${phoneInAddr[0].replace('Phone:', '').trim()}` : '';

      replyText = `📋 Order Summary\n\n${lines}\n\nSubtotal: $${subtotal.toFixed(2)}\nShipping Address: ${addrPart}${phoneLine}\n\nWould you like to confirm or cancel this order?`;
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
  const defaultProduct = findContextuallyRelevantProduct();
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

export async function isQuestionOrPriceInquiry(text: string): Promise<boolean> {
  if (!text || typeof text !== 'string') return false;

  const lower = text.toLowerCase().trim();

  // 1. Direct "price" word check (case insensitive) or price-synonym check in English/Bangla/Banglish
  if (
    /\bprice\b/i.test(lower) ||
    lower.includes('dam') ||
    lower.includes('daam') ||
    lower.includes('taka') ||
    lower.includes('rate') ||
    lower.includes('cost') ||
    lower.includes('কত') ||
    lower.includes('দাম') ||
    lower.includes('টাকা')
  ) {
    return true;
  }

  // 2. Direct question punctuation or common interrogative markers
  if (
    lower.includes('?') ||
    lower.startsWith('is ') ||
    lower.startsWith('are ') ||
    lower.startsWith('can ') ||
    lower.startsWith('do ') ||
    lower.startsWith('does ') ||
    lower.startsWith('what') ||
    lower.startsWith('how') ||
    lower.startsWith('where') ||
    lower.startsWith('when') ||
    lower.includes('koto') ||
    lower.includes('koyta') ||
    lower.includes('kene') ||
    lower.includes('keno') ||
    lower.includes('ki ') ||
    lower.includes(' ache') ||
    lower.includes(' hobe') ||
    lower.includes(' naki') ||
    lower.includes(' hobe ki')
  ) {
    return true;
  }

  // 3. If Gemini AI is available, use Gemini to evaluate multilingual questions (English, Bangla, Banglish)
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Analyze the following social media post comment. Determine if the user is asking a question OR inquiring about price/details, regardless of whether the language is English, Bangla, or Banglish (romanized Bangla).\n\nComment: "${text}"\n\nReturn JSON: {"isQuestionOrPrice": true} or {"isQuestionOrPrice": false}`,
              },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isQuestionOrPrice: { type: Type.BOOLEAN },
            },
            required: ['isQuestionOrPrice'],
          },
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        return !!parsed.isQuestionOrPrice;
      }
    } catch (err: any) {
      console.error('Error classifying comment question/price intent via Gemini');
    }
  }

  return false;
}


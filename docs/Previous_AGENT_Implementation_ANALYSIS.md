# AI Agent Analysis Report

## Overview
- **AI Model**: Google Gemini 3.5 Flash Lite (primary), with rule-based fallback
- **Architecture**: ⚡ **UPDATED** - Explicit Tool Calling (migrated from structured JSON)
- **Implementation**: TypeScript with Google GenAI SDK
- **Grounding Mechanism**: Dollar amount validation to prevent price hallucinations (CO2 §3.2/§6.3)
- **Migration Date**: 2026-09-30
- **Why Changed**: Better Bangla/Banglish intent understanding + proper shop location handling

---

## Core Function: `generateAgentReply()`

### Input Parameters
- `message`: Customer's current message
- `history`: Conversation history (sender, text pairs)
- `persona`: Merchant's AI personality settings
- `catalog`: Full product catalog
- `promptCatalog`: Subset of catalog for prompt (prevents token bloat)
- `orderState`: Current order flow state machine

### Output Schema (AgentReply)
```typescript
{
  replyText: string              // AI response text
  isComplaint: boolean           // Complaint detection flag
  cartAction: {                  // Cart modification instruction
    action: string,              // 'add' | 'none'
    sku: string,
    quantity: number
  }
  suggestedProductsSKUs: string[] // Product recommendations
  extractedAddress: string        // Parsed delivery address
  askQuantityForSku: string       // SKU waiting for quantity input
  orderConfirmationRequested: boolean
  orderConfirmed: boolean
  orderCancelled: boolean
  showImageForSku?: string        // SKU for product photo attachment
}
```

---

## AI Instruction Flow

### System Instruction Structure
1. **Role Definition**: "ShopMate AI, elite autonomous sales agent representing ${storeName}" (dynamic store name)
2. **Merchant Business Info** (conditional sharing) - MOVED UP for priority
3. **Mandatory Interaction Rules** (9 rules - see below)
4. **Forbidden Actions** (constraints)
5. **Core Directives** (general behavior)
6. **Tone & Style** (from persona settings)
7. **Additional Store Instructions** (custom merchant rules)
8. **Current Order State** (state machine context)
9. **Ongoing Orders** (order history)
10. **Product Catalog** (available inventory)

### 9 Mandatory Interaction Rules (UPDATED from 7)

1. **PRICE INQUIRY → ASK TO BUY**
   - Trigger: Customer asks price
   - Response: Reply with price + "Would you like to buy this product?"
   - cartAction: none

2. **BUY INTENT WITHOUT QUANTITY → ASK HOW MANY**
   - Trigger: "I want to buy X" (no number given)
   - Response: Reply with price + "How many would you like to buy?"
   - Set: `askQuantityForSku` to product SKU
   - cartAction: none (DO NOT add yet)

3. **QUANTITY GIVEN → SET cartAction='add'**
   - Trigger: Customer gives explicit number ("I want 2 Coca Cola")
   - Action: Set cartAction = { action: 'add', sku, quantity }
   - Server handles confirmation automatically
   - Validation: Quantity ≤ inventory, positive integer

4. **CONTACT DETAILS RECEIVED**
   - Trigger: `awaitingContactDetails` is true
   - Extract: Phone + address from message
   - Format: "Phone: <number> | Address: <full address>"
   - Set: `extractedAddress`, `orderConfirmed=true`
   - cartAction: none

5. **CANCEL EXISTING ORDER**
   - Trigger: Customer asks to cancel placed order
   - Process: Two-step confirmation (ask first, then cancel)
   - Set: `orderCancelled=true` only after explicit confirmation
   - Never cancel from ambiguous "cancel" statement

6. **ONGOING ORDERS INQUIRIES**
   - Handle: "Where is my order?", "What did I order?", status checks
   - Data source: `orderState.ongoingOrders`
   - Status values: Processing | On the Way | Delivered | Cancelled

7. **SHOWING PRODUCT PHOTO**
   - Trigger: Customer asks to see product OR AI recommends product
   - Condition: Product must have "Photo available: yes"
   - Set: `showImageForSku` to exact SKU
   - Leave empty if no photo available

8. **COMPLAINT DETECTION → SET isComplaint=true** (NEW)
   - Trigger: Customer expresses dissatisfaction, frustration, or problems
   - **Sharp words**: "scam", "fake", "broken", "refund", "worst", "bad", "defect"
   - **Soft frustration**: "amar order ta onek deri hoyeche" (my order is very late), "ami hotasho" (I'm disappointed), "kobe pabo?" (when will I get it - with frustration), "eta thik na" (this isn't right), "আমি বিরক্ত" (I'm annoyed)
   - **Philosophy**: When in doubt, flag as complaint — missed complaint = upset customer with no follow-up (worse than occasional unnecessary escalation)
   - **NOT a complaint**: Neutral status questions like "Where is my order?" asked calmly (that's Rule 6)

9. **UNCERTAIN / CANNOT UNDERSTAND → FLAG FOR REVIEW** (NEW)
   - Trigger: Message is genuinely unclear, garbled, or unanswerable from context
   - Response: "I want to make sure I get this right for you — a team member will follow up shortly."
   - Set: `isComplaint = true` (flags for human review)
   - **Do NOT flag** just because message is short, informal, or in Banglish
   - Only flag when truly cannot determine customer intent

---

## State Machine: Order Flow

### States Tracked in `AgentOrderState`
- `awaitingQuantityFor`: SKU waiting for quantity input
- `orderConfirmationRequested`: Waiting for yes/no on order summary
- `hasCartItems`: Cart is non-empty
- `hasAddress`: Delivery address exists
- `cartItems`: Current cart contents
- `pendingItem`: Single item awaiting pre-confirmation (CONFIRM: flow)
- `awaitingContactDetails`: Waiting for phone + address (DETAILS: flow)
- `pendingCancelOrder`: Order ID waiting for cancel confirmation
- `ongoingOrders`: Active orders (Processing/On the Way status)

### Grounding Guardrail (NEW)

**Purpose**: Prevent price hallucinations (CO2 §3.2/§6.3)

**How It Works**:
1. **Collect grounded amounts** from catalog + orderState before AI call
2. **Extract dollar amounts** from AI reply using regex
3. **Find ungrounded amounts** (amounts NOT in grounded set)
4. **If ungrounded detected**: Retry with correction instruction
5. **If still ungrounded**: Replace with safe template + flag as complaint

**Functions**:
- `collectGroundedAmounts(catalog, orderState)`: Returns Set of allowed prices
- `extractDollarAmounts(text)`: Regex extracts `$X.XX` from text
- `findUngroundedAmounts(replyText, allowed)`: Returns hallucinated amounts
- `round2(n)`: Rounds to 2 decimals for comparison

**Result**: Never ship confidently-stated wrong prices/totals

---

## Detailed Price Grounding Implementation

### Problem
Confidently-stated wrong prices = most damaging hallucination for sales agents

### Solution: 5-Phase Validation Pipeline

**Phase 1: Collect Ground Truth (Pre-Generation)**
```typescript
const groundedAmounts = collectGroundedAmounts(catalog, orderState)
// Returns Set<number> of all valid dollar amounts
```

**Phase 2: AI Generation**
```typescript
response = await callModel(systemInstruction)
parsed = JSON.parse(response.text)
```

**Phase 3: Extract & Compare (Post-Generation)**
```typescript
stated = extractDollarAmounts(parsed.replyText)  // Regex: /\$\d+\.?\d*/g
ungrounded = stated.filter(amt => !groundedAmounts.has(round2(amt)))
```

**Phase 4: Bounded Retry (One Attempt)**
```typescript
if (ungrounded.length > 0) {
  correctionNote = "CORRECTION REQUIRED: Your draft stated $X, not in catalog..."
  response = await callModel(systemInstruction + correctionNote)
}
```

**Phase 5: Fail-Safe Fallback**
```typescript
if (still ungrounded) {
  parsed.replyText = "Let me double-check... team member will confirm"
  parsed.isComplaint = true  // Escalate to human
}
```

### Functions
- `extractDollarAmounts(text)`: Regex captures all `$X.XX` in text
- `collectGroundedAmounts(catalog, orderState)`: Builds Set of valid amounts
- `findUngroundedAmounts(replyText, allowed)`: Returns hallucinated amounts
- `round2(n)`: Rounds to 2 decimals (prevents float precision issues)

---

### Flow Stages

**Stage 1: Price Inquiry**
```
Customer: "What's the price of Coca Cola?"
AI: "The price is $2.50. Would you like to buy this product?"
Action: cartAction = none, askQuantityForSku = ''
```

**Stage 2: Buy Intent (No Quantity)**
```
Customer: "I want to buy Coca Cola"
AI: "The price is $2.50. How many would you like to buy?"
Action: cartAction = none, askQuantityForSku = 'coca-cola-sku'
```

**Stage 3: Quantity Provided → Pre-Confirmation**
```
Customer: "2 bottles"
AI: "You'd like 2x Coca Cola at $2.50 each — total $5.00. Would you like to confirm?"
Action: cartAction = none, askQuantityForSku = 'CONFIRM:coca-cola-sku:2'
       (Server sets pendingItem)
```

**Stage 4: Confirmation → Contact Details**
```
Customer: "Yes confirm"
AI: "Great! Please provide your phone number and delivery address"
Action: cartAction = none, orderConfirmed = true
       (Server sets awaitingContactDetails = true)
```

**Stage 5: Details Provided → Order Placed**
```
Customer: "01712345678, 123 Main St, Dhaka"
AI: "Thank you! Your order is being processed"
Action: extractedAddress = "Phone: 01712345678 | Address: 123 Main St, Dhaka"
        orderConfirmed = true
        (Server creates order in database)
```

---

## Tool Calling Architecture ⚡ UPDATED

### **PRIMARY: Explicit Tool Calling (NEW)**

The agent NOW uses true function calling. Key changes:

1. **AI focuses on understanding intent** (not keyword matching)
2. **Tools execute actions explicitly** (8 tools available)
3. **Better Bangla/Banglish support** - AI interprets meaning naturally
4. **Shop location queries work** - Properly uses merchant business info

**8 Available Tools:**
```typescript
1. add_to_cart          - Add product when quantity stated
2. ask_for_quantity     - Request quantity when not given
3. show_product_image   - Display product photo
4. capture_contact_details - Save phone/address
5. confirm_order        - Confirm/cancel after summary
6. cancel_order         - Cancel ongoing order
7. flag_for_human_review - Escalate complaints/unclear messages
8. request_order_confirmation - Show checkout summary
```

**Tool Declaration Example:**
```typescript
{
  name: 'add_to_cart',
  description: 'Add product when customer states quantity (e.g., "ami 2ta nibo")',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sku: { type: Type.STRING, description: 'Exact SKU from catalog' },
      quantity: { type: Type.INTEGER, description: 'Units to buy' },
      productName: { type: Type.STRING, description: 'Product name' }
    },
    required: ['sku', 'quantity', 'productName']
  }
}
```

**Gemini API Configuration:**
```typescript
const response = await ai.models.generateContent({
  model: 'gemini-3.5-flash-lite',
  contents: contentsPayload,
  config: {
    systemInstruction,
    temperature: 0.4,  // Higher than before (was 0.3) for intent understanding
    tools: [{ functionDeclarations: tools }]  // ← Tool calling enabled
  }
});
```

**Processing Tool Calls:**
```typescript
for (const part of candidate.content.parts) {
  if (part.text) replyText += part.text;           // AI conversation
  if (part.functionCall) toolCalls.push(part.functionCall);  // Actions
}

// Execute tools
switch (toolCall.name) {
  case 'add_to_cart':
    result.cartAction = { action: 'add', sku: args.sku, quantity: args.quantity };
    break;
  case 'show_product_image':
    result.showImageForSku = args.sku;
    break;
  // ... handle all 8 tools
}
```

### **FALLBACK: Rule-Based Pattern Matching (Preserved)**

When Gemini fails, fallback logic uses:
- **String pattern matching**: `lowerMsg.includes('cancel')`
- **Regex extraction**: `message.match(/\b(\d+)\s*(?:ta|ti|te)?/)`
- **State machine logic**: `if (orderState.awaitingQuantityFor && statedQuantity)`
- **Keyword detection**: Arrays of complaint/intent keywords

Fallback is unchanged from previous version.

---

## Shop Location Handling ⭐ NEW FEATURE

### Problem Before Migration
With structured JSON output, the AI struggled to answer location queries even when merchant had a physical shop:

```
Customer: "দোকান কোথায়?" (Where is the shop?)
AI: "We operate entirely online..." ❌
// Even though merchant had:
// streetAddress: "123 Gulshan Avenue, Dhaka"
```

### Solution After Tool Calling
AI now properly interprets location queries and shares business info:

```
Customer: "দোকান কোথায়?" (Where is the shop?)
AI: "Our shop is located at: 123 Gulshan Avenue, Dhaka, Dhaka Division 1212, Bangladesh" ✅
```

### Merchant Business Info Structure
```typescript
merchantBusinessInfo: {
  businessPhone: "+880 1712-345678",
  website: "https://example.com",
  streetAddress: "123 Gulshan Avenue",
  city: "Dhaka",
  province: "Dhaka Division",
  postalCode: "1212",
  country: "Bangladesh"
}
shareBusinessInfo: true  // Toggle to enable/disable
```

### Location Query Intent Recognition

**Bangla:**
- "দোকান কোথায়?" (Where is the shop?)
- "তোমাদের দোকানের ঠিকানা কি?" (What's your shop address?)
- "শপ কোথায় আছে?" (Where is the shop located?)

**Banglish:**
- "shop kothay?"
- "dokan kothay ache?"
- "address ki?"

**English:**
- "Where is your shop?"
- "What's your address?"
- "Do you have a physical store?"
- "Where can I find you?"

### System Instruction Enhancement

**When shareBusinessInfo = true:**
```
MERCHANT INFORMATION:
Phone: +880 1712-345678
Website: https://example.com
Store Location: 123 Gulshan Avenue, Dhaka, Dhaka Division 1212, Bangladesh

When customers ask about the shop location, address, contact details, or "where is your shop":
- Share the Store Location information above
- Mention specific details like street address, city, phone number
- Be helpful and informative about how they can find or contact the physical store
```

**When shareBusinessInfo = false:**
```
The merchant operates online only.

When customers ask about physical location or address:
- Explain: "We operate entirely online to bring you the best selection directly to your doorstep"
- Redirect to browsing products and placing orders through chat
```

### Why Tool Calling Fixed This

**Before (Structured JSON):**
- AI had to match exact keywords in rigid rules
- Location queries were deprioritized
- Bangla/Banglish variants often missed

**After (Tool Calling):**
- AI understands INTENT naturally
- System instruction emphasizes merchant info at the top
- No tool needed for location queries (just conversational response)
- Better multilingual understanding

---

---

## Constraint Enforcement

### Hard Constraints (FORBIDDEN)
- ❌ Invent products/SKUs not in catalog
- ❌ Set `askQuantityForSku` to non-catalog values
- ❌ Claim order cancelled/finalized without state support
- ❌ Set cartAction SKU outside catalog
- ❌ Set cartAction='add' on price-inquiry/confirmation/address turns
- ❌ Guess or default quantities
- ❌ Mention being "AI model" or name vendor (Google)

### Validation Checks
- **Quantity**: Must be positive integer, ≤ inventory, ≤ 99
- **SKU validation**: All SKUs cross-referenced with catalog
- **Photo validation**: `showImageForSku` only for products with `imageUrl`
- **Cart state**: Never re-add items already in cart during discussion

---

## Multilingual Support

### Languages Handled
- **English**: Native understanding
- **Bangla**: Unicode Bangla script (দাম, টাকা, কত)
- **Banglish**: Romanized Bangla (kinbo, nibo, dam koto, lagbe)

### Bangla/Banglish Keywords
- **Price**: dam, daam, koto taka, taka koto
- **Buy**: kinbo, nibo, nebo, lagbe, nite chai, kinte chai
- **Quantity**: ta, ti, te (২টা = 2ta = 2 units)
- **Confirm**: haan, haa, korun, korbo
- **Cancel**: na thak, dorkar nai

### Implementation
- **Gemini**: Handles multilingual naturally (trained on Bangla)
- **Fallback**: Explicit keyword lists in rule-based logic

---

## Complaint Detection

### Trigger Words (EXPANDED)

**Sharp complaints**:
```typescript
broken | scam | worst | refund | fake | bad | 
defect | late | unhappy
```

**Soft frustration (NEW - Bangla/Banglish)**:
- "amar order ta onek deri hoyeche" (my order is very late)
- "ami hotasho" (I'm disappointed)
- "kobe pabo?" (when will I get it - with frustration tone)
- "eta thik na" (this isn't right)
- "আমি বিরক্ত" (I'm annoyed)

**Philosophy**: 
- When in doubt between "neutral status question" and "unhappy customer", prefer flagging as complaint
- Missed complaint (upset customer + no follow-up) > unnecessary escalation

**NOT a complaint**: 
- Neutral, calm status questions (e.g., "Where is my order?" without frustration)

### Response
```
"I am truly sorry... I have logged this immediately as 
a high-priority support ticket and escalated..."
```

### Flag: `isComplaint: true`

---

## Uncertainty Handling (NEW)

### Trigger
- Message is genuinely unclear, garbled, or unanswerable from given context
- Cannot determine customer intent from catalog/business info/order state

### Response
```
"I want to make sure I get this right for you — a team member will follow up shortly."
```

### Flag
- `isComplaint: true` (flags conversation for human review)

### NOT uncertain
- Short messages
- Informal language
- Banglish that can be parsed

Only flag when **truly cannot determine what customer wants**

---

## Special Features

### 1. Merchant Business Info Sharing
- **Toggle**: `shareBusinessInfo` (default: true)
- **Fields**: phone, website, address, city, province, postal, country
- **When disabled**: AI says "We operate entirely online..."

### 2. AI Persona Customization
- **Store Name**: Dynamic `${storeName}` (default: "this store") - replaces [Merchant Name] placeholders
- **Tone**: Direct/friendly/professional (default: "Direct, helpful, sophisticated")
- **Style**: Bullets vs narrative (default: bullets for specs)
- **Custom instructions**: Free-text merchant rules

### 3. Cart View Intent
```
Trigger: "my cart", "what's in my cart", "cart dekha"
Response: Line-item list with prices + total
```

### 4. Clear Cart Intent
```
Trigger: "clear cart", "remove everything"
Response: "Done! I've cleared your cart"
Server handles actual deletion
```

### 5. Ongoing Orders Management
- **View orders**: Shows order ID, status, items, total, date
- **Cancel orders**: Two-step confirmation required
- **Track orders**: Status must be Processing/On the Way/Delivered/Cancelled

---

## Error Handling

### Gemini Failure
```typescript
try {
  const response = await ai.models.generateContent(...)
} catch (geminiError) {
  console.error('Gemini call failed, falling back to simulated logic:', geminiError?.message)
  // Falls through to rule-based logic
}
```

### Price Hallucination Detection (NEW)
```typescript
const ungrounded = findUngroundedAmounts(parsed.replyText, groundedAmounts)
if (ungrounded.length > 0) {
  // One bounded retry with correction instruction
  response = await callModel(systemInstruction + correctionNote)
  
  if (still ungrounded after retry) {
    // Safe fallback
    parsed.replyText = "Let me double-check... a team member will confirm"
    parsed.isComplaint = true  // Flag for review
  }
}
```

### Invalid SKU Detection
```typescript
if (parsed.showImageForSku && 
    !catalog.find(p => p.sku === parsed.showImageForSku && p.imageUrl)) {
  parsed.showImageForSku = ''; // Sanitize hallucinated SKU
}
```

### Out-of-Stock Handling
```typescript
if (product.inventory === 0) {
  return "Sorry, out of stock. Would you like something else?"
}
```

### Over-Quantity Request
```typescript
if (statedQuantity > product.inventory) {
  return `Sorry, we only have ${available} units available`
}
```

---

## Context Management

### Contextual Product Inference
When customer says "yes, 1" without naming product:

1. **Priority 1**: `orderState.awaitingQuantityFor` (server-tracked SKU)
2. **Priority 2**: Scan recent history for last mentioned product
3. **Priority 3**: Fallback to `catalog[0]` (first product)

```typescript
function findContextuallyRelevantProduct() {
  if (orderState.awaitingQuantityFor) return catalog.find(...)
  for (let i = history.length - 1; i >= 0; i--) {
    // Scan backwards for product mentions
  }
  return catalog[0];
}
```

---

## Prompt Optimization

### Catalog Subset Strategy
- **Problem**: Large catalogs blow up token count
- **Solution**: `promptCatalog` (relevant subset) vs `catalog` (full validation)
- **Benefit**: SKU validation still uses full catalog (prevents "not in catalog" errors)

### History Management
```typescript
contentsPayload = [
  ...history.map(h => ({
    role: h.sender === 'customer' ? 'user' : 'model',
    parts: [{ text: h.text }]
  })),
  { role: 'user', parts: [{ text: message }] }
]
```

---

## Secondary Function: `isQuestionOrPriceInquiry()`

### Purpose
Classify social media comments as questions/price inquiries

### Detection Methods

**Method 1: Keyword Matching**
```typescript
/\bprice\b/i | dam | daam | taka | rate | cost | কত | দাম | টাকা
```

**Method 2: Question Markers**
```typescript
? | is | are | can | do | what | how | where | when | 
koto | ki | ache | hobe | naki
```

**Method 3: Gemini Classification** (if available)
```
Prompt: "Determine if user is asking question OR inquiring about price"
Output: {"isQuestionOrPrice": true/false}
```

### Use Case
Filter social media comments to only reply to relevant inquiries

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Message Input                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────────────────────┐
         │  Build System Instruction       │
         │  - Dynamic Store Name           │
         │  - Merchant Business Info       │
         │  - 9 Mandatory Rules (↑ from 7)│
         │  - Current Order State          │
         │  - Product Catalog              │
         │  - Merchant Persona             │
         └────────────┬────────────────────┘
                      │
         ┌────────────▼─────────────┐
         │  Collect Grounded $      │ ← NEW: Price Validation
         │  (catalog + orderState)  │
         └────────────┬─────────────┘
                      │
         ┌────────────▼─────────────┐
         │   PRIMARY: Gemini AI     │
         │   - Structured JSON      │
         │   - Schema-constrained   │
         │   - Multilingual         │
         │   - Temperature: 0.3     │ ← UPDATED (was 0.7)
         └────────┬─────────────────┘
                  │
         ┌────────▼─────────┐
         │  Parse JSON      │
         └────────┬──────────┘
                  │
         ┌────────▼──────────────────┐
         │  Find Ungrounded $        │ ← NEW: Hallucination Check
         │  (amounts not in catalog) │
         └────────┬──────────────────┘
                  │
         ┌────────▼────────────┐
         │  Ungrounded found?  │
         │  ├─Yes: Retry once  │ ← NEW: Bounded Retry
         │  │  with correction  │
         │  └─No: Proceed      │
         └────────┬────────────┘
                  │
         ┌────────▼─────────────────┐
         │  Still ungrounded?       │
         │  ├─Yes: Safe fallback +  │ ← NEW: Never ship bad price
         │  │      flag complaint    │
         │  └─No: Use AI response   │
         └────────┬─────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌───────┐   ┌──────────┐   ┌─────────┐
│Gemini │   │Rule-Based│   │Validate │
│Output │   │Fallback  │   │SKUs     │
│JSON   │   │Logic     │   │Photos   │
└───┬───┘   └────┬─────┘   └────┬────┘
    │            │              │
    └────────────┼──────────────┘
                 │
                 ▼
    ┌────────────────────────┐
    │   AgentReply Output    │
    │   - replyText          │
    │   - cartAction         │
    │   - orderConfirmed     │
    │   - extractedAddress   │
    │   - showImageForSku    │
    │   - isComplaint        │ ← Enhanced detection
    └────────────────────────┘
```

---

## Key Insights

1. **⚡ NOW uses tool calling** - 8 explicit tools for action execution (migrated from structured JSON)
2. **Intent-focused** - AI understands what customer means, not just keywords
3. **State machine** - Order flow controlled via `AgentOrderState`
4. **Two-step confirmation** - CONFIRM: flow prevents accidental orders
5. **Hybrid fallback** - Gemini with tools → rule-based if AI fails
6. **Multilingual native** - Bangla/Banglish without translation layer (improved with tool calling)
7. **8 explicit tools** - add_to_cart, ask_for_quantity, show_product_image, capture_contact_details, confirm_order, cancel_order, flag_for_human_review, request_order_confirmation
8. **Context-aware** - Product inference from history/state
9. **Validation strict** - All SKUs checked against catalog
10. **Photo safety** - Never attach image for hallucinated SKU
11. **Merchant-controlled** - Business info sharing toggle + persona + dynamic store name
12. **Shop location support** ⭐ NEW - AI properly answers "where is your shop?" using merchant business info
13. **Price grounding** - Dollar amount validation with bounded retry to prevent hallucinations
14. **Enhanced complaint detection** - Catches both sharp complaints and soft frustration (especially Bangla/Banglish)
15. **Uncertainty handling** - Flags unclear messages for human review instead of guessing
16. **Temperature adjusted** - 0.4 (up from 0.3) for better intent understanding with tool calling

---

## Technology Stack
- **AI Provider**: Google GenAI SDK
- **Model**: gemini-3.5-flash-lite
- **Language**: TypeScript
- **Architecture**: ⚡ Explicit Tool Calling (8 tools)
- **Temperature**: 0.4 (UPDATED from 0.3 - higher for better intent understanding)
- **Constraint Method**: Function Declarations (FunctionDeclaration[] from GenAI SDK)
- **Grounding**: Dollar amount validation with bounded retry
- **Migration**: From structured JSON output → Tool calling (2026-09-30)


---

## Summary of Updates from Git Pull

### Major New Features

1. **Price Grounding Guardrail** ⭐ CRITICAL
   - Prevents hallucinated prices/totals (most damaging error class)
   - 5-phase pipeline: Collect → Generate → Extract → Retry → Fail-safe
   - One bounded retry, then human escalation
   - References: CO2 §3.2/§6.3

2. **Enhanced Complaint Detection** 🔍
   - Now catches soft frustration, not just sharp complaints
   - Bangla/Banglish frustration phrases added
   - Philosophy: "When in doubt, flag it" (missed complaint > unnecessary escalation)

3. **Uncertainty Handling** 🤔
   - AI can now admit when it doesn't understand
   - Flags unclear messages for human review instead of guessing
   - Prevents invented/wrong responses to ambiguous queries

### Configuration Updates

4. **Dynamic Store Name** 🏪
   - `persona.storeName` replaces hardcoded "[Merchant Name]" placeholders
   - Default: "this store"
   - Makes AI responses feel more personalized

5. **Lower Temperature** 🌡️
   - Changed from 0.7 → 0.3
   - More deterministic for sales accuracy
   - Less creative variation, more consistent behavior

### Instruction Updates

6. **Rules Expanded from 7 → 9** 📋
   - Rule 8: Complaint Detection (explicit instruction)
   - Rule 9: Uncertainty Handling (explicit instruction)
   - Previously these were implicit behaviors

7. **Merchant Business Info Moved Up** 📍
   - Now appears BEFORE mandatory rules in system instruction
   - Higher priority = better recall when answering location/contact questions

8. **Buy Intent Keywords Expanded** 🛒
   - Added: "i want", "i'd like", "i would like", "i need"
   - Better natural language understanding

### Architecture Improvements

9. **Grounding Functions Added** 🧮
   - `extractDollarAmounts(text)`: Regex extraction
   - `collectGroundedAmounts(catalog, orderState)`: Build truth set
   - `findUngroundedAmounts(replyText, allowed)`: Detect hallucinations
   - `round2(n)`: Precision handling

10. **Error Handling Enhanced** ⚠️
    - Gemini error messages now include `.message` property
    - More detailed logging for debugging

---

## Implementation Philosophy Changes

### From: "Trust the AI"
- Gemini generates response
- Validate SKUs/photos
- Return to user

### To: "Trust but Verify" ✅
- Gemini generates response
- **Validate prices against ground truth**
- Retry once if wrong
- Fail-safe if still wrong
- Validate SKUs/photos
- Return to user

### Why This Matters
- **Price errors destroy trust** — a customer quoted $50 when it's actually $40 will never return
- **Soft complaints matter** — "ami hotasho" (I'm disappointed) is as important as "scam"
- **Admitting uncertainty** — saying "let me check" is better than confidently wrong answers
- **Deterministic sales** — lower temperature = more consistent, predictable behavior

---

## Code Quality Indicators

### Documentation References
- CO2 §3.2: Grounding mechanism theory
- CO2 §6.3: Hallucination prevention requirements
- docs/PLANNING.md: Catalog size justification (no RAG needed)

### Type Safety
- All functions properly typed
- Interfaces fully documented
- Optional chaining used safely

### Error Handling
- Graceful degradation on Gemini failure
- Bounded retry (no infinite loops)
- Human escalation for edge cases

### Performance
- Set-based lookups O(1) for price validation
- Single regex pass for amount extraction
- Minimal computational overhead

---

## What Was NOT Changed

✅ Core 7 rules remain intact (8 and 9 are additions, not replacements)
✅ State machine flow unchanged
✅ Multilingual support unchanged
✅ Fallback logic unchanged
✅ SKU/photo validation unchanged
✅ Response schema unchanged

The updates are **additive and defensive** — they add safety layers without breaking existing functionality.

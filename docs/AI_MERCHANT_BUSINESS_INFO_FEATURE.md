# AI Merchant Business Information Feature

## Overview
This feature enables the AI agent to share merchant business information (website, phone number, store address, etc.) with customers when they ask about it. The information is pulled from the merchant settings that were provided during signup.

## Changes Made

### 1. **server/agent.ts**
Updated the AI agent to include and use merchant business information:

- **Modified `AgentPersona` interface** to include `merchantBusinessInfo` property:
  ```typescript
  merchantBusinessInfo?: {
    businessPhone?: string;
    website?: string;
    streetAddress?: string;
    city?: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  ```

- **Added business information formatting** in the `generateAgentReply` function to create a readable text block from the merchant business data.

- **Updated system instruction** to include a new "Merchant Business Information" section that:
  - Lists all available business contact details
  - Provides clear examples of when the AI should share this information
  - Instructs the AI on how to respond to customer inquiries about store location, contact details, website, etc.

### 2. **server/conversationEngine.ts**
Updated the conversation engine to pass merchant business information to the AI:

- Modified the `persona` object creation to include all business fields from the store:
  ```typescript
  merchantBusinessInfo: {
    businessPhone: store.businessPhone || undefined,
    website: store.website || undefined,
    streetAddress: store.streetAddress || undefined,
    city: store.city || undefined,
    province: store.province || undefined,
    postalCode: store.postalCode || undefined,
    country: store.country || undefined,
  }
  ```

### 3. **server/routes/conversations.ts**
Updated the chat API endpoint to include merchant business information:

- Modified the `persona` object in the `/api/chat` route to match the same structure as in conversationEngine.ts

## How It Works

1. **Merchant provides business information** during signup or in their profile settings (this was already implemented)

2. **Information is stored** in the `Store` table with fields:
   - `businessPhone`
   - `website`
   - `streetAddress`
   - `city`
   - `province`
   - `postalCode`
   - `country`

3. **AI receives the information** through the `AgentPersona` interface when generating replies

4. **AI shares the information** when customers ask questions like:
   - "What's your website?"
   - "Where is your shop located?"
   - "What's your address?"
   - "How can I contact you?"
   - "Do you have a physical store?"

## Example Conversations

**Customer:** "What's your website?"
**AI:** "Our website is www.example-store.com. Feel free to browse our online catalog!"

**Customer:** "Where is your shop located?"
**AI:** "We're located at 123 Main Street, Dhaka, Bangladesh. You can visit us during business hours!"

**Customer:** "How can I contact you?"
**AI:** "You can reach us at +880 1234-567890 or visit our website at www.example-store.com."

## Notes

- The AI will only share information that is available in the merchant's profile
- If certain fields are empty (e.g., no website provided), the AI won't mention them
- This information is automatically included in every AI conversation, so no additional setup is required
- The feature works across all channels (Facebook Messenger, WhatsApp, Instagram, Widget)

## Testing

To test this feature:
1. Ensure merchant business information is filled in the merchant profile/settings
2. Start a conversation as a customer
3. Ask questions about the store's website, location, or contact details
4. The AI should respond with the appropriate information from the merchant's profile

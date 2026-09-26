# Business Information Sharing Toggle Feature

## Overview
This feature allows merchants to control whether their AI assistant shares business contact information (phone, website, physical location) with customers. The merchant can view their business information in the AI Persona page and toggle sharing on or off.

## Features Implemented

### 1. Database Changes
- **New Field**: `shareBusinessInfo` (boolean) in the `Store` table
- **Default Value**: `true` (enabled by default for all stores)
- **Migration**: `20260926100000_add_share_business_info_toggle`

### 2. Backend Updates

#### Server Routes (`server/routes/persona.ts`)
- **GET `/api/persona`**: Now returns:
  - `shareBusinessInfo`: Current toggle state
  - `businessInfo`: Object containing all business contact details
    - `businessPhone`
    - `website`
    - `streetAddress`
    - `city`
    - `province`
    - `postalCode`
    - `country`

- **PUT `/api/persona`**: Accepts `shareBusinessInfo` in the request body to update the toggle

#### Input Validation (`server/inputValidation.ts`)
- Updated `ValidatedPersonaInput` type to include `shareBusinessInfo`
- Validation defaults to `true` if not provided

#### AI Agent Logic (`server/agent.ts`)
- **When `shareBusinessInfo = true`**:
  - AI includes all available business information in the system instruction
  - AI shares contact details when customers ask questions like:
    - "What's your website?"
    - "Where is your shop located?"
    - "How can I contact you?"
    - "Do you have a physical store?"

- **When `shareBusinessInfo = false`**:
  - AI does NOT share any business contact information
  - When customers ask about location/contact, AI responds with:
    - *"We operate entirely online to bring you the best selection of products directly to your doorstep. You can browse our catalog and place orders right here through this chat!"*

### 3. Frontend Updates

#### Types (`src/types.ts` & `src/lib/api.ts`)
- Updated `AIPersona` interface to include:
  - `shareBusinessInfo: boolean`
  - `businessInfo: { ... }` object with all contact fields

#### AI Persona Page (`src/components/AgentPersona.tsx`)
- **New Section**: "Business Information Sharing"
  - Toggle switch to enable/disable sharing
  - Visual display of merchant's business information:
    - Phone number (with phone icon)
    - Website (with globe icon)
    - Physical location/address (with map pin icon)
  - Shows message when no business info is available
  - Status indicator showing what the AI will do based on toggle state

- **Visual Feedback**:
  - Toggle is blue when enabled, gray when disabled
  - Success status (green) when enabled: Shows what info AI will share
  - Warning status (yellow) when disabled: Shows the generic online-only message

## User Experience

### Merchant View (AI Persona Page)
1. Merchant navigates to AI Persona page
2. Sees a new "Business Information Sharing" section
3. Views their current business information from their profile
4. Can toggle sharing on/off with a switch
5. Sees clear indication of what the AI will say based on toggle state
6. Clicks "Redeploy persona model" to save changes

### Customer Experience

#### When Sharing is ENABLED:
**Customer**: "Where is your shop located?"  
**AI**: "We're located at 123 Main Street, Dhaka, Bangladesh. You can visit us during business hours!"

**Customer**: "What's your website?"  
**AI**: "Our website is www.example-store.com. Feel free to browse our online catalog!"

**Customer**: "How can I contact you?"  
**AI**: "You can reach us at +880 1234-567890 or visit our website at www.example-store.com."

#### When Sharing is DISABLED:
**Customer**: "Where is your shop located?"  
**AI**: "We operate entirely online to bring you the best selection of products directly to your doorstep. You can browse our catalog and place orders right here through this chat!"

**Customer**: "What's your physical address?"  
**AI**: "We operate entirely online to bring you the best selection of products directly to your doorstep. You can browse our catalog and place orders right here through this chat!"

## Technical Implementation

### Files Modified
1. **Database Schema**:
   - `prisma/schema.prisma`
   - `prisma/migrations/20260926100000_add_share_business_info_toggle/migration.sql`

2. **Backend**:
   - `server/routes/persona.ts`
   - `server/inputValidation.ts`
   - `server/agent.ts`
   - `server/conversationEngine.ts`
   - `server/routes/conversations.ts`

3. **Frontend**:
   - `src/types.ts`
   - `src/lib/api.ts`
   - `src/components/AgentPersona.tsx`

### Data Flow
1. Merchant business info is stored in `Store` table (from signup/profile settings)
2. `shareBusinessInfo` toggle state is stored in `Store` table
3. Backend fetches both when loading persona
4. Frontend displays business info and toggle in AI Persona page
5. When saved, toggle state updates `Store.shareBusinessInfo`
6. AI agent reads `shareBusinessInfo` and conditionally includes business info in system prompt
7. AI responds to customer inquiries based on toggle state

## Testing

### Manual Testing Steps
1. **Setup**: Ensure merchant has business information in their profile
2. **Enable Sharing**:
   - Go to AI Persona page
   - Verify business info is displayed
   - Ensure toggle is ON (blue)
   - Save persona
   - Test as customer: Ask "Where is your shop?"
   - Verify AI shares the actual address

3. **Disable Sharing**:
   - Go to AI Persona page
   - Turn toggle OFF (gray)
   - Save persona
   - Test as customer: Ask "Where is your shop?"
   - Verify AI responds with "We operate entirely online..." message

4. **No Business Info**:
   - Clear business info in profile
   - Go to AI Persona page
   - Verify message: "No business information available. Add your details in Settings → Profile."

## Benefits
- **Privacy Control**: Merchants can choose not to share physical location
- **Online-First Businesses**: Stores without physical locations can provide appropriate response
- **Flexibility**: Easy to enable/disable without changing profile information
- **Clear Communication**: Customers get consistent responses based on merchant's preference
- **Professional**: AI provides appropriate response whether sharing is enabled or disabled

## Future Enhancements
- Per-field granularity (share website but not phone, etc.)
- Custom message when sharing is disabled
- Analytics on how often customers ask for location/contact info
- Integration with business hours information

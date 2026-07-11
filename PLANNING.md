# ShopMate AI — Build Plan

From clickable demo to working product: an AI sales agent that merchants connect to Facebook Messenger, Instagram DM, WhatsApp, and a website chat widget. The agent answers customer questions from the merchant's product catalog, detects complaints, builds carts, and hands off to a human when needed.

This document is the master plan. It covers what exists today, the target architecture, data model, API design, channel integrations, the AI pipeline, and a phased roadmap with acceptance criteria per phase.

---

## 1. Where we are today

The repo is a high-fidelity **frontend demo with fake data**:

| Piece | Status |
|---|---|
| UI (landing, login, inbox, catalog, analytics, integrations, settings) | ✅ Built, polished, dark theme per `DESIGN.md` |
| Auth | ❌ Fake — `isAuthenticated` boolean + localStorage profile |
| Database | ❌ None — everything lives in React state / `mockData.ts` |
| AI chat | ⚠️ Half real — `/api/chat` calls Gemini with a JSON schema, falls back to keyword simulator |
| Channel integrations (Meta, WhatsApp) | ❌ Fake toggles, fake telemetry logs |
| Analytics | ❌ Hardcoded Recharts data |
| Website chat widget | ❌ Simulated as "websocket" conversations in mock data |

The demo is valuable as a **living spec**: every screen defines the feature set we now make real. The strategy is to keep the frontend largely intact and build the backend underneath it, swapping mock data for API calls screen by screen.

---

## 2. Product scope (v1)

**In scope:**
1. Merchant signup/login, one store per merchant.
2. Product catalog CRUD (name, SKU, price, inventory, images, description).
3. AI persona configuration (tone, style, custom instructions).
4. **Website chat widget** — embeddable `<script>` snippet, real-time over WebSocket. This is the first live channel because it needs no third-party approval.
5. **Facebook Messenger integration** via Meta Graph API webhooks (Instagram and WhatsApp follow the same adapter pattern; add after Messenger works).
6. Unified inbox: live conversations from all channels, AI autopilot toggle per conversation, human takeover, AI-drafted replies with approve/edit.
7. AI agent: catalog-grounded answers, complaint detection, cart building, product suggestions, multilingual (English / Bangla / Banglish).
8. Order capture: agent collects name + address, creates an order record, merchant sees it.
9. Analytics computed from real data: conversation volume, AI automation rate, response time, orders/conversion.

**Out of scope for v1 (explicitly):** payments processing, Shopify/WooCommerce sync, multi-agent/team seats, voice, mobile apps, RAG over documents beyond the catalog.

---

## 3. Target architecture

```
                        ┌─────────────────────────────┐
  Customer channels     │         Backend (API)        │        Merchant
┌──────────────┐        │                              │     ┌────────────┐
│ FB Messenger ├─webhook┤  Channel Adapters            │     │  React     │
│ Instagram DM ├─webhook┤   (normalize → Message)      │◄────┤  Dashboard │
│ WhatsApp     ├─webhook┤                              │ REST│  (this repo)│
└──────────────┘        │  Conversation Service        │  +  └────────────┘
┌──────────────┐        │   (threads, status, takeover)│  WS
│ Web widget   ├──WS────┤                              │
└──────────────┘        │  AI Agent Service            │
                        │   (prompt build → Gemini →   │
                        │    structured actions)       │
                        │                              │
                        │  Catalog / Orders / Auth     │
                        └───────┬──────────┬───────────┘
                                │          │
                          PostgreSQL     Redis
                          (source of    (pub/sub for live
                           truth)        inbox, queues)
```

### Key decisions

| Decision | Choice | Why |
|---|---|---|
| Backend language | **Node.js + TypeScript** (Express or Fastify) | Shares types with the frontend; `server.ts` already started this way; Meta SDKs are JS-first |
| Database | **PostgreSQL + Prisma** | Relational fits merchants→products→conversations→messages cleanly; Prisma gives typed queries and migrations |
| Real-time | **WebSocket (socket.io)** + Redis pub/sub | Inbox must update live when webhooks arrive; widget needs a persistent connection anyway |
| AI | **Gemini** (`@google/genai`, already a dependency) with structured output schema | The response schema in `server.ts` (replyText / isComplaint / cartAction / suggestedProductsSKUs) is the right shape — keep it |
| Auth | **JWT (access + refresh) with bcrypt** | Simple, stateless, standard for a capstone; upgrade path to OAuth later |
| Monorepo layout | `apps/web` (this UI), `apps/server`, `apps/widget`, `packages/shared` (types) | The `Tab`/`Product`/`Conversation` types in `src/types.ts` become the shared contract |
| Deployment | Frontend on Vercel/Netlify; API + Postgres + Redis on Railway/Render; or a single VPS with Docker Compose | Cheap, demoable, HTTPS out of the box (Meta webhooks **require** HTTPS) |

---

## 4. Data model

```prisma
model Merchant {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String
  avatarUrl     String?
  store         Store?
  createdAt     DateTime @default(now())
}

model Store {
  id           String        @id @default(cuid())
  merchantId   String        @unique
  name         String
  persona      Json          // { tone, style, customInstructions }
  widgetKey    String        @unique  // public key embedded in the widget snippet
  products     Product[]
  channels     Channel[]
  conversations Conversation[]
  orders       Order[]
}

model Product {
  id          String  @id @default(cuid())
  storeId     String
  name        String
  sku         String
  price       Decimal
  inventory   Int
  description String?
  imageUrl    String?
  status      ProductStatus @default(PENDING) // PENDING | TRAINED
  @@unique([storeId, sku])
}

model Channel {
  id          String      @id @default(cuid())
  storeId     String
  type        ChannelType // FACEBOOK | INSTAGRAM | WHATSAPP | WIDGET
  connected   Boolean     @default(false)
  credentials Json?       // encrypted page token, phone number ID, etc.
  externalId  String?     // FB page ID / WA phone number ID
}

model Conversation {
  id            String   @id @default(cuid())
  storeId       String
  channelType   ChannelType
  externalUserId String? // PSID / WA number / widget session id
  customerName  String?  // filled once the customer reveals it
  status        ConvStatus @default(AI_MANAGED) // AI_MANAGED | ACTIVE (human) | CLOSED
  isComplaint   Boolean  @default(false)
  cart          Json?    // [{ sku, quantity }]
  messages      Message[]
  lastMessageAt DateTime
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  sender         Sender   // CUSTOMER | AI | MERCHANT
  text           String
  meta           Json?    // suggested SKUs, cart action, latency, model used
  createdAt      DateTime @default(now())
}

model Order {
  id             String   @id @default(cuid())
  storeId        String
  conversationId String?
  items          Json     // [{ sku, name, price, quantity }]
  customerName   String
  address        String
  status         OrderStatus @default(PENDING)
  total          Decimal
  createdAt      DateTime @default(now())
}
```

Analytics are **derived**, not stored: SQL aggregates over `Message`/`Conversation`/`Order` (with a materialized daily rollup later if needed).

---

## 5. API surface

### REST (merchant dashboard)
```
POST   /api/auth/signup            → create merchant + store
POST   /api/auth/login             → JWT pair
POST   /api/auth/refresh
GET    /api/me                     → profile + store
PATCH  /api/me                     → update profile (replaces localStorage hack)

GET    /api/products               CRUD, replaces INITIAL_PRODUCTS
POST   /api/products
PATCH  /api/products/:id
DELETE /api/products/:id

GET    /api/persona                → replaces DEFAULT_AI_PERSONA
PUT    /api/persona

GET    /api/conversations?filter=… → replaces INITIAL_CONVERSATIONS (paginated)
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages     → merchant sends manual reply
PATCH  /api/conversations/:id               → status toggle (AI/manual/closed)

GET    /api/channels               → replaces INITIAL_INTEGRATIONS
POST   /api/channels/:type/connect  → starts Meta OAuth flow
DELETE /api/channels/:type

GET    /api/orders
PATCH  /api/orders/:id             → mark fulfilled/cancelled

GET    /api/analytics?range=30d    → replaces RECHART_DATA_* + RECENT_ACTIVITIES
```

### Webhooks (channels → us)
```
GET  /webhooks/meta        → verification challenge (hub.challenge echo)
POST /webhooks/meta        → Messenger/IG/WhatsApp events (verify X-Hub-Signature-256)
```

### WebSocket namespaces
```
/merchant   auth: JWT      → rooms per storeId; events: message:new, conversation:updated
/widget     auth: widgetKey → rooms per conversation; events: message, typing, agent:reply
```

---

## 6. The AI agent pipeline

The existing `/api/chat` handler in `server.ts` is the prototype; it becomes a proper service:

```
incoming Message
  → load Conversation (last N=20 messages), Store persona, Product catalog
  → build prompt   (system: persona + directives + catalog table)
  → Gemini generateContent with responseSchema:
      { replyText, isComplaint, cartAction{action,sku}, suggestedProductsSKUs[] }
  → validate output (SKU exists? inventory > 0? JSON parses?)
  → apply side effects:
      isComplaint      → flag conversation, notify merchant (WS event)
      cartAction=add   → upsert cart on conversation
      order intent + name/address collected → create Order
  → persist AI Message → deliver via channel adapter (Meta Send API / widget WS)
```

Rules carried over from the demo, now enforced in code (not just prompt):
- **Never sell out-of-stock**: validate `cartAction.sku` inventory server-side; if 0, override with an apology + in-stock alternative.
- **Human takeover**: if `Conversation.status != AI_MANAGED`, the pipeline stops at persistence — no AI call.
- **Fallback**: if Gemini errors/times out (set a 10s timeout), keep the keyword simulator as graceful degradation, and log it (`meta.model = 'fallback'`) so analytics can report AI health honestly.
- **Complaint escalation**: complaint auto-switches the conversation to human mode after the AI's first apology message — this is the demo's "Complaint Isolation Override" made real.
- Fix the model name: verify the current Gemini flash model ID against the docs at build time (`gemini-3.5-flash` in the demo may not resolve; a wrong ID silently degrades everything to the simulator).

**Evaluation (capstone-worthy):** build a test set of ~50 customer messages (mixed English/Bangla/Banglish: price queries, stock checks, complaints, buy intents, chit-chat) with expected structured outputs. Script runs them through the pipeline and scores intent accuracy, SKU accuracy, complaint precision/recall. This is your quantitative results section.

---

## 7. Channel adapters

One interface, N implementations:

```ts
interface ChannelAdapter {
  verifyWebhook(req): boolean;                  // signature check
  parseIncoming(payload): NormalizedMessage[];  // → { externalUserId, text, channelType }
  sendMessage(externalUserId, text): Promise<void>;
}
```

**Widget (build first — no external approvals):**
- `apps/widget`: a tiny Preact/vanilla bundle (<50 KB) merchants embed via `<script src=".../widget.js" data-key="WIDGET_KEY">`.
- Floating chat bubble → panel; connects to `/widget` WS namespace; anonymous session ID in localStorage; conversation shows in merchant inbox as channel `WIDGET`.

**Facebook Messenger:**
1. Meta developer app → add Messenger product → connect a test Page.
2. Webhook subscription to `messages`, `messaging_postbacks`; verify token handshake; HTTPS required (use the deployed API or an ngrok/cloudflared tunnel in dev).
3. Send via Graph API `POST /me/messages` with the page access token.
4. Store page token encrypted (AES-256-GCM with a server-side key) in `Channel.credentials`.
5. **Caveat for the demo/defense:** unreviewed Meta apps only message app testers/developers — fine for a capstone demo; App Review is a post-course concern. Document this limitation.

**Instagram DM / WhatsApp Cloud API:** same webhook endpoint, same adapter interface, different payload parsing and send endpoints. Stretch goals after Messenger is stable.

---

## 8. Frontend migration (screen by screen)

Keep the UI; replace its data source. Introduce **TanStack Query** for server state + a small `api.ts` client with the JWT interceptor.

| Screen | Change |
|---|---|
| Login/Signup | Call `/api/auth/*`, store tokens, real validation errors |
| App shell | Replace `isAuthenticated` state with token presence + `/api/me`; keep the custom-event navigation or migrate to React Router (recommended: Router, small effort, gives URLs/deep links) |
| ProductCatalog | CRUD against `/api/products`; add image upload (S3-compatible bucket or local disk for v1) |
| InboxConsole | `GET /api/conversations` + WS subscription; "Send Now / Edit Reply" buttons drive real message dispatch; telemetry panel shows **real** pipeline events streamed over WS instead of the fake log strings |
| IntegrationsHub | Real connect/disconnect against `/api/channels`; Meta OAuth popup flow |
| Analytics | `/api/analytics` feeds the existing Recharts components — chart code barely changes |
| Settings | `/api/me` PATCH; password change with current-password check |

---

## 9. Security checklist

- bcrypt (cost ≥ 12) for passwords; JWT access 15 min / refresh 7 d, refresh rotation.
- All merchant routes scoped by `storeId` from the token — never from the request body (IDOR is the #1 capstone-project vuln).
- Meta webhook: verify `X-Hub-Signature-256` HMAC before parsing.
- Widget: rate-limit per session (e.g., 10 msg/min) — every widget message costs a Gemini call; this is your abuse surface.
- Encrypt channel credentials at rest; `GEMINI_API_KEY` and JWT secrets only in env, never in the client bundle.
- Prompt-injection containment: catalog and customer text go into the prompt — the structured output schema + server-side SKU/inventory validation is the mitigation (the model can't invent a discount or a product that passes validation). State this in the report.
- Zod validation on every request body.

---

## 10. Phased roadmap

Each phase ends demoable. Estimates assume 2–3 people part-time (capstone pace).

### Phase 0 — Foundation (Week 1–2)
Monorepo restructure (`apps/web`, `apps/server`, `packages/shared`); Postgres + Prisma schema + migrations; Docker Compose for local dev (postgres, redis); CI running `tsc` + tests.
**Done when:** `docker compose up` gives a running API with a seeded DB; existing UI still runs.

### Phase 1 — Auth + Catalog + Persona (Week 3–4)
Signup/login/JWT; product CRUD; persona endpoint; frontend login/catalog/settings wired to real API.
**Done when:** two different merchant accounts see only their own products.

### Phase 2 — AI agent core + Widget channel (Week 5–7) ← the heart
Port `/api/chat` into the agent pipeline (§6) with persistence and validation; build the embeddable widget; WS live inbox; human takeover; AI-draft approve/edit flow.
**Done when:** a customer on a test HTML page chats with the widget, the AI answers from the real catalog, the merchant watches it live in the inbox, flips to manual, and replies by hand.

### Phase 3 — Orders + Complaints (Week 8–9)
Cart accumulation from `cartAction`; name/address collection flow; Order records + orders view; complaint flag → auto-handoff + merchant notification.
**Done when:** an end-to-end purchase conversation produces an order row the merchant can mark fulfilled.

### Phase 4 — Facebook Messenger (Week 10–11)
Meta app, webhook verification, Messenger adapter, page-connect flow in IntegrationsHub.
**Done when:** a message sent to the test Facebook Page appears in the inbox and gets an AI reply on Messenger.

### Phase 5 — Analytics + Evaluation + Hardening (Week 12–13)
Real analytics queries feeding the dashboard; the 50-case AI evaluation harness (§6) with results; rate limiting; error states; loading skeletons.
**Done when:** analytics reflect the actual demo traffic and the eval report has numbers.

### Phase 6 — Deploy + Report (Week 14)
Production deploy (HTTPS, env secrets, seed demo store); demo script rehearsed; final report with architecture diagrams and eval results.

**Stretch (post-v1):** Instagram + WhatsApp adapters, Shopify catalog sync, image understanding in chat (Gemini is multimodal), daily-rollup analytics, team seats.

---

## 11. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Meta app review / API friction | Messenger demo blocked | Widget channel first (zero approvals); test-user mode is enough for the defense |
| Gemini quota/cost/model-name drift | Agent silently degrades | Keep the simulator fallback + log which path answered; verify model ID early; free-tier quota is fine for demo volume |
| WebSocket complexity | Inbox flaky in demo | socket.io with polling fallback; demo script uses the happy path; server restarts must not lose messages (they're in Postgres) |
| Scope creep (5 channels, payments…) | Nothing finishes | v1 scope in §2 is the contract; stretch items only after Phase 5 |
| Bangla/Banglish quality | Weak differentiator | Include Bangla cases in the eval set from Phase 2 onward, not as an afterthought |

---

## 12. First concrete steps (this week)

1. Restructure into the monorepo layout; move `src/types.ts` → `packages/shared`.
2. Write the Prisma schema (§4), stand up Postgres via Docker Compose, seed it from `mockData.ts` (the mock data becomes the seed script — nothing wasted).
3. Verify the correct current Gemini model ID and fix `server.ts`.
4. Scaffold `/api/auth` + `/api/products` and wire the catalog screen to them.

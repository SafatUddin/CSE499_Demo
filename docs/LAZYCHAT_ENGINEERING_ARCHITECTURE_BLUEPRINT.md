LazyChat — Engineering & Architecture Blueprint 

## **LAZYCHAT** 

## **Engineering & System Architecture Blueprint** 

_How LazyChat Works, and How to Build It End-to-End_ 

Prepared as a Principal Software Architect / AI Engineering technical guide for the build team Source basis: public product surface, documentation, and case studies at lazychat.io / platform.lazychat.io Version 1.0 — July 2026 



## **0. How This Report Was Built** 

This document was produced by crawling and reading the public marketing site (lazychat.io), the public documentation portal (platform.lazychat.io — Getting Started, Integration guides for Facebook, Instagram, WhatsApp, Meta Business Suite, Shopify, WooCommerce), and the pricing/FAQ section. It reverse-engineers the observable product behavior, integration flows, and stated capabilities into a concrete, buildable system architecture. 

Anything not directly stated on the site (internal service names, exact model choices, database schemas, infra topology) is an informed engineering design proposal — clearly written in the voice of a Principal Architect making build decisions — not a claim about LazyChat's actual internal implementation. Treat Sections 1-2 as "ground truth from the website" and Sections 3 onward as "the blueprint we would build to replicate/extend this product." 

## **1. Product Overview — What LazyChat Is** 

LazyChat positions itself as an "AI Sales Agent for Facebook, Instagram & WhatsApp" — an AI-powered customer support and sales automation layer that sits on top of a merchant's messaging channels, e-commerce store, and website. The core promise is simple: never miss a customer message, reply instantly in the customer's own language, and convert that reply into a completed order — 24/7, without a human agent. 

## **1.1 The Problem It Solves** 

- Lost customers — buyers purchase from competitors who reply faster. 

- Missed opportunities — inboxes fill with unread messages across multiple channels. 

- Repetitive load — support staff spend hours answering the same FAQs (price, stock, delivery, size/color). 

## **1.2 Core Value Proposition** 

- Increased sales — AI attends to queries 24/7 and pushes conversations toward checkout. 

- Instant replies — every channel answered immediately and organized centrally. 

- Increased productivity — staff time is freed from repetitive Tier-1 conversations. 

## **1.3 Headline Feature Set (as advertised)** 

|**Feature**|**What it does**|
|---|---|
|Image Recognition|Detects a product photo sent by a customer and replies with the<br>matching item, price, and available options — marketed as a<br>differentiator versus other chat-automation tools.|
|Multi-lingual replies|Responds naturally in the language the customer uses, explicitly<br>including Bangla, English, and "Banglish" (romanized/code-mixed<br>Bangla).|
|Complaint handling|Detects dissatisfaction/problem reports in a conversation and<br>automatically routes that chat into a dedicated "Complaint" queue<br>for fast human follow-up.|
|All-in-one inbox|Aggregates Facebook, Instagram, WhatsApp, and website chat<br>into a single dashboard with labels and filters.|
|Comment automation|Automatically replies to and moderates comments on<br>Facebook/Instagram posts and ads.|
|Built-in order cart|Lets the AI build a cart and generate an order directly inside the<br>chat flow.|
|Product suggestion / suggestive<br>AI|Recommends related or alternative products during the<br>conversation.|
|Out-of-stock handling|Recognizes stock status and redirects the customer instead of<br>confirming an unavailable order.|
|Order tracking dashboard|A merchant-facing view of customer orders and shipment/delivery<br>status.|
|Mobile apps|iOS and Android apps for managing chats, orders, and analytics<br>on the go.|



## **1.4 Integrations (confirmed via documentation)** 

- Facebook Page (Messenger + comments) — via Facebook Login for Business / Page Access. 

- Instagram (DMs + comments) — via the connected Facebook Page's Instagram professional account. 

- WhatsApp Business (Cloud API) — full Meta embedded-signup / WABA onboarding flow. 

- Meta Business Suite — for business verification, WABA management, and permissions. 

- Shopify — official app-store listing that installs a store extension and syncs the product catalog. 

- WooCommerce — plugin-based storefront integration. 

- Website widget — a one-click embed that pulls product/pricing data into LazyChat. 

## **1.5 Business Model** 

LazyChat is sold as a metered SaaS subscription. Plans (Basic/Pro/Elite/Enterprise) differentiate primarily on the number of AI-generated messages included per month (e.g., 18,000 vs 40,000 vs custom), number of seats, and access to Suggestive AI, comment automation, image-supported replies, multilingual support, and the omnichannel inbox. Overage is sold in metered packs (e.g., 1,000 extra AI messages for a flat add-on fee). Only AI-generated replies (direct + suggestive) and automated comment replies count against quota — human-agent replies inside the same inbox do not. This is a critical monetization/metering detail: the product must count AI-attributed messages, not all messages. 



Stated data-handling posture: customer data is stored in isolated AWS S3 buckets per tenant, and the platform claims compliance with Facebook, Instagram, and WhatsApp data-handling policies — a strong signal that the production system is built on AWS and treats per-merchant data isolation as a first-class architectural requirement, not an afterthought. 

## **2. How LazyChat Works — Functional Walkthrough** 

Before designing the system, we reconstruct the end-to-end user journey exactly as the product exposes it. This is the functional spec the architecture must satisfy. 

## **2.1 Merchant Onboarding Flow** 

1. Merchant lands on lazychat.io, enters name / business email / mobile number, accepts the privacy policy. 

2. Enters full customer/business information (name, email, phone) and accepts Terms of Service. 

3. Selects a billing term and a package (Basic / Pro / Elite / Enterprise). 

4. Completes payment through the checkout (payment gateway integration — SSLCommerz is referenced in the footer for the Bangladesh market, implying a local + international payment gateway split). 

5. System issues an invoice ID and displays a payment-success screen. 

6. An automated email is sent containing package name, invoice ID, amount paid, login email, a temporary password, and a direct login link — i.e., account provisioning is asynchronous and email-driven, not instant in-browser. 

7. Merchant logs in with the temp credentials and is forced (implied) to set a permanent password. 

## **2.2 Channel Connection Flow** 

All channel connections are OAuth/permission-grant flows initiated from an "Integrations" screen inside the dashboard: 

## **Facebook** 

- Merchant clicks Connect with Page Access → Facebook OAuth popup → merchant selects the Page(s) LazyChat may access → reviews the requested permission scopes → Save. 

- LazyChat receives a Page Access Token and immediately begins syncing posts, moderating comments, and auto-replying to Messenger conversations. 

## **Instagram** 

- Connected through the same Facebook Business login, since Instagram messaging/comments API access is always brokered through a linked Facebook Page. 

## **WhatsApp Business (Cloud API)** 

- This is the most complex flow and follows Meta's official Embedded Signup for WhatsApp Business Platform: business portfolio creation → business info → choice of "connect existing WhatsApp Business App number" vs "new number" → data-sharing consent → phone number entry with country code → QR-code linking from the 

- WhatsApp Business mobile app (for number migration) → naming/timezone confirmation → final permission grant (manage WhatsApp accounts, manage/access conversations, log events to Meta on the business's behalf) → completion screen with an optional "Add payment method" (for Meta's conversation-based pricing) step. 

- Documented prerequisites before this flow can even start: an active Meta Business Manager with admin rights, business verification status = Verified (not pending/rejected) with a green account-quality signal, WhatsApp Business Terms already accepted, an existing valid WABA, an OTP-reachable phone number, exact legal-name match with verification documents, a pre-approved display name, and a clean policy/eligibility history (WhatsApp explicitly disallows commerce automation for restricted verticals — adult content, alcohol/tobacco, weapons, gambling, crypto/financial-scam-adjacent goods, etc.). 

- Meta may take up to 24 hours to review the business for Commerce Policy compliance after connection. 

## **Shopify** 

- Merchant clicks Connect → redirected to the Shopify App Store listing for the LazyChat app → Install → reviews requested Shopify scopes (view customer data, view staff/contributor data, view and edit store data) → authenticates back into their LazyChat account (or creates one) → selects which LazyChat "shop" entity to bind the Shopify store to → triggers Sync products now → dashboard shows connection status, store name, LazyChat shop ID, and last-synced timestamp. 

## **WooCommerce** 

- Plugin-based equivalent of the Shopify flow for self-hosted WordPress/WooCommerce stores. 

## **2.3 Runtime Conversation Flow (the core AI loop)** 

Reconstructing from the feature list and case-study language, a single inbound customer message goes through this pipeline: 

8. A message (text, image, or comment) arrives on Facebook Messenger, Instagram DM, WhatsApp, or the website widget. 

9. The originating platform pushes the event to LazyChat via a webhook (Meta's Graph API webhook for FB/IG/WA; a JS SDK event for the website widget). 

10. LazyChat normalizes the message into a channel-agnostic conversation object and appends it to a unified thread in the All-in-One Inbox. 

11. If the message contains an image, an image-understanding step attempts to match it against the merchant's synced product catalog (Shopify/WooCommerce/website) and resolves a candidate SKU, price, and variants. 

12. A language-detection step determines whether the customer is writing in Bangla, English, or Banglish, so the reply is generated in the same register. 

13. An intent/sentiment classifier decides the conversation category: general FAQ, product inquiry, order intent, or complaint. Complaint-flagged threads are automatically labeled and routed to a Complaint view for human follow-up instead of (or in addition to) an AI auto-reply. 

14. For product/sales intents, the AI grounds its answer in the merchant's live catalog (price, stock, variants) rather than free-generating — this is what allows accurate price/stock answers and "suggestive AI" cross-sell prompts, and what allows correct out-of-stock redirection. 

15. If the customer confirms intent to buy, the AI builds a cart in-chat and creates an order record, which then appears in the merchant's order-tracking dashboard. 

16. The generated reply is sent back through the same channel's send-message API, and the message is logged and counted against the merchant's monthly AI-message quota. 

17. The same pipeline (minus cart/order steps) runs for public comments on Facebook/Instagram posts and ads, enabling automated comment replies and moderation. 

## **2.4 Merchant-Facing Surfaces** 

- Web dashboard: inbox, integrations, order tracking, analytics/case-study-style metrics (AI automation rate, average response time, order uplift), billing. 

- Mobile apps (iOS/Android): chat management, order tracking, analytics on the go. 

- AI Instruction / training surface: a merchant-facing configuration screen where the business describes itself, its tone of voice, and its catalog so the AI "learns" and starts replying like a sales rep — this is effectively a per-tenant prompt/knowledge-base configuration UI. 

## **3. Architecture Blueprint — Guiding Principles** 

Everything past this point is the build plan I would hand to the engineering team. Five principles govern every decision below: 

18. Multi-tenant from day one. Every table, queue message, cache key, vector namespace, and S3 prefix is scoped by tenant_id. There is no "add multi-tenancy later" — retrofitting isolation into a messaging/commerce system that stores customer PII is a rewrite, not a migration. 

19. Channel adapters, not channel-coupling. Facebook, Instagram, WhatsApp, and the website widget are pluggable adapters behind one internal Unified Message contract. The core conversation, AI, and commerce engines never see "Messenger" or "WhatsApp" — they see a normalized event. 

20. Catalog-grounded AI, not open generation. Price/stock/variant answers must be retrieved from the merchant's live catalog (RAG-style grounding), never hallucinated from the LLM's parametric memory. This is the single most important reliability requirement for a commerce bot. 

21. Webhooks are bursty and untrusted by default. Meta webhooks, Shopify webhooks, and WhatsApp delivery callbacks must be verified, deduplicated, and queued — the API layer's only job is "authenticate, validate signature, enqueue, return 200 fast." All real work happens asynchronously. 

22. Everything that touches AI generation is metered, logged, and rate-limited per tenant, because it is directly tied to billing (message quota) and to third-party platform rate limits (Meta Graph API, WhatsApp Cloud API tiers). 


## **4. High-Level System Architecture** 

## **4.1 Logical Diagram (described)** 

Since this is a written report, the diagram is expressed as layered flow — recreate it as an actual architecture diagram (e.g., in Lucidchart/draw.io) before sprint 1 kicks off: 

- Layer 1 — Edge / Channel Adapters: Meta Webhook Receiver (FB Messenger + IG DM + Comments), WhatsApp Cloud API Receiver, Website Chat Widget (WebSocket/REST), Shopify/WooCommerce Webhook Receiver, Payment Gateway Webhook Receiver (SSLCommerz + Stripe/PayPal for global). 

- Layer 2 — Ingestion Gateway: API Gateway (Kong/AWS API Gateway) → signature verification, auth, request shaping → publishes normalized events onto a message bus (Kafka/AWS SNS+SQS). 

- Layer 3 — Core Services (event-driven microservices): Conversation Service, Contact/CRM Service, AI Orchestration Service, Catalog/Inventory Service, Order & Cart Service, Comment Automation Service, Complaint/Ticketing Service, Notification Service, Billing & Metering Service, Analytics Service. 

- Layer 4 — AI Subsystem: LLM Gateway (multi-provider), NLU/Intent & Language Detection, Image Recognition Service, Retrieval-Augmented Generation Engine (Vector DB + Catalog Index), Prompt/Knowledge-Base Management, Guardrails & Safety Filter. 

- Layer 5 — Data Plane: Postgres (transactional), Redis (cache/session), Vector DB (pgvector/Pinecone/Weaviate), Elasticsearch/OpenSearch (search + analytics), S3 (per-tenant isolated buckets for media/attachments/exports), Data Warehouse (Redshift/BigQuery) for analytics rollups. 

- Layer 6 — Delivery: Outbound Send Workers per channel, respecting each platform's rate limits and the 24-hour Meta messaging window / WhatsApp template rules. 

- Layer 7 — Experience: Merchant Web Dashboard (React/Next.js), Mobile Apps (React Native or native iOS/Android), Admin/Internal Ops Console. 

## **4.2 Why Event-Driven Microservices (and not a monolith)** 

A single inbound message can trigger many independent, variable-latency side effects: image classification, catalog lookup, LLM generation, order creation, quota decrement, analytics update, and possible human handoff. Coupling these synchronously in one request handler creates a fragile system where the slowest step (LLM inference) blocks message delivery and a single failure cascades. An event bus (Kafka topics per domain: messages.inbound, messages.outbound, orders.created, complaints.flagged, billing.usage) lets each concern scale, fail, and retry independently, and gives us a natural audit trail — critical for a product whose core metric is "never miss a message." 

## **5. Channel Integration Layer — Deep Dive** 

## **5.1 Meta (Facebook + Instagram) Adapter** 

- OAuth: Facebook Login for Business, requesting pages_messaging, pages_manage_metadata, pages_read_engagement, instagram_basic, instagram_manage_messages, instagram_manage_comments scopes. 

- Store long-lived Page Access Tokens encrypted at rest (KMS-envelope encryption), one row per (tenant_id, page_id), with a background job to refresh/validate tokens before Meta's expiry window. 

- Subscribe to the Page's webhook fields (messages, messaging_postbacks, feed for comments) at connection time via the Graph API /subscribed_apps call. 

- Webhook receiver validates the X-Hub-Signature-256 HMAC against the app secret before trusting any payload — this is non-negotiable; unverified webhook processing is the #1 way these integrations get exploited. 

- Respect Meta's messaging policy: standard replies are only allowed within the 24-hour customer-service window after the last user message, unless using a tagged message type or Sponsored Message; outbound worker must check window state before sending. 

## **5.2 WhatsApp Business Platform Adapter** 

- Implements Meta's Embedded Signup (WhatsApp Business Encryption + Facebook Login for Business) so merchants can self-serve exactly the flow documented on platform.lazychat.io (business portfolio → number → QR/OTP → permission grant). 

- Pre-flight eligibility checks are enforced in-product before allowing the flow to start: Business Manager admin access, Business Verification = Verified, WABA existence, and a policy/vertical allow-list check (block adult, alcohol/tobacco, weapons, gambling, crypto-adjacent categories at signup, matching WhatsApp Commerce Policy) — fail fast with a clear merchant-facing checklist rather than letting them hit a Meta rejection mid-flow. 

- Store the WABA ID, phone number ID, and system-user access token; register the phone number, and configure webhook subscription for message delivery/read receipts and inbound messages. 

- Enforce WhatsApp template-message rules for anything sent outside the 24-hour session window (utility/marketing/authentication templates must be pre-approved by Meta) — a Template Management module is required so merchants can submit and track template approval status. 

- Handle WhatsApp's conversation-based pricing model (Meta bills per conversation category) — surface this cost separately from LazyChat's own AI-message metering, since they are two independent billing dimensions. 

## **5.3 Website Chat Widget** 

- A lightweight embeddable JS snippet (<script src="widget.lazychat.io/embed.js" data-tenant="...">) rendering a chat bubble, connecting over WebSocket (Socket.io/native WS) with REST fallback for delivery guarantees. 

- Widget-originated conversations flow into the exact same Unified Message contract as FB/IG/WhatsApp, so the AI Orchestration Service is channel-blind. 

## **5.4 Commerce Platform Adapters (Shopify / WooCommerce / Custom Website)** 

- Shopify: OAuth app install (per the documented flow) requesting read_products, read_inventory, read_orders, write_orders (if LazyChat creates orders directly), read_customers scopes; register webhooks for products/update, inventory_levels/update, and orders/create so the catalog index stays fresh without polling. 

- WooCommerce: REST API key/secret pairing generated from the WordPress plugin, plus WooCommerce webhook topics for the same product/inventory/order events. 

- Custom websites (no Shopify/WooCommerce): a lightweight crawler/importer or manual CSV/API catalog upload, feeding the same Catalog Service ingestion pipeline — this is what the marketing copy means by "connect your website with one click… products, pricing and essentials will be updated." 

- All three converge on one canonical Product schema (SKU, title, description, price, currency, variant options, images, stock level, category) before anything reaches the AI layer. 

## **6. The AI Subsystem — Deep Dive** 

This is the differentiated core of the product. It has five cooperating capabilities: language understanding, image recognition, catalog-grounded generation, intent/complaint classification, and per-tenant customization ("AI Instruction"). We design it as a pipeline of composable services behind a single AI Orchestration Service, not one giant prompt. 

## **6.1 AI Orchestration Service** 

Receives a normalized inbound message event, runs the pipeline below, and emits an outbound-reply event (or a no-action/handoff event). It is stateless and horizontally scalable; all conversation state lives in the Conversation Service / Redis session store, not in the orchestrator's memory. 

23. Pre-process: strip attachments, detect message type (text/image/quick-reply/order-postback). 

24. Language ID: fastText / lightweight classifier to tag the message Bangla / English / Banglish (romanized Bangla is the hard case — this typically needs a fine-tuned classifier or a few-shot LLM call, since off-the-shelf language detectors misclassify transliterated text). 

25. Image branch (if attachment present): send to the Image Recognition Service (Section 6.3); merge the resolved product back into the context. 

26. Intent & sentiment classification: FAQ / product-inquiry / order-intent / complaint / other, plus a sentiment score. Complaint-labeled threads short-circuit into the Complaint/Ticketing Service and are tagged in the inbox. 

27. Retrieval: pull the top-k relevant catalog items and merchant knowledge-base snippets (policies, FAQs, delivery info) from the Vector DB, scoped strictly to tenant_id. 

28. Generation: call the LLM Gateway with a structured prompt = system persona (from AI Instruction config) + retrieved context + conversation history window + the new message; request a structured JSON response (reply_text, suggested_products[], cart_action, confidence, escalate:boolean). 

29. Guardrail pass: validate the structured response — price/stock claims must match retrieved facts (reject/re-generate if the model states a price not present in retrieval context); profanity/safety filter; hallucination check for anything outside the grounded context. 

30. Action execution: if cart_action is present, call the Order & Cart Service; otherwise send reply_text to the Outbound Delivery Worker for the originating channel. 

31. Emit a billing.usage event (1 AI-attributed message) and an analytics event for the automation-rate / response-time dashboards. 

## **6.2 Multilingual Layer (Bangla / English / Banglish)** 

- Use a multilingual base LLM with strong Bangla and code-mixed performance rather than translating to English and back (translation round-trips lose product-name fidelity and produce unnatural replies). 

- Maintain a transliteration/normalization layer that maps common Banglish spelling variants of product terms and Bangla brand/number words to canonical catalog tokens, improving retrieval recall. 

- Keep a small human-curated "tone bank" per tenant (from the AI Instruction step) with example Q/A pairs in the merchant's actual voice, injected as few-shot examples — this is how "it learns your tone" is achieved in practice. 

## **6.3 Image Recognition Service** 

Marketed as "the only AI in the world that can recognize product images and reply with the exact item, price, and options" — architecturally this is a visual product-matching pipeline, not a general vision model alone: 

32. At catalog-sync time, generate and store a CLIP-style embedding (or a fine-tuned product-image encoder) for every product image in the merchant's catalog, indexed in the Vector DB alongside text embeddings, namespaced per tenant. 

33. At inference time, embed the customer's uploaded photo with the same encoder and run an approximate-nearest-neighbor search restricted to that tenant's product-image namespace. 

34. Apply a confidence threshold: high confidence → auto-resolve to the SKU and answer with price/options directly; medium confidence → ask a disambiguating follow-up ("Did you mean this one or this one?") with the top-3 candidates as quick replies; low confidence → escalate to human or a generic "can you tell us more" fallback. 

35. A general vision-LLM call (e.g., a multimodal model) is used as a fallback/enrichment step for attributes not captured by embeddings alone — color, visible damage in a complaint photo, etc. 

## **6.4 Complaint Detection & Routing** 

- A binary/multiclass classifier (fine-tuned small model, cheaper than a full LLM call on every message) flags negative sentiment, delivery/quality complaint language, and refund/replacement requests. 

- Flagged conversations are auto-labeled "Complaint," surfaced in a dedicated inbox view/filter, and optionally trigger a Notification Service alert (email/push/Slack integration) to the merchant's support team so nothing sits unresolved. 

## **6.5 Suggestive AI / Upsell Engine** 

- A lightweight recommendation layer (co-purchase / similar-product embeddings from the Catalog Service) that the generation step can call to attach suggested_products alongside the primary answer — this is what powers the "product-suggestion" feature shown in the case-study clips. 

## **6.6 LLM Gateway & Provider Strategy** 

- Abstract all model calls behind an internal LLM Gateway with a provider-agnostic interface (model, messages, tools, response_format), so the underlying model (e.g., a Claude or GPT-class model for generation, a smaller/cheaper model for classification tasks) can be swapped or A/B tested without touching business logic. 

- Tiered model strategy for cost control: cheap/fast model for language ID, intent classification, and complaint detection (high volume, low complexity); frontier model for the actual customer-facing generation (lower volume per conversation, quality-critical); a job-queue-friendly batch mode for nightly catalog-embedding refreshes. 

- Full request/response logging (redacted for PII) for every LLM call, both for guardrail auditing and for building the fine-tuning/eval dataset over time. 

## **7. Commerce Engine — Catalog, Cart, and Orders** 

## **7.1 Catalog Service** 

- Owns the canonical Product/Variant/Inventory schema and ingestion pipelines from Shopify, WooCommerce, custom-website import, and manual entry. 

- On every webhook (product update, inventory change, price change), re-index the affected product's text and image embeddings asynchronously — catalog freshness directly determines AI answer accuracy, so staleness here is a correctness bug, not a cosmetic one. 

- Exposes a fast read API (backed by Redis cache in front of Postgres/OpenSearch) for the AI Orchestration Service's retrieval step, since it sits on the hot path of every reply. 

## **7.2 Order & Cart Service** 

- Maintains an in-conversation cart state (Redis, keyed by conversation_id) that the AI can add/remove items from during a chat, then "checks out" into a durable Order record in Postgres. 

- Order creation triggers: (a) a write-back to Shopify/WooCommerce via their Orders API if the merchant wants orders to land in their store of record, and/or (b) a native LazyChat order used purely for the merchant's order-tracking dashboard for merchants without an e-commerce backend. 

- Order status changes (confirmed, shipped, delivered, cancelled) sync bidirectionally where the source system supports webhooks, and are surfaced back to the customer proactively where the channel and messaging window allow (e.g., a WhatsApp utility template: "Your order has shipped"). 

## **7.3 Human Handoff** 

- Any conversation can be manually or automatically (low-confidence AI, explicit complaint, explicit "talk to a human" request) flipped from AI-managed to human-managed. Once handed off, the AI Orchestration Service stops auto-replying on that thread until a human resolves or re-enables it — this state must be a first-class field on the conversation, not inferred. 

## **8. Data Architecture** 

## **8.1 Core Relational Schema (Postgres, simplified)** 

|**Table**|**Key Columns**|**Notes**|
|---|---|---|
|tenants|id, name, plan_id, status, region|Root of multi-tenancy; every other table<br>FKs here.|
|users|id, tenant_id, email, role,<br>password_hash|Dashboard/mobile app operators; RBAC<br>role field.|
|channels|id, tenant_id, type, external_id,<br>credentials_ref|One row per connected FB Page / IG<br>account / WABA / widget;<br>credentials_ref points to secrets<br>manager, never stored in plaintext.|
|contacts|id, tenant_id, channel_id,<br>external_user_id, name, locale|Unified customer identity per channel.|
|conversations|id, tenant_id, contact_id, status,<br>assigned_to, is_complaint,<br>ai_enabled|status: open/pending/resolved;<br>ai_enabled toggled on handoff.|
|messages|id, conversation_id, direction, type,<br>content, ai_generated, created_at|ai_generated boolean drives billing<br>metering.|
|products|id, tenant_id, source, external_id,<br>title, price, currency, stock|Canonical catalog row synced from<br>Shopify/WooCommerce/manual.|
|product_variants|id, product_id, sku, options_json,<br>price, stock|Size/color/etc.|
|orders|id, tenant_id, conversation_id,<br>contact_id, status, total, source|source: lazychat_native / shopify /<br>woocommerce.|
|order_items|id, order_id, variant_id, qty, unit_price||
|usage_events|id, tenant_id, type, quantity, period,<br>created_at|Feeds billing/metering (AI messages,<br>comment automations).|
|subscriptions|id, tenant_id, plan_id,<br>message_quota, status, renews_at|Billing state.|



## **8.2 Non-Relational / Specialized Stores** 

- Vector DB (pgvector, Pinecone, or Weaviate) — namespaced per tenant, storing text embeddings (products, FAQs, policies) and image embeddings (product photos) for RAG and visual search. 

- Redis — session/cart state, hot catalog cache, rate-limit counters, webhook idempotency keys. 

- Elasticsearch/OpenSearch — full-text conversation search inside the inbox UI, and pre-aggregated analytics (automation rate, response time, order uplift shown on the merchant dashboard and used in marketing case studies). 

- S3 — isolated bucket-per-tenant (or bucket + strict IAM-scoped prefix-per-tenant, whichever meets the compliance bar) for media attachments, exported reports, and invoice PDFs, matching the site's stated "isolated AWS S3 buckets" claim. 

- Data Warehouse (Redshift/BigQuery/ClickHouse) — nightly ETL from Postgres/usage_events for cross-tenant BI and for computing the case-study-style metrics (AI automation rate %, avg response time, order increase %) per merchant. 

## **8.3 Multi-Tenant Isolation Strategy** 

Recommend a hybrid model: shared Postgres cluster with tenant_id on every row plus row-level security policies as the default (cost-efficient, fast to build), with an option to move a given large/regulated tenant to a dedicated schema or dedicated database as they scale — this mirrors how the product's own pricing already implies tiered isolation guarantees (Enterprise = custom). S3 and the vector DB use hard namespace/bucket isolation from day one since media and embeddings are more sensitive and cheaper to isolate upfront than to retrofit. 

## **9. Metering, Billing & Plan Enforcement** 

Because pricing is consumption-based (messages/month) with seat and feature gates, metering must be treated as a core domain service, not an afterthought bolted onto Stripe. 

## **9.1 What Counts Against Quota** 

- AI-generated direct replies to customers — counted. 

- AI-generated suggestive/upsell replies — counted. 

- Automated comment replies — counted. 

- Human-agent manual replies inside the same inbox — NOT counted. 

- System/notification messages (order confirmations sent by template, not AI-authored) — NOT counted, unless explicitly stated otherwise by product. 

## **9.2 Metering Service Design** 

36. Every AI-authored outbound message emits a usage_events row (idempotent on message_id) at the moment it is actually sent (not when generated), avoiding double-billing on retries. 

37. A Billing Aggregator consumes usage_events in near-real-time (streaming aggregation) to maintain a live counter per tenant per billing period in Redis, checked before allowing further AI generation once the hard cap (if any) is reached. 

38. At quota threshold (e.g., 80%/100%), trigger merchant notifications and offer in-app purchase of overage packs (documented as 1,000 extra messages per fixed fee) without any service interruption. 

39. Nightly reconciliation job re-derives the authoritative count from usage_events/Postgres and corrects the Redis live counter, protecting against cache drift. 

40. Plan/feature gating (Suggestive AI, comment automation, image replies, seat count) is enforced centrally in a Feature Flag / Entitlement Service consulted by every domain service at request time, not hardcoded per-service. 

## **9.3 Payments** 

- Localized gateway split: SSLCommerz (and mobile banking rails like bKash/Nagad) for the Bangladesh market shown on the site, plus a global gateway (Stripe) for USD-denominated plans — both behind a Payment Adapter interface so checkout/billing logic is gateway-agnostic. 

## **10. Security, Privacy & Platform Compliance** 

## **10.1 Data Protection** 

- Encrypt all channel access tokens and API credentials at rest via a KMS-backed secrets manager (AWS Secrets Manager/HashiCorp Vault); never log raw tokens. 

- TLS everywhere in transit; S3 buckets private by default with signed URLs for any client-facing media access. 

- PII minimization in LLM prompts/logs — mask phone numbers/emails in logs retained beyond the debugging window; keep an explicit data-retention policy per data class (messages, media, order data). 

## **10.2 Platform Policy Compliance (the non-negotiable part)** 

- Meta Platform Terms & WhatsApp Business/Commerce Policy compliance is a product-blocking requirement, not a legal checkbox — build the vertical/eligibility allow-list, business-verification gate, and 24-hour messaging-window enforcement directly into the integration flow, exactly as the documentation implies. 

- Respect WhatsApp template-approval workflows; never attempt to send free-form messages outside the session window, since this results in API errors or account restrictions for the merchant. 

- Implement webhook de-duplication and replay protection (Meta and Shopify both retry webhooks); use idempotency keys derived from the platform's own event IDs. 

## **10.3 AI Safety / Guardrails** 

- Hard rule: the AI must never state a price, stock level, or promise (discount, delivery date) that is not backed by retrieved catalog/policy data for that exact tenant. 

- Rate-limit and content-filter customer-uploaded images before they reach any model (size/type validation, abuse-content scanning) given the product accepts arbitrary customer photo uploads at scale. 

- Maintain an escalation-on-uncertainty default: when confidence is low, ask a clarifying question or hand off — never guess on anything commerce- or complaint-related. 

## **11. Infrastructure & DevOps** 

## **11.1 Recommended Technology Stack** 

|**Layer**|**Recommended Stack**|**Rationale**|
|---|---|---|
|Cloud|AWS (matches site's own stated S3<br>usage)|EKS, RDS, ElastiCache, S3, SQS/SNS,<br>KMS, CloudFront.|
|Backend<br>services|Node.js/TypeScript (NestJS) or Go for<br>high-throughput adapters|TypeScript for developer velocity across a<br>large service surface; Go for the<br>webhook/ingestion hot path if profiling<br>shows Node is the bottleneck.|
|Message bus|Kafka (MSK) or SQS/SNS|Kafka if event replay/analytics fan-out is<br>heavy; SQS/SNS is a lighter-weight<br>starting point for an MVP.|
|Primary DB|PostgreSQL (RDS/Aurora)|Strong relational integrity for orders/billing;<br>row-level security for tenant isolation.|
|Cache/session|Redis (ElastiCache)|Cart state, quota counters, rate limiting.|
|Vector DB|pgvector (start) →<br>Pinecone/Weaviate (scale)|Start co-located with Postgres to reduce<br>ops surface; graduate when embedding<br>volume/QPS demands it.|
|Search/Analytic<br>s store|OpenSearch|Inbox search + pre-aggregated<br>dashboards.|
|AI/LLM|Multi-provider via internal Gateway<br>(Anthropic/OpenAI + smaller<br>fine-tuned classifiers)|Avoid single-vendor lock-in; tier models by<br>task cost/criticality.|
|Frontend<br>(dashboard)|Next.js + React + Tailwind|SSR for fast first paint of the inbox;<br>component-driven UI.|
|Mobile apps|React Native (shared logic with web)<br>or native Swift/Kotlin|React Native to move fast on 2-platform<br>parity with a small team.|
|IaC|Terraform|Reproducible multi-environment infra.|
|CI/CD|GitHub Actions + ArgoCD (GitOps)<br>on EKS|Automated test/build/deploy with<br>progressive rollout.|
|Observability|Datadog or Grafana/Prometheus +<br>Loki + Sentry|Metrics, logs, traces, and error tracking<br>across microservices.|



## **11.2 Deployment Topology** 

- Kubernetes (EKS) cluster per environment (dev/staging/prod), namespace-per-service, HPA (Horizontal Pod Autoscaler) tuned per service — the webhook receivers and outbound delivery workers need aggressive autoscaling since traffic is bursty and tied to ad campaigns/flash sales. 

- Blue/green or canary deploys for the AI Orchestration Service specifically, since prompt/model changes are the highest-risk deploys in the system (they change customer-facing behavior, not just infra). 

- Multi-AZ RDS with read replicas for the dashboard's read-heavy analytics queries, keeping the primary free for transactional writes (orders, messages). 

- Region strategy: primary region close to the initial market (ap-south-1 for Bangladesh/South Asia given the product's Bangla focus and BDT pricing), with CDN (CloudFront) for dashboard/static assets globally. 

## **11.3 Reliability & Rate-Limit Management** 

- Per-tenant, per-channel outbound rate limiters that respect Meta Graph API and WhatsApp Cloud API tier limits (messages/second, conversation/day caps) — a shared token-bucket in Redis per (tenant, channel) pair, with backpressure into the message queue rather than dropped sends. 

- Dead-letter queues for every consumer (webhook processing, AI generation, outbound delivery) with alerting, since a silently-failing message is a direct violation of the product's core "never miss a message" promise. 

- Circuit breakers around the LLM Gateway and all third-party APIs (Meta, Shopify, payment gateways) with graceful degradation — e.g., fall back to a templated "we'll get back to you shortly" auto-ack if the LLM provider is down, rather than silence. 

## **12. Merchant Dashboard & Mobile Apps** 

## **12.1 Core Dashboard Modules** 

- Unified Inbox — multi-channel conversation list with filters/labels (Complaint, Order Intent, Unread, Assigned to Me), search, and an AI-generated draft-reply preview that a human can edit before sending (recommended addition beyond pure autopilot, for merchant trust-building). 

- Integrations — connection cards per channel (Facebook, Instagram, WhatsApp, Shopify, WooCommerce, Website) showing status, connected identity, and disconnect controls, exactly matching the documented UI pattern. 

- Catalog — synced product list with manual override fields (in case the AI needs a correction the source store hasn't published yet). 

- Orders — order-tracking table with status pipeline and shipment info. 

- AI Instruction — the tenant's prompt/knowledge-base configuration screen: business description, tone examples, FAQ entries, and per-feature toggles (Suggestive AI, comment automation, image replies). 

- Analytics — AI automation rate, average response time, order-increase %, message-quota usage vs plan limit, per-channel breakdown (mirroring the exact metrics shown in the site's case studies). 

- Billing — plan, usage-to-date, overage purchase, invoices. 

- Team/Roles — seat management and RBAC (Owner, Admin, Agent, Read-only) matching the "up to N users" seat limits per plan. 

## **12.2 Mobile Apps** 

- Feature parity focus: inbox + push notifications for new messages/complaints, order tracking, and a lightweight analytics view — not full AI-configuration surface, which stays desktop-first. 

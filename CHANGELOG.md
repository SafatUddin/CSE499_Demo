# Changelog

Plain-language history of work on ShopMate AI, for humans (not git blame). See `CLAUDE.md` for current project state and `PLANNING.md` for the roadmap.

## 2026-08-14 — Rebrand to Remlin, Railway project renamed

- App rebranded from "ShopMate AI" to "Remlin" (new logo, sidebar/header text).
- Railway project/service renamed `shopmateAI` → `Remlin`, moving the public URL from `shopmateai-production.up.railway.app` to `remlin.up.railway.app`.
- Fixed a bug introduced by the rename: Railway's `APP_URL` env var ended up with a stray backslash (`remlin\.up.railway.app`), which made `new URL(APP_URL).origin` resolve to just `https://remlin` — silently breaking the CSRF origin check (`requireTrustedOrigin`) and would have broken Google OAuth's callback redirect too. Corrected via `railway variables --set`.
- Still needs manual updates in external dashboards (not something code/CLI can fix): Meta app's Messenger webhook Callback URL, Facebook Login's Valid OAuth Redirect URIs, App Domains, Privacy Policy URL; Google Cloud Console's Authorized redirect URIs/JS origins if Google sign-in is used; Shopify Partner Dashboard's redirect URI if a store is connected.

## 2026-07-30/31 — Customer-driven order confirmation (admin-independent)

- The AI can now finalize a real order entirely from the conversation, with no merchant click required: once a customer's cart and shipping address are both known, the AI presents a summary and asks them to confirm; an explicit "yes" auto-creates a real `Order` and clears the cart.
- Added a new AI Persona setting, "Order Auto-Finalization" (`Store.autoFinalizeOrdersAlways`): default "AI Managed Only" mirrors the existing Copilot autopilot/manual split (auto-finalize only fires in AI Managed conversations); switching it to "Always" lets the AI finalize confirmed orders even in Active/manually-reviewed conversations.
- Guardrails: a customer's "yes" only counts if the AI genuinely asked for confirmation first (tracked via `Conversation.orderConfirmationRequested`), and the backend independently re-checks that a cart and address actually exist before creating anything — never trusts the model's claim alone.
- Fixed a real bug hit while building this: the model was re-emitting a cart "add" for the same item on every subsequent turn (e.g. while giving the address, while confirming), silently inflating the order quantity. Fixed by explicitly telling the model what's already in the cart each turn, instead of leaving it to infer that from conversation history alone.
- Note: `Conversation.orderConfirmationRequested` / `orderConfirmed` / `orderSummaryShown` / `awaitingQuantityFor` were originally added directly against the shared DB from another machine (`d:\CSE499_Demo`), which is independently building overlapping order-confirmation logic there. This implementation uses those same DB fields but is a separate, not-yet-reconciled implementation — expect to need to merge the two once the other machine's code is pushed.

## 2026-07-29 — Shipping address auto-detection, and swapping Gemini for a self-hosted local model

- The AI now extracts a shipping address from the conversation (extending the same structured-output pattern already used for cart detection) and pre-fills it into the "Generate Order" address field — still editable/confirmable by the merchant, never auto-submitted.
- Replaced Google Gemini with a self-hosted Ollama model (`qwen2.5:3b`, chosen for decent Bangla/Banglish support) to remove any dependency on a paid third-party API. `server/gemini.ts` is gone; `server/ollama.ts` calls Ollama's `/api/chat` with a JSON schema `format` for the same structured replies Gemini used to produce.
- For production, the Node app on Railway (CPU-only, no GPU) reaches Ollama running on a local GPU machine over a Tailscale Funnel tunnel (a public HTTPS URL that proxies to `localhost:11434`) rather than running inference on Railway itself, since CPU inference was going to be far slower. This makes production AI replies dependent on that machine staying on and connected — a deliberate tradeoff to keep AI inference cost at $0 and fast, accepted for the capstone's beta-testing phase.
- Fixed two latency issues found while wiring this up: Ollama was unloading the model from VRAM after 5 minutes idle (a ~90s reload tax on the next message) — fixed with `keep_alive: -1` plus a warm-up call on server boot; and the conversation history sent to the model was unbounded and slowing down long conversations — capped to the last 10 messages.
- Also hit and fixed an Ollama-specific gotcha: it silently 403s any request whose `Host` header isn't `localhost`/`127.0.0.1` (anti-DNS-rebinding protection), which broke every request through the Funnel tunnel. Fixed by binding Ollama to `0.0.0.0` (`OLLAMA_HOST`) instead of trying to allow-list origins (`OLLAMA_ORIGINS` doesn't affect this check at all — a red herring in some online guides).

## 2026-07-25/26 — Self-serve Facebook connect, real names, notifications, and orders

- Built the real "Connect with Facebook" OAuth flow (Option B from the roadmap), replacing the manual "paste a token into `.env`" setup: OAuth popup → code exchange for a Page Access Token → a picker step if the merchant manages multiple Pages → auto-subscribe the webhook via the Graph API → the token stored encrypted (AES-256-GCM) in the database. The old manual-token connection still works as a fallback. Worked through several one-time Meta app configuration requirements along the way (App Domains, a real hosted Privacy Policy page, and the Facebook Login product's own "Valid OAuth Redirect URIs" setting, which is separate from the Messenger webhook's callback URL).
- Facebook conversations now show the customer's real name (fetched via the Graph API) instead of a generic "New Customer" placeholder — this needed an additional Meta app permission ("Business Asset User Profile Access") that wasn't granted before.
- Real notifications: the bell icon now reflects actual unread messages, flagged complaints, and low-stock products instead of a hardcoded fake list from the original demo.
- Removed the phone/call icon and "..." menu from the conversation header — decorative leftovers from the demo with no real feature behind them (no telephony integration exists in this project).
- Closed the sales loop: the AI's cart-detection was already part of its reply schema but was silently discarded — nothing ever built a real cart or created an order. Now the cart builds for real (validated against actual stock), the Inbox shows real cart contents/totals, and a working "Generate Order" button creates a real Order record once the merchant confirms a shipping address. Added an Orders screen to view and update them.
- Wired the Integrations screen's Facebook card to real connection state (shows which Page is connected, real Connect/Disconnect actions) — other channel cards are still mock for now.

## 2026-07-12/13 — Facebook Messenger goes live, real Inbox, and correctness fixes

- Connected a real Facebook Page to a Meta Developer app and built a signature-verified webhook (`GET/POST /webhooks/meta`) that receives real Messenger messages, runs them through the same AI pipeline as the demo widget, and sends real replies back via the Graph API Send API. Verified end-to-end with real messages from an actual Facebook account.
- Wired the Inbox screen to the real database: conversations, message history, and status (AI Managed/Active/Closed) all persist now instead of resetting on refresh.
- Fixed a duplicate-message bug: AI replies were being delivered to real customers *before* the merchant ever saw them in the Inbox, so the "Send Now"/"Edit Reply" review buttons were misleading and could cause a real duplicate message to go out. Reworked this so the existing "AI Copilot" toggle now genuinely controls behavior — Copilot on: full autopilot (auto-generate and auto-send); Copilot off: AI drafts a suggested reply that's held until the merchant approves or edits it.
- Added webhook idempotency (Meta's webhook delivery is "at-least-once" and can redeliver the same event) so a redelivered message can't trigger a second AI reply or a second real send. Verified with a real duplicate-delivery test.
- Added Inbox polling (5s) so new messages show up without a manual page refresh.
- Fixed the browser back button exiting the whole app instead of stepping back through in-app tabs (wired tab navigation to the History API).
- Cleaned up test/debug conversations and trimmed the seed data to two curated demo conversations instead of the full mock set.

## 2026-07-11 — Real backend: auth, database, catalog, deployment

- Migrated off the AI-Studio demo's fake `isAuthenticated` boolean to real signup/login/JWT backed by Postgres (Supabase), with bcrypt password hashing.
- Added the Prisma schema (Merchant, Store, Product, Channel, Conversation, Message, Order) and seeded it from the existing mock data.
- Wired the Product Catalog screen to real CRUD endpoints (`/api/products`) and the AI persona screen to `/api/persona`, both scoped to the logged-in merchant's store.
- Fixed the Gemini API key handling (a real key had leaked into `.env.example`, the committed template file) and confirmed the `gemini-3.5-flash` model call actually works end-to-end.
- Deployed to Railway (`shopmateai-production.up.railway.app`) via the CLI, since GitHub-integration deploys weren't available to a non-admin collaborator.
- Disabled the old fake "forgot password" flow (it let anyone reset any account's password by typing an email) rather than wiring it to the real database as-is, since that would've been a real account-takeover hole on a public URL.

## 2026-07-10 — Starting point

- Repo begins as an AI-Studio-generated frontend demo: a merchant dashboard (Inbox, Catalog, Analytics, Integrations, Settings) backed entirely by mock data and a fake auth flow, with a `/api/chat` endpoint already calling Gemini for the AI sales agent behavior.

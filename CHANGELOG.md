# Changelog

Plain-language history of work on ShopMate AI, for humans (not git blame). See `CLAUDE.md` for current project state and `PLANNING.md` for the roadmap.

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

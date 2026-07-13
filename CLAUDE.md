# ShopMate AI — Project Notes for Claude

This file tracks project state and working preferences so future sessions don't need to re-derive them. See `PLANNING.md` for the full build roadmap and architecture rationale, and `CHANGELOG.md` for a dated, plain-language history of what's been built and why.

## What this project is

A CSE499 capstone: an AI sales agent merchants connect to Messenger/Instagram/WhatsApp/a website widget. Started as an AI-Studio-generated frontend demo with fake data; being built out into a real product feature by feature.

## Working preferences

- **Never add `Co-Authored-By: Claude` or any Claude/Anthropic attribution to git commits.** This is a shared repo with a human teammate (SafatUddin) — no Claude visibility in commit history.
- **Only commit when explicitly asked in that turn.** Don't infer commit consent from an ambiguous "yes" to a broader question (e.g. "yes" to "push and redeploy?" is not "yes, commit this").
- Don't invent new UI styling — reuse existing patterns already in the component/file (error banners, loading-button states, etc. all follow patterns already established in `LoginPage.tsx`/`SignupPage.tsx`/the persona-save button). Anything genuinely new should follow `DESIGN.md`.
- This repo has a collaborator (not just the primary user) — treat force-pushing/rewriting shared history as needing explicit confirmation each time, and warn that the collaborator will need to `git fetch && git reset --hard origin/main` to resync afterward.

## Infrastructure (as of this writing)

- **Hosting:** Railway, project `shopmateAI`, deployed via `railway up` (not GitHub-integration — the user is a repo collaborator without admin rights to grant Railway's GitHub App access, so deploys are pushed straight from the CLI). Public URL: `https://shopmateai-production.up.railway.app`.
- **Database:** Supabase Postgres (project `shopmateAI`, `ap-northeast-2`/Seoul region). Prisma ORM, schema at `prisma/schema.prisma`. Uses the pooled connection (`DATABASE_URL`, port 6543, `pgbouncer=true`) for the app and the direct connection (`DIRECT_URL`, port 5432) for migrations.
- **AI:** Google Gemini via `@google/genai`, model `gemini-3.5-flash` (this is correct — don't "fix" it back to an older model name; verify against the live `/v1beta/models` list for this API key if it ever seems wrong).
- Env vars needed locally (`.env`, gitignored) and on Railway: `GEMINI_API_KEY`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`. Placeholders documented in `.env.example`.
- Demo/seed account: `merchant@shopmate.ai` / `password123` (seeded via `npm run db:seed` from `src/data/mockData.ts`, trimmed to 2 curated demo conversations).
- **Facebook Messenger:** connected via a manual Page Access Token (Meta app `shopmateAI_test`, test Page "ShopMate Test") rather than a self-serve OAuth flow — that's Option B in `PLANNING.md`, not built yet. Webhook receiver at `POST /webhooks/meta`, signature-verified via `META_APP_SECRET`. Only Meta app testers can message the Page (dev-mode app, no App Review done).

## Progress so far

- ✅ Real auth: signup/login/JWT against the `Merchant`/`Store` tables, bcrypt password hashing, `/api/me` GET+PATCH (name/email/avatar/password, with current-password verification).
- ✅ Real Product Catalog CRUD: `GET/POST /api/products`, `DELETE /api/products/:id`, scoped by the authenticated merchant's `storeId`, duplicate-SKU rejected with 409.
- ✅ Real AI persona: `GET/PUT /api/persona` backed by `Store.tone/style/customInstructions`.
- ✅ Real Inbox/conversations: `GET /api/conversations`, `PATCH /api/conversations/:id` (status), `POST /api/conversations/:id/messages` (customer-simulate or merchant reply), `POST /api/conversations/:id/messages/:messageId/approve` (approve a pending AI draft). Polls every 5s for new messages.
- ✅ Real Facebook Messenger channel (manual-token connection, see above): incoming messages → AI reply → real Graph API delivery, all persisted. Webhook is idempotent against Meta's at-least-once delivery (`Message.externalId` unique constraint).
- ✅ AI Copilot toggle now has real teeth: **on** (`AI Managed`) = full autopilot, AI replies auto-generate and auto-send; **off** (`Active`) = AI drafts a suggested reply held as `Message.pending`, merchant must click "Send Now" or edit-then-send before anything reaches the real customer. This was a genuine bug fix — the old behavior auto-sent AI replies to real customers *before* the merchant ever saw them, so "Send Now"/"Edit Reply" could trigger a real duplicate message.
- ✅ Browser back/forward now steps through in-app tab navigation (wired to the History API) instead of leaving the app.
- ❌ Not yet wired to the database: Integrations screen (connect/disconnect UI), Analytics — still local React state / mock data.
- ❌ "Forgot password" intentionally disabled (shows a "not available yet" message) rather than wired to the DB — the old demo behavior let anyone reset any account's password just by typing an email, which would be a real account-takeover hole on the public Railway URL. Needs real email verification before it's built for real.
- ❌ No self-serve channel connect flow yet (Instagram/WhatsApp are still mock toggles; Facebook is real but manually configured, not merchant-self-serve) — that's Option B / the rest of Phase 4 in `PLANNING.md`.
- ❌ Facebook conversations show a generic "New Customer" name — we don't fetch real profile names from the Graph API yet.

## Known environment quirks

- VS Code's TS server has intermittently shown stale "missing @types/react" diagnostics on files after `node_modules` churn (e.g. after downgrading Prisma 7→6). The CLI `npx tsc --noEmit` is the source of truth for whether the build actually typechecks — if it exits 0, the IDE squiggles are a stale cache, not a real error. Restarting the TS server / reloading the window clears it.
- Prisma is pinned to v6, not v7 — Prisma 7 changed to a driver-adapter + `prisma.config.ts` model that most current docs/tutorials don't cover yet. Don't upgrade without a deliberate reason.
- `prisma migrate dev` refuses to run at all in this non-interactive shell (even with `--create-only` or a piped `y`). Workaround: generate the SQL with `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script`, hand-create the migration folder (`prisma/migrations/<timestamp>_<name>/migration.sql`) with that output, then apply with `npx prisma migrate deploy` (safe for non-interactive use, never does a destructive reset). Always confirm the exact SQL with the user first since it runs against the shared Supabase DB that also backs production.
- **Meta's webhook subscription can silently desync** — the Messenger API Settings UI can show the callback URL "Verified" and the `messages` field "Subscribed" while Meta's backend isn't actually delivering anything. Symptom: real customer messages (and even Meta's own "Test"/"Send to server" sample-payload button) never reach `/webhooks/meta` — no request at all, not even a rejected one — while our own signed test requests via curl work fine. There's no visible error in Meta's "Webhook Errors" log for this. Fix that resolved it once: click "Remove subscription" in Messenger API Settings, re-enter the Callback URL + Verify Token, "Verify and save" again, re-check the `messages` field subscription (it resets to Unsubscribed on removal), **and** add any additional messaging-related permissions/field subscriptions in "Permissions and features" beyond just `messages` (unconfirmed which of these two actually mattered — they were done together). If real messages stop arriving again with everything else (token validity via `debug_token`, signature verification, DB) checking out fine, try both together before assuming it's a code bug.

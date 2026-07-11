# ShopMate AI — Project Notes for Claude

This file tracks project state and working preferences so future sessions don't need to re-derive them. See `PLANNING.md` for the full build roadmap and architecture rationale.

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
- Env vars needed locally (`.env`, gitignored) and on Railway: `GEMINI_API_KEY`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`. Placeholders documented in `.env.example`.
- Demo/seed account: `merchant@shopmate.ai` / `password123` (seeded via `npm run db:seed` from `src/data/mockData.ts`).

## Progress so far

- ✅ Real auth: signup/login/JWT against the `Merchant`/`Store` tables, bcrypt password hashing, `/api/me` GET+PATCH (name/email/avatar/password, with current-password verification).
- ✅ Real Product Catalog CRUD: `GET/POST /api/products`, `DELETE /api/products/:id`, scoped by the authenticated merchant's `storeId`, duplicate-SKU rejected with 409.
- ✅ Real AI persona: `GET/PUT /api/persona` backed by `Store.tone/style/customInstructions`.
- ❌ Not yet wired to the database: Inbox/conversations, Integrations (channel connect/disconnect), Analytics — these still run on local React state / mock data.
- ❌ "Forgot password" intentionally disabled (shows a "not available yet" message) rather than wired to the DB — the old demo behavior let anyone reset any account's password just by typing an email, which would be a real account-takeover hole on the public Railway URL. Needs real email verification before it's built for real.
- ❌ No real channel integrations yet (Facebook/Instagram/WhatsApp/widget are all still mock toggles) — that's Phase 4 in `PLANNING.md`.

## Known environment quirks

- VS Code's TS server has intermittently shown stale "missing @types/react" diagnostics on files after `node_modules` churn (e.g. after downgrading Prisma 7→6). The CLI `npx tsc --noEmit` is the source of truth for whether the build actually typechecks — if it exits 0, the IDE squiggles are a stale cache, not a real error. Restarting the TS server / reloading the window clears it.
- Prisma is pinned to v6, not v7 — Prisma 7 changed to a driver-adapter + `prisma.config.ts` model that most current docs/tutorials don't cover yet. Don't upgrade without a deliberate reason.

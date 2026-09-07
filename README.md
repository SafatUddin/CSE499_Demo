# Remlin

An AI sales agent for merchants — connects to Messenger, Instagram, WhatsApp, and a
website chat widget, answers customers using a real product catalog, and manages
carts and orders end to end. Built as a CSE499 capstone project.

## Live Site

The deployed app is live on Railway: [remlin.up.railway.app](https://remlin.up.railway.app)

Demo login: `merchant@shopmate.ai` / `password1234`

## Tech Stack

- **Frontend:** React + TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js + Express, TypeScript
- **Database:** PostgreSQL (Supabase) via Prisma ORM
- **AI:** Google Gemini
- **Hosting:** Railway

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Copy `.env.example` to `.env` and fill in the required values.
3. Run the app:
   `npm run dev`

## Documentation

Project docs live in [`docs/`](./docs/) — architecture notes, the AI agent's
order-management rules, the UI design spec, and per-channel setup guides
(Shopify, WooCommerce, WhatsApp, Facebook).

## License

MIT — see [LICENSE](./LICENSE).

# Guide: Shopify Product Catalog Sync Setup

This file explains how to connect a Shopify store to ShopMate AI so its products, prices,
and stock levels sync into ShopMate's catalog.

ShopMate connects to Shopify via a **custom app's Admin API access token** — not a public
Shopify App Store listing. This is the right approach for a single merchant's own store
(no app review needed) rather than a multi-merchant SaaS product.

---

## Step 1: Create a Custom App in your Shopify Admin

1. Log into your Shopify store's admin (`https://your-store.myshopify.com/admin`).
2. Go to **Settings** (bottom of the left sidebar) → **Apps and sales channels**.
3. Click **Develop apps** (you may need to click "Allow custom app development" once, first).
4. Click **Create an app**, give it a name (e.g. "ShopMate AI Sync").

---

## Step 2: Grant API Scopes

1. In your new app, go to the **Configuration** tab.
2. Under **Admin API integration**, click **Configure**.
3. Enable these scopes:
   - `read_products` — required, lets ShopMate read your catalog.
4. Click **Save**.

---

## Step 3: Install the App and Get Your Access Token

1. Go to the **API credentials** tab.
2. Click **Install app**.
3. Once installed, you'll see an **Admin API access token** — click **Reveal token once**.
   Copy it immediately; Shopify only shows it once (you can create a new app if you lose it).

---

## Step 4: Connect in ShopMate AI

1. Go to **Integrations** in the ShopMate AI Dashboard.
2. Click **Connect** on the Shopify card.
3. Enter:
   - **Shopify domain** — e.g. `my-boutique.myshopify.com`
   - **Admin API access token** — from Step 3 (starts with `shpat_`)
4. Click **Connect store**. ShopMate verifies the credentials against your real store before saving anything.
5. Click **Sync products now** to pull your catalog in. Products are matched by SKU — products
   with no SKU set in Shopify are skipped, since ShopMate needs a SKU to avoid creating duplicates
   on future syncs.

Syncing is a manual action (click the button whenever you want fresh data) — there's no
automatic background sync or webhook yet.

## Testing without a real store

Shopify's free **Partners program** (partners.shopify.com) lets you create unlimited free
development stores — no credit card required — which is a safe way to test this integration
end-to-end before connecting a real store.

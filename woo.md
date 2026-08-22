# Guide: WooCommerce Integration Setup

This guide explains how to connect a **WooCommerce** WordPress store to ShopMate AI so its product catalog (products, SKUs, prices, inventory, images, and custom attributes) automatically syncs into ShopMate AI.

---

## 1. How the WooCommerce Integration Works in ShopMate AI

ShopMate AI connects directly to WooCommerce using the official **WooCommerce REST API v3**. 
- Connection requires:
  1. **Store URL** (e.g. `https://yourwoocommercewebsite.com`)
  2. **Consumer Key** (starts with `ck_...`)
  3. **Consumer Secret** (starts with `cs_...`)
- ShopMate AI verifies the credentials by testing the `/wp-json/wc/v3/system_status` or `/wp-json/wc/v3/products` endpoint.
- Product catalog sync imports product names, SKUs, prices, stock quantities, descriptions, main product images, and raw attributes (categories, tags, attributes) into ShopMate AI so the AI Assistant can answer customer inquiries accurately.

---

## Free & Instant Ways to Get a WooCommerce Test / Sandbox Store

Unlike Shopify (which has Shopify Partners for dev stores), WooCommerce is self-hosted WordPress software. Here are the 3 easiest ways to set up a free WooCommerce test store in minutes:

### Option 1: InstaWP / TasteWP (Instant 1-Click Cloud Sandbox — Recommended)
1. Go to **[InstaWP.com](https://instawp.com)** or **[TasteWP.com](https://tastewp.com)**.
2. Click **Create Site** (1-click sandbox creation). Select **WooCommerce** template/plugin.
3. In under 30 seconds, you get a fully functional live WordPress + WooCommerce store hosted online with HTTPS and an admin URL.
4. You can use sample WooCommerce product data during setup.
5. Generate REST API Consumer Key and Consumer Secret from WooCommerce settings and test direct connection in ShopMate AI.

### Option 2: LocalWP (Run locally on your PC + Live Link / ngrok)
1. Download & install **[LocalWP](https://localwp.com)** (Free desktop application for Mac/Windows/Linux).
2. Create a new WordPress site and install the free **WooCommerce** plugin.
3. Click **Enable Live Link** in LocalWP (or use `ngrok`) to get a public HTTPS URL (e.g., `https://xxxx.loca.lt` or `https://xxxx.ngrok-free.app`).
4. Generate API keys inside your local WordPress site and use the Live Link URL to test in ShopMate AI.

---

## 2. Steps to Generate WooCommerce REST API Keys (For Store Owners)

Follow these steps in your WordPress / WooCommerce Dashboard:

### Step 1: Check Permalinks
1. Log into your WordPress Admin Dashboard (`https://yourstore.com/wp-admin`).
2. Go to **Settings** → **Permalinks**.
3. Under **Common Settings**, ensure any option **other than "Plain"** is selected (e.g. **Post name**). WooCommerce REST API requires pretty permalinks to function properly.
4. Click **Save Changes**.

### Step 2: Generate API Keys
1. Go to **WooCommerce** → **Settings**.
2. Click on the **Advanced** tab at the top.
3. Click the **REST API** sub-link.
4. Click the **Add key** (or **Create an API key**) button.
5. Fill in the fields:
   - **Description**: Enter `ShopMate AI Integration` (or any friendly name).
   - **User**: Select your admin user account.
   - **Permissions**: Select **Read** (or **Read/Write** if order sync is needed). **Read** permission is sufficient for product catalog sync.
6. Click **Generate API key**.

### Step 3: Copy Your Keys
1. You will be shown:
   - **Consumer Key** (starts with `ck_...`)
   - **Consumer Secret** (starts with `cs_...`)
2. **IMPORTANT**: Copy the Consumer Secret immediately! WooCommerce only displays the Consumer Secret once. If you close the window, you will need to revoke it and generate a new key.

---

## 3. How to Connect in the ShopMate AI Dashboard

1. Log into your ShopMate AI Merchant Dashboard.
2. Go to **Integrations** (or Channel Ecosystem).
3. Find the **WooCommerce** integration card and click **Connect** / **Manage**.
4. In the setup modal, enter:
   - **Store URL**: e.g., `https://mystore.com` (or `http://...`)
   - **Consumer Key**: Paste your `ck_...` key.
   - **Consumer Secret**: Paste your `cs_...` key.
5. Click **Connect WooCommerce**.
6. Once connected, click **Sync products now** to pull all WooCommerce products into your ShopMate AI product catalog.

---

## 4. Manual / Technical Notes & Troubleshooting

### HTTPS & SSL Requirements
- WooCommerce REST API typically requires SSL (`https://`). For local development (`http://localhost` or `http://127.0.0.1`), basic auth over HTTP is permitted by WooCommerce if explicit flags are set, but for production HTTPS is mandatory.

### Security Plugins & Firewalls (Cloudflare, Wordfence, iThemes Security)
- If connection fails with `403 Forbidden` or `401 Unauthorized`, ensure your security plugin or Cloudflare WAF is not blocking requests to `/wp-json/wc/v3/`.
- Whitelist API requests targeting `/wp-json/wc/v3/*`.

### Missing SKUs
- If any WooCommerce product does not have a SKU specified, ShopMate AI automatically generates a fallback SKU (`WOO-VAR-<id>` or `WOO-<id>`) to ensure product tracking and avoid duplicates during catalog sync.

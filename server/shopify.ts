// Shopify Admin API helpers. Uses a merchant-supplied custom-app Admin API access
// token (not a public OAuth app) — simpler to set up for a single store, no Shopify
// App Store review needed. See ShopifySetup.md for how a merchant gets this token.

const API_VERSION = '2024-01';

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

// Confirms the domain + token actually work by hitting a cheap, always-available
// endpoint. Throws with a descriptive message on any failure.
export async function verifyShopifyStore(domain: string, accessToken: string): Promise<{ name: string }> {
  const host = normalizeDomain(domain);
  const res = await fetch(`https://${host}/admin/api/${API_VERSION}/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Invalid Shopify access token for this store');
    }
    throw new Error(`Could not reach Shopify store (${res.status})`);
  }
  const data = await res.json();
  return { name: data.shop?.name || host };
}

export interface ShopifyProduct {
  externalId: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
}

// Pulls all products (paginated via Shopify's Link header, 250 per page max) and
// flattens to one row per product using its first variant — good enough for simple
// (non-variant) catalogs, which covers most small merchants.
export async function fetchShopifyProducts(domain: string, accessToken: string): Promise<ShopifyProduct[]> {
  const host = normalizeDomain(domain);
  const products: ShopifyProduct[] = [];
  let url: string | null = `https://${host}/admin/api/${API_VERSION}/products.json?limit=250`;

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': accessToken } });
    if (!res.ok) {
      throw new Error(`Failed to fetch Shopify products (${res.status})`);
    }
    const data = await res.json();

    for (const p of data.products || []) {
      const variant = p.variants?.[0];
      if (!variant || !variant.sku) continue; // skip products with no SKU — nothing to match on
      products.push({
        externalId: String(variant.id),
        name: p.title,
        sku: variant.sku,
        price: parseFloat(variant.price) || 0,
        inventory: variant.inventory_quantity ?? 0,
      });
    }

    const linkHeader = res.headers.get('link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return products;
}

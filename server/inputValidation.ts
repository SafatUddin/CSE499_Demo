/**
 * Server-side input validation helpers (Security Phase 7).
 * Small, reusable checks — no external validation framework.
 */

export const JSON_BODY_LIMIT = '1mb';

export const MAX_PASSWORD_LENGTH = 128;
export const MAX_PRODUCT_NAME_LENGTH = 200;
export const MAX_PRODUCT_DESCRIPTION_LENGTH = 5000;
export const MAX_SKU_LENGTH = 100;
export const MAX_PRODUCT_PRICE = 1_000_000;
export const MAX_PRODUCT_INVENTORY = 1_000_000;
export const MAX_CART_QUANTITY = 10_000;
export const MAX_CART_ITEMS = 50;
export const MAX_AVATAR_URL_LENGTH = 2048;
export const MAX_PERSONA_TONE_LENGTH = 500;
export const MAX_PERSONA_STYLE_LENGTH = 50;
export const MAX_PERSONA_INSTRUCTIONS_LENGTH = 10_000;

const CART_ITEM_KEYS = new Set(['sku', 'quantity']);

const DANGEROUS_URL_SCHEMES = /^(javascript|data|vbscript|file|blob):/i;

export type ValidatedProductInput = {
  name: string;
  sku: string;
  price: number;
  inventory: number;
  description?: string;
  status: 'PENDING' | 'TRAINED';
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

function optionalString(value: unknown, maxLen: number): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return null;
  if (value.length > maxLen) return null;
  return value;
}

export function parseValidatedPrice(price: unknown): number | null {
  if (price === null || price === undefined) return null;
  if (typeof price === 'object' || typeof price === 'boolean') return null;
  const n = typeof price === 'number' ? price : Number(price);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRODUCT_PRICE) return null;
  return n;
}

export function parseValidatedInventory(inventory: unknown): number | null {
  if (inventory === undefined || inventory === null || inventory === '') return 0;
  if (typeof inventory === 'object' || typeof inventory === 'boolean') return null;
  const n = typeof inventory === 'number' ? inventory : Number(inventory);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_PRODUCT_INVENTORY) return null;
  return n;
}

export function validateProductInput(body: unknown): ValidatedProductInput | null {
  if (!isPlainObject(body)) return null;

  const name = nonEmptyString(body.name, MAX_PRODUCT_NAME_LENGTH);
  const sku = nonEmptyString(body.sku, MAX_SKU_LENGTH);
  const price = parseValidatedPrice(body.price);
  const inventory = parseValidatedInventory(body.inventory);
  if (name === null || sku === null || price === null || inventory === null) return null;

  const description = optionalString(body.description, MAX_PRODUCT_DESCRIPTION_LENGTH);
  if (description === null) return null;

  let status: 'PENDING' | 'TRAINED' = 'TRAINED';
  if (body.status !== undefined) {
    if (body.status === 'Pending') status = 'PENDING';
    else if (body.status === 'Trained') status = 'TRAINED';
    else if (body.status !== 'PENDING' && body.status !== 'TRAINED') return null;
    else status = body.status as 'PENDING' | 'TRAINED';
  }

  const result: ValidatedProductInput = { name, sku, price, inventory, status };
  if (description !== undefined) result.description = description;
  return result;
}

export function sanitizeCartInput(cart: unknown): { sku: string; quantity: number }[] | null {
  if (!Array.isArray(cart)) return null;
  if (cart.length > MAX_CART_ITEMS) return null;

  const sanitized: { sku: string; quantity: number }[] = [];
  for (const item of cart) {
    if (!isPlainObject(item)) return null;
    const keys = Object.keys(item);
    if (keys.length !== CART_ITEM_KEYS.size || !keys.every((k) => CART_ITEM_KEYS.has(k))) {
      return null;
    }

    const sku = nonEmptyString(item.sku, MAX_SKU_LENGTH);
    if (sku === null) return null;

    const quantity = item.quantity;
    if (typeof quantity === 'object' || typeof quantity === 'boolean') return null;
    const qty = typeof quantity === 'number' ? quantity : Number(quantity);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1 || qty > MAX_CART_QUANTITY) {
      return null;
    }

    sanitized.push({ sku, quantity: qty });
  }
  return sanitized;
}

export function validateCartSkusInStore(
  cart: { sku: string; quantity: number }[],
  storeSkus: Set<string>,
): boolean {
  if (cart.length === 0) return true;
  return cart.every((item) => storeSkus.has(item.sku));
}

const ALLOWED_CONVERSATION_PATCH_KEYS = new Set(['status', 'cart', 'isComplaint']);

export function conversationPatchHasOnlyAllowedKeys(body: unknown): boolean {
  if (!isPlainObject(body)) return false;
  return Object.keys(body).every((k) => ALLOWED_CONVERSATION_PATCH_KEYS.has(k));
}

export function validateAvatarUrl(url: string, options?: { allowHttp?: boolean }): boolean {
  if (typeof url !== 'string' || url.length === 0) return true;
  if (url.length > MAX_AVATAR_URL_LENGTH) return false;
  if (DANGEROUS_URL_SCHEMES.test(url.trim())) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'https:') return true;
  if (options?.allowHttp && parsed.protocol === 'http:') return true;
  return false;
}

export type ValidatedPersonaInput = {
  tone: string;
  style: string;
  customInstructions: string;
  autoFinalizeOrdersAlways: boolean;
};

export function validatePersonaInput(body: unknown): ValidatedPersonaInput | null {
  if (!isPlainObject(body)) return null;

  const tone = nonEmptyString(body.tone, MAX_PERSONA_TONE_LENGTH);
  const style = nonEmptyString(body.style, MAX_PERSONA_STYLE_LENGTH);
  if (tone === null || style === null) return null;
  if (style !== 'bullets' && style !== 'narrative') return null;

  const customInstructions =
    body.customInstructions === undefined || body.customInstructions === null
      ? ''
      : optionalString(body.customInstructions, MAX_PERSONA_INSTRUCTIONS_LENGTH);
  if (customInstructions === null) return null;

  return {
    tone,
    style,
    customInstructions: customInstructions ?? '',
    autoFinalizeOrdersAlways: !!body.autoFinalizeOrdersAlways,
  };
}

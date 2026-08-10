/**
 * Server-side checkout / order-action validation.
 * LLM output (askQuantityForSku, cartAction, orderCancelled, etc.) is untrusted —
 * every business-state transition must pass through these checks.
 */

export const MAX_CHECKOUT_QUANTITY = 99;

export type CatalogProduct = {
  id?: string;
  sku: string;
  name: string;
  inventory: number;
  price?: number | { toNumber?: () => number };
};

export type EncodedAwaitingState =
  | { kind: 'confirm'; sku: string; qty: number }
  | { kind: 'details'; sku: string; qty: number }
  | { kind: 'ask_qty'; sku: string }
  | { kind: 'cancel_pending'; orderId: string }
  | { kind: 'none' };

export type QtyValidationOk = { ok: true; sku: string; qty: number; product: CatalogProduct };
export type QtyValidationErr = { ok: false; reason: 'invalid_sku' | 'invalid_qty' | 'insufficient_inventory' };
export type QtyValidation = QtyValidationOk | QtyValidationErr;

export function parseAwaitingQuantityFor(raw: string | null | undefined): EncodedAwaitingState {
  if (!raw || typeof raw !== 'string') return { kind: 'none' };
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'none' };

  if (trimmed.startsWith('CANCEL_PENDING:')) {
    const orderId = trimmed.slice('CANCEL_PENDING:'.length).trim();
    if (!orderId || orderId.includes(':')) return { kind: 'none' };
    return { kind: 'cancel_pending', orderId };
  }

  if (trimmed.startsWith('CONFIRM:') || trimmed.startsWith('DETAILS:')) {
    const kind = trimmed.startsWith('CONFIRM:') ? 'confirm' : 'details';
    const parts = trimmed.split(':');
    if (parts.length < 3) return { kind: 'none' };
    const sku = parts[1]?.trim();
    const qty = Number.parseInt(parts[2], 10);
    if (!sku || !Number.isInteger(qty)) return { kind: 'none' };
    return { kind, sku, qty };
  }

  // Plain SKU — reject encoded-looking garbage with extra colons
  if (trimmed.includes(':')) return { kind: 'none' };
  return { kind: 'ask_qty', sku: trimmed };
}

export function encodeConfirm(sku: string, qty: number): string {
  return `CONFIRM:${sku}:${qty}`;
}

export function encodeDetails(sku: string, qty: number): string {
  return `DETAILS:${sku}:${qty}`;
}

export function encodeCancelPending(orderId: string): string {
  return `CANCEL_PENDING:${orderId}`;
}

export function normalizeCheckoutQuantity(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  const qty = Math.floor(n);
  if (qty < 1 || qty > MAX_CHECKOUT_QUANTITY) return null;
  return qty;
}

/** Validate SKU belongs to this store's catalog and quantity is safe. */
export function validateSkuAndQuantity(
  products: CatalogProduct[],
  sku: string | null | undefined,
  rawQty: unknown,
  opts: { requireInventory?: boolean } = { requireInventory: true },
): QtyValidation {
  if (!sku || typeof sku !== 'string') return { ok: false, reason: 'invalid_sku' };
  const product = products.find((p) => p.sku === sku);
  if (!product) return { ok: false, reason: 'invalid_sku' };

  const qty = normalizeCheckoutQuantity(rawQty);
  if (qty === null) return { ok: false, reason: 'invalid_qty' };

  if (opts.requireInventory !== false && product.inventory < qty) {
    return { ok: false, reason: 'insufficient_inventory' };
  }

  return { ok: true, sku: product.sku, qty, product };
}

/**
 * Sanitize LLM askQuantityForSku before writing conversation state.
 * Allows plain SKU or CONFIRM:SKU:QTY only — never DETAILS or CANCEL_PENDING from the model.
 */
export function sanitizeAskQuantityForSku(
  raw: string | null | undefined,
  products: CatalogProduct[],
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Model must never author DETAILS / CANCEL_PENDING encodings.
  if (trimmed.startsWith('DETAILS:') || trimmed.startsWith('CANCEL_PENDING:')) {
    return null;
  }

  if (trimmed.startsWith('CONFIRM:')) {
    const parsed = parseAwaitingQuantityFor(trimmed);
    if (parsed.kind !== 'confirm') return null;
    const v = validateSkuAndQuantity(products, parsed.sku, parsed.qty);
    if (!v.ok) return null;
    return encodeConfirm(v.sku, v.qty);
  }

  if (trimmed.includes(':')) return null;
  const product = products.find((p) => p.sku === trimmed);
  if (!product || product.inventory < 1) return null;
  return product.sku;
}

export function isAffirmativeMessage(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  if (
    lower === 'yes' ||
    lower === 'y' ||
    lower === 'ha' ||
    lower === 'haa' ||
    lower === 'haan' ||
    lower === 'ok' ||
    lower === 'okay' ||
    lower === 'sure' ||
    lower === 'confirm' ||
    lower === 'proceed'
  ) {
    return true;
  }
  return (
    lower.includes('yes, cancel') ||
    lower.includes('yes cancel') ||
    lower.includes('confirm cancel') ||
    lower.includes('go ahead') ||
    lower.includes('please cancel') ||
    lower.includes('cancel it') ||
    lower.includes('cancel the order') ||
    lower.includes('cancel my order') ||
    (lower.includes('yes') && lower.includes('cancel'))
  );
}

export function isCancelDeclineMessage(text: string): boolean {
  const lower = text.toLowerCase().trim();
  return (
    lower === 'no' ||
    lower === 'na' ||
    lower.includes('never mind') ||
    lower.includes('nevermind') ||
    lower.includes("don't cancel") ||
    lower.includes('dont cancel') ||
    lower.includes('keep it') ||
    lower.includes('keep my order') ||
    lower.includes('do not cancel')
  );
}

/** First-turn cancel intent for an already-placed order (not checkout decline). */
export function isOngoingOrderCancelIntent(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower) return false;
  return (
    lower === 'cancel' ||
    lower.includes('cancel my order') ||
    lower.includes('cancel the order') ||
    lower.includes('cancel order') ||
    lower.includes('please cancel') ||
    lower.includes('i want to cancel') ||
    lower.includes('cancel kore') ||
    lower.includes('order cancel')
  );
}

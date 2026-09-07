import { prisma } from './db';
import { MAX_CHECKOUT_QUANTITY } from './checkoutSecurity';

// Creates a real Order from a conversation's current AI-built cart. A deliberate
// merchant action (not automatic) — the AI can build a cart, but committing it to a
// real order/financial record needs explicit confirmation, same reasoning as the
// AI-Copilot pending-draft approval flow.
// Shared by the manual "Generate Order" endpoint (server/routes/orders.ts) and the AI's
// auto-finalize path (see generateAndStoreAgentReply in server/conversationEngine.ts) —
// validates stock, atomically decrements inventory, creates the Order row, and clears
// the conversation's cart in one transaction.
export async function createOrderForConversation(
  conversation: { id: string; storeId: string; customerName: string | null },
  cart: { sku: string; quantity: number }[],
  address: string,
  customerNameOverride?: string
) {
  const insufficientStock = (message: string) => {
    const err = new Error(message) as Error & { code: string };
    err.code = 'INSUFFICIENT_STOCK';
    return err;
  };

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { storeId: conversation.storeId, sku: { in: cart.map((item) => item.sku) } },
    });

    // M1: every cart line must resolve to a real product with enough stock.
    for (const cartItem of cart) {
      const quantity = Math.floor(Number(cartItem.quantity));
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_CHECKOUT_QUANTITY) {
        throw insufficientStock(`Invalid quantity for SKU ${cartItem.sku}`);
      }
      const product = products.find((p) => p.sku === cartItem.sku);
      if (!product) {
        throw insufficientStock(`Product not found for SKU ${cartItem.sku}`);
      }
      if (product.inventory < quantity) {
        throw insufficientStock(
          `Insufficient stock for ${product.name} (SKU ${product.sku}). Requested ${quantity}, available ${product.inventory}.`
        );
      }
    }

    // M2: decrement under an inventory >= quantity predicate so concurrent checkouts
    // cannot both claim the same unit. Sort by product id for a stable lock order.
    const cartByProductId = [...cart].sort((a, b) => {
      const pa = products.find((p) => p.sku === a.sku)!;
      const pb = products.find((p) => p.sku === b.sku)!;
      return pa.id.localeCompare(pb.id);
    });

    for (const cartItem of cartByProductId) {
      const quantity = Math.floor(Number(cartItem.quantity));
      const product = products.find((p) => p.sku === cartItem.sku)!;
      const updated = await tx.product.updateMany({
        where: { id: product.id, inventory: { gte: quantity } },
        data: { inventory: { decrement: quantity } },
      });
      if (updated.count !== 1) {
        throw insufficientStock(
          `Insufficient stock for ${product.name} (SKU ${product.sku}).`
        );
      }
    }

    const items = cart.map((cartItem) => {
      const product = products.find((p) => p.sku === cartItem.sku)!;
      return {
        sku: cartItem.sku,
        name: product.name,
        price: Number(product.price),
        quantity: Math.floor(Number(cartItem.quantity)),
      };
    });
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const order = await tx.order.create({
      data: {
        storeId: conversation.storeId,
        conversationId: conversation.id,
        items,
        customerName: customerNameOverride || conversation.customerName || 'Customer',
        address,
        status: 'PROCESSING',
        total,
      },
    });

    // Checked out — clear the conversation's cart and reset order-flow state so a
    // later purchase in the same conversation starts a fresh confirmation cycle.
    await tx.conversation.update({
      where: { id: conversation.id },
      data: {
        cart: null,
        orderConfirmationRequested: false,
        orderConfirmed: false,
        orderSummaryShown: false,
        awaitingQuantityFor: null,
      },
    });

    return order;
  });
}

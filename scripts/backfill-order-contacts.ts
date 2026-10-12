// One-off repair for orders/conversations where the AI stored the phone number inside the
// address (e.g. "Phone: X | Address: Y" or "address ... amar phone number 017..."). Moves
// the phone into Order.customerPhone / Conversation.detectedPhone and cleans the address.
//
// Dry run (default):  npx tsx scripts/backfill-order-contacts.ts
// Write changes:      npx tsx scripts/backfill-order-contacts.ts --apply
import 'dotenv/config';
import { prisma } from '../server/db';
import { splitContactDetails } from '../server/contactDetails';

const apply = process.argv.includes('--apply');

async function main() {
  const orders = await prisma.order.findMany({ select: { id: true, address: true, customerPhone: true } });
  let orderFixes = 0;
  for (const order of orders) {
    const fixed = splitContactDetails({ phone: order.customerPhone, address: order.address });
    if (fixed.address === order.address && (fixed.phone || null) === order.customerPhone) continue;
    orderFixes++;
    console.log(`[order ${order.id}]\n  before: address=${JSON.stringify(order.address)} phone=${JSON.stringify(order.customerPhone)}\n  after:  address=${JSON.stringify(fixed.address)} phone=${JSON.stringify(fixed.phone || null)}`);
    if (apply) {
      await prisma.order.update({ where: { id: order.id }, data: { address: fixed.address, customerPhone: fixed.phone || null } });
    }
  }

  const conversations = await prisma.conversation.findMany({
    where: { detectedAddress: { not: null } },
    select: { id: true, detectedAddress: true, detectedPhone: true },
  });
  let conversationFixes = 0;
  for (const c of conversations) {
    const fixed = splitContactDetails({ phone: c.detectedPhone, address: c.detectedAddress });
    if ((fixed.address || null) === c.detectedAddress && (fixed.phone || null) === c.detectedPhone) continue;
    conversationFixes++;
    console.log(`[conversation ${c.id}]\n  before: address=${JSON.stringify(c.detectedAddress)} phone=${JSON.stringify(c.detectedPhone)}\n  after:  address=${JSON.stringify(fixed.address || null)} phone=${JSON.stringify(fixed.phone || null)}`);
    if (apply) {
      await prisma.conversation.update({
        where: { id: c.id },
        data: { detectedAddress: fixed.address || null, detectedPhone: fixed.phone || null },
      });
    }
  }

  console.log(`\n${apply ? 'Updated' : 'Would update'} ${orderFixes}/${orders.length} orders and ${conversationFixes}/${conversations.length} conversations.${apply ? '' : ' Re-run with --apply to write.'}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

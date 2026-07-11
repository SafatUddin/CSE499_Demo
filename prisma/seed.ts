import { PrismaClient, ChannelType, ConversationStatus, Sender, ProductStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  INITIAL_PRODUCTS,
  INITIAL_INTEGRATIONS,
  DEFAULT_AI_PERSONA,
  INITIAL_CONVERSATIONS,
} from '../src/data/mockData';

const prisma = new PrismaClient();

const PLATFORM_TO_CHANNEL: Record<string, ChannelType> = {
  facebook: ChannelType.FACEBOOK,
  instagram: ChannelType.INSTAGRAM,
  whatsapp: ChannelType.WHATSAPP,
  websocket: ChannelType.WIDGET,
};

const STATUS_TO_CONVERSATION_STATUS: Record<string, ConversationStatus> = {
  'AI Managed': ConversationStatus.AI_MANAGED,
  Active: ConversationStatus.ACTIVE,
  Closed: ConversationStatus.CLOSED,
};

const SENDER_MAP: Record<string, Sender> = {
  customer: Sender.CUSTOMER,
  ai: Sender.AI,
  merchant: Sender.MERCHANT,
};

const INTEGRATION_TO_CHANNEL_TYPE: Record<string, ChannelType | null> = {
  'int-fb': ChannelType.FACEBOOK,
  'int-ig': ChannelType.INSTAGRAM,
  'int-wa': ChannelType.WHATSAPP,
  'int-widget': ChannelType.WIDGET,
  'int-shopify': null,
  'int-woo': null,
};

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  const merchant = await prisma.merchant.upsert({
    where: { email: 'merchant@shopmate.ai' },
    update: {},
    create: {
      email: 'merchant@shopmate.ai',
      passwordHash,
      name: 'Mara K.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=100&q=80',
    },
  });

  const store = await prisma.store.upsert({
    where: { merchantId: merchant.id },
    update: {},
    create: {
      merchantId: merchant.id,
      name: 'ShopMate Demo Store',
      tone: DEFAULT_AI_PERSONA.tone,
      style: DEFAULT_AI_PERSONA.style,
      customInstructions: DEFAULT_AI_PERSONA.customInstructions,
    },
  });

  for (const p of INITIAL_PRODUCTS) {
    await prisma.product.upsert({
      where: { storeId_sku: { storeId: store.id, sku: p.sku } },
      update: {},
      create: {
        storeId: store.id,
        name: p.name,
        sku: p.sku,
        price: p.price,
        inventory: p.inventory,
        status: p.status === 'Trained' ? ProductStatus.TRAINED : ProductStatus.PENDING,
      },
    });
  }

  for (const integration of INITIAL_INTEGRATIONS) {
    const type = INTEGRATION_TO_CHANNEL_TYPE[integration.id];
    if (!type) continue;
    await prisma.channel.upsert({
      where: { storeId_type: { storeId: store.id, type } },
      update: {},
      create: {
        storeId: store.id,
        type,
        connected: integration.connected,
      },
    });
  }

  // Only seed a couple of curated demo conversations rather than the full mock set —
  // enough to show the Inbox has real multi-turn examples without cluttering it.
  const seedConversations = INITIAL_CONVERSATIONS.filter((c) =>
    c.customerName === 'Tanvir Rahman' || c.customerName === 'Junaid Ahmed'
  );

  for (const convo of seedConversations) {
    const created = await prisma.conversation.create({
      data: {
        storeId: store.id,
        channelType: PLATFORM_TO_CHANNEL[convo.platform],
        customerName: convo.customerName,
        status: STATUS_TO_CONVERSATION_STATUS[convo.status],
        isComplaint: !!convo.isComplaint,
        cart: convo.cart ?? undefined,
        lastMessageAt: new Date(),
      },
    });

    for (const m of convo.messages) {
      await prisma.message.create({
        data: {
          conversationId: created.id,
          sender: SENDER_MAP[m.sender],
          text: m.text,
        },
      });
    }
  }

  console.log('Seed complete:');
  console.log(`  Merchant: ${merchant.email} (password: password123)`);
  console.log(`  Store: ${store.name}`);
  console.log(`  Products: ${INITIAL_PRODUCTS.length}`);
  console.log(`  Conversations: ${seedConversations.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

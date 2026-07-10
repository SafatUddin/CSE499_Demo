import { Product, Integration, AIPersona, DailyMetric, RecentActivity, Conversation } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Nexus Mech Keyboard',
    sku: 'NX-402-B',
    price: 189.00,
    inventory: 42,
    status: 'Trained',
  },
  {
    id: 'p2',
    name: 'Titanium Chronos v2',
    sku: 'TC-091-S',
    price: 349.50,
    inventory: 15,
    status: 'Pending',
  },
  {
    id: 'p3',
    name: 'Void Audio One',
    sku: 'VA-ONE-BLK',
    price: 299.00,
    inventory: 108,
    status: 'Trained',
  },
  {
    id: 'p4',
    name: 'Carbon Hydro Vessel',
    sku: 'CHV-750-G',
    price: 45.00,
    inventory: 256,
    status: 'Trained',
  },
  {
    id: 'p5',
    name: 'Starlight Halo Ring',
    sku: 'SL-HR-02',
    price: 129.00,
    inventory: 18,
    status: 'Pending',
  },
  {
    id: 'p6',
    name: 'Sleek Obsidian Pen',
    sku: 'OP-PEN-07',
    price: 85.00,
    inventory: 45,
    status: 'Trained',
  },
  {
    id: 'p7',
    name: 'Aero Leather Portfolio',
    sku: 'ALP-909',
    price: 210.00,
    inventory: 12,
    status: 'Trained',
  },
  {
    id: 'p8',
    name: 'Aqua Sport Flask',
    sku: 'ASF-500',
    price: 38.00,
    inventory: 140,
    status: 'Trained',
  },
  {
    id: 'p9',
    name: 'Eco Wool Beanie',
    sku: 'EWB-220',
    price: 29.50,
    inventory: 89,
    status: 'Pending',
  },
  {
    id: 'p10',
    name: 'Volt Carbon Wallet',
    sku: 'VCW-100',
    price: 79.00,
    inventory: 64,
    status: 'Trained',
  },
  {
    id: 'p11',
    name: 'Solis Smart Bulb',
    sku: 'SSB-RGB',
    price: 19.99,
    inventory: 310,
    status: 'Trained',
  },
  {
    id: 'p12',
    name: 'Prism Glass Coaster Set',
    sku: 'PG-CST-4',
    price: 45.00,
    inventory: 22,
    status: 'Pending',
  },
];

export const INITIAL_INTEGRATIONS: Integration[] = [
  {
    id: 'int-fb',
    name: 'Facebook Page',
    description: 'Sync product catalogs and automate Messenger inquiries via ShopMate AI training models.',
    connected: true,
    statusText: 'Active Sync',
    hasAction: true,
    logoType: 'facebook',
  },
  {
    id: 'int-ig',
    name: 'Instagram',
    description: 'Automate DM-to-Sale pipelines and manage shoppable posts directly from your merchant dashboard.',
    connected: true,
    statusText: 'Last update: 2m ago',
    hasAction: true,
    logoType: 'instagram',
  },
  {
    id: 'int-wa',
    name: 'WhatsApp Business',
    description: 'Token expired. Re-authenticate to resume high-priority AI lead management and order updates.',
    connected: false,
    statusText: 'Sync Paused',
    hasAction: true,
    actionText: 'Connect',
    logoType: 'whatsapp',
  },
  {
    id: 'int-shopify',
    name: 'Shopify Store',
    description: 'Full inventory synchronization active. AI is currently optimizing pricing across 1,240 SKUs.',
    connected: true,
    statusText: 'Elite Merchant Tier',
    hasAction: true,
    logoType: 'shopify',
  },
  {
    id: 'int-woo',
    name: 'WooCommerce',
    description: 'Integrate your WordPress store to enable ShopMate\'s custom AI checkout optimizations.',
    connected: false,
    statusText: 'Setup in 2 mins',
    hasAction: true,
    actionText: 'Manage',
    logoType: 'woocommerce',
  },
  {
    id: 'int-widget',
    name: 'Website Chat Widget',
    description: 'Embed a luxurious, floating live-chat agent on your storefront to assist visitors, handle complaints, and complete direct cart checkouts.',
    connected: true,
    statusText: 'Embed Active',
    hasAction: true,
    actionText: 'Get Code',
    logoType: 'woocommerce', // Will map to a custom widget icon
  },
];

export const DEFAULT_AI_PERSONA: AIPersona = {
  tone: 'Direct, helpful, and highly sophisticated. Focus on technical features but explain them for a luxury lifestyle audience. Use a confident, elite tone.',
  style: 'bullets',
  customInstructions: 'Avoid slang. Mention that standard shipping takes 2-3 business days. If they show high interest, offer a custom 10% voucher: COMPOSITE10.',
};

export const RECHART_DATA_30_DAYS: DailyMetric[] = [
  { date: 'Oct 14', conversations: 120, convertedSales: 40 },
  { date: 'Oct 17', conversations: 180, convertedSales: 65 },
  { date: 'Oct 20', conversations: 240, convertedSales: 90 },
  { date: 'Oct 23', conversations: 310, convertedSales: 130 },
  { date: 'Oct 26', conversations: 280, convertedSales: 110 },
  { date: 'Oct 29', conversations: 380, convertedSales: 180 },
  { date: 'Nov 01', conversations: 450, convertedSales: 220 },
  { date: 'Nov 04', conversations: 510, convertedSales: 290 },
  { date: 'Nov 07', conversations: 580, convertedSales: 350 },
  { date: 'Nov 11', conversations: 640, convertedSales: 410 },
];

export const RECHART_DATA_90_DAYS: DailyMetric[] = [
  { date: 'Aug 15', conversations: 320, convertedSales: 110 },
  { date: 'Aug 30', conversations: 450, convertedSales: 180 },
  { date: 'Sep 15', conversations: 610, convertedSales: 240 },
  { date: 'Sep 30', conversations: 780, convertedSales: 360 },
  { date: 'Oct 15', conversations: 920, convertedSales: 490 },
  { date: 'Oct 30', conversations: 1210, convertedSales: 680 },
  { date: 'Nov 11', conversations: 1450, convertedSales: 890 },
];

export const RECENT_ACTIVITIES: RecentActivity[] = [
  {
    id: 'act-1',
    type: 'checkout',
    orderId: '#ORD-9021',
    time: 'JUST NOW',
    title: 'AI completed checkout for Alex J.',
    description: 'SILK BLAZER | $240.00',
    badge: 'SILK BLAZER',
    price: 240.00,
  },
  {
    id: 'act-2',
    type: 'inquiry',
    time: '14M AGO',
    title: 'New Inquiry',
    description: '"Does the summer collection have breathable linens?"',
    badge: 'AI DRAFTING RESPONSE...',
  },
  {
    id: 'act-3',
    type: 'checkout',
    orderId: '#ORD-9018',
    time: '2H AGO',
    title: 'AI handled sizing return for Mara K.',
    description: 'EXCHANGE | RESOLVED',
    badge: 'EXCHANGE',
    productName: 'RESOLVED',
  },
  {
    id: 'act-4',
    type: 'alert',
    time: '5H AGO',
    title: 'Inventory Alert',
    description: 'Product Tech Tote v2 is running low.',
  },
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'chat-ws-1',
    customerName: 'Tanvir Rahman',
    platform: 'websocket',
    lastMessage: 'Sure! My name is Tanvir Rahman and my address is Block D, Road 4, Mirpur, Dhaka.',
    time: '12m ago',
    unread: false,
    status: 'AI Managed',
    messages: [
      { id: 'ws1-m1', sender: 'customer', text: "Hello! Is anyone there? I want to buy the Void Audio One.", time: '10M Ago' },
      { id: 'ws1-m2', sender: 'ai', text: "Hello! Yes, I am here to assist you. I can set up your order for the Void Audio One. Please provide your name and shipping address for confirming your order.", time: '9M Ago' },
      { id: 'ws1-m3', sender: 'customer', text: "Sure! My name is Tanvir Rahman and my address is Block D, Road 4, Mirpur, Dhaka.", time: '8M Ago' }
    ],
    lastProductViewed: 'Void Audio One',
  },
  {
    id: 'chat-ws-2',
    customerName: 'Aria Cooper',
    platform: 'websocket',
    lastMessage: 'Hey! I am interested in the Sleek Obsidian Pen.',
    time: '45m ago',
    unread: true,
    status: 'AI Managed',
    messages: [
      { id: 'ws2-m1', sender: 'customer', text: "Hey! I am interested in the Sleek Obsidian Pen.", time: '45M Ago' }
    ],
    lastProductViewed: 'Sleek Obsidian Pen',
  },
  {
    id: 'chat-ws-3',
    customerName: 'Kazi Farhan',
    platform: 'websocket',
    lastMessage: 'Yes, we ship all over Bangladesh, including Sylhet! Standard shipping...',
    time: '2h ago',
    unread: false,
    status: 'AI Managed',
    messages: [
      { id: 'ws3-m1', sender: 'customer', text: "Hi, do you ship to Sylhet?", time: '2H Ago' },
      { id: 'ws3-m2', sender: 'ai', text: "Yes, we ship all over Bangladesh, including Sylhet! Standard shipping takes 2-3 business days. What is your name and shipping address so I can calculate delivery?", time: '2H Ago' }
    ],
    lastProductViewed: 'Nexus Mech Keyboard',
  },
  {
    id: 'chat-1',
    customerName: 'Junaid Ahmed',
    platform: 'whatsapp',
    lastMessage: "What's the current pricing for a bulk order of 5 units?",
    time: '10:45 AM',
    unread: true,
    status: 'AI Managed',
    messages: [
      { id: 'm1', sender: 'customer', text: "Hello! I'm interested in the ShopMate Professional Series. Is the SM-99 SKU available in large?", time: '10:42 AM' },
      { id: 'm2', sender: 'ai', text: "Yes, Junaid! We have the SM-99 Professional Series in stock for the Large size in Carbon Black. Would you like me to draft an order for you to review?", time: '10:43 AM' },
      { id: 'm3', sender: 'customer', text: "That sounds great. What's the current pricing for a bulk order of 5 units?", time: '10:45 AM' },
      { id: 'm3_1', sender: 'ai', text: "We have a special 5-pack pricing where the bulk discount applies automatically, lowering it to $249 per unit. I can set it up in your cart right now.", time: '10:46 AM' },
      { id: 'm3_2', sender: 'customer', text: "That is amazing. Go ahead and add that. Also, let me know when it will ship to Chittagong.", time: '10:48 AM' },
      { id: 'm3_3', sender: 'ai', text: "Shipping to Chittagong usually takes 2 business days via our premium local courier service. I have prepared the payload and sent the webhook.", time: '10:49 AM' },
      { id: 'm3_4', sender: 'customer', text: "Perfect. Ready to pay.", time: '10:50 AM' },
    ],
    lastProductViewed: 'Void Audio One',
    suggestedProducts: ['VA-ONE-BLK'],
    cart: [
      { sku: 'VA-ONE-BLK', quantity: 5 }
    ]
  },
  {
    id: 'chat-2',
    customerName: 'Sarah Chen',
    platform: 'instagram',
    lastMessage: "My shipment was delayed by 3 days. Ca...",
    time: '15m ago',
    unread: true,
    status: 'Active',
    isComplaint: true,
    messages: [
      { id: 'm5', sender: 'customer', text: "Hello, my shipment was delayed by 3 days. Can I get a partial refund? This is unacceptable.", time: '15m ago' }
    ],
    lastProductViewed: 'NX-402-B',
  },
  {
    id: 'chat-3',
    customerName: 'Marcus Thorne',
    platform: 'facebook',
    lastMessage: "Do you have this in midnight blue?",
    time: '1h ago',
    unread: false,
    status: 'AI Managed',
    messages: [
      { id: 'm6', sender: 'customer', text: "Hi, I am looking at the Titanium Chronos watch. Do you have this in midnight blue?", time: '1h ago' }
    ],
    lastProductViewed: 'TC-091-S',
  },
  {
    id: 'chat-4',
    customerName: 'Emily Watson',
    platform: 'instagram',
    lastMessage: "Is the Carbon Vessel dishwasher safe?",
    time: '2h ago',
    unread: false,
    status: 'AI Managed',
    messages: [
      { id: 'm10', sender: 'customer', text: 'Hi! I bought the Carbon Hydro Vessel yesterday. Is it dishwasher safe?', time: '2h ago' },
      { id: 'm10_1', sender: 'ai', text: 'Yes, Emily! The Carbon Hydro Vessel is 100% dishwasher safe. We recommend placing the lid on the top rack of your dishwasher for best longevity.', time: '2h ago' }
    ],
    lastProductViewed: 'Carbon Hydro Vessel',
  },
  {
    id: 'chat-5',
    customerName: 'Kabir Khan',
    platform: 'whatsapp',
    lastMessage: "Can you change my shipping address?",
    time: '4h ago',
    unread: false,
    status: 'Active',
    messages: [
      { id: 'm11', sender: 'customer', text: 'Hey Shopmate, I just placed an order. Can you change my shipping address to Road 12, Banani?', time: '4h ago' }
    ],
    lastProductViewed: 'Void Audio One',
    isComplaint: true,
  },
  {
    id: 'chat-6',
    customerName: 'Sofia Rodriguez',
    platform: 'facebook',
    lastMessage: "When will the Titanium Watch be back?",
    time: 'Yesterday',
    unread: false,
    status: 'AI Managed',
    messages: [
      { id: 'm12', sender: 'customer', text: 'Hello, when will the Titanium Watch be back in stock in gold color?', time: 'Yesterday' }
    ],
    lastProductViewed: 'Titanium Chronos v2',
  },
  {
    id: 'chat-7',
    customerName: 'David Miller',
    platform: 'whatsapp',
    lastMessage: "Can I pay with Bkash?",
    time: 'Yesterday',
    unread: false,
    status: 'AI Managed',
    messages: [
      { id: 'm13', sender: 'customer', text: 'Do you accept local mobile banking wallets like Bkash or Nagad?', time: 'Yesterday' }
    ],
    lastProductViewed: 'Void Audio One',
  },
  {
    id: 'chat-8',
    customerName: 'Anika Rahman',
    platform: 'instagram',
    lastMessage: "Do you deliver to Sylhet?",
    time: '2 days ago',
    unread: false,
    status: 'AI Managed',
    messages: [
      { id: 'm14', sender: 'customer', text: 'Hello, do you deliver to Sylhet, Bangladesh?', time: '2 days ago' }
    ],
    lastProductViewed: 'Nexus Mech Keyboard',
  },
  {
    id: 'chat-9',
    customerName: 'John Doe',
    platform: 'whatsapp',
    lastMessage: "Thanks for the quick refund",
    time: '3 days ago',
    unread: false,
    status: 'Closed',
    messages: [
      { id: 'm15', sender: 'customer', text: 'Thanks for the quick refund! Great customer service.', time: '3 days ago' }
    ],
    lastProductViewed: 'Void Audio One',
  }
];

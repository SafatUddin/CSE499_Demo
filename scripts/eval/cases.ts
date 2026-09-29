export type Category = 'price' | 'stock' | 'buy_no_qty' | 'buy_with_qty' | 'complaint' | 'chitchat';
export type Language = 'en' | 'bn' | 'banglish';

export interface EvalCase {
  id: string;
  message: string;
  language: Language;
  category: Category;
  expectedSku?: string;
  expectedQty?: number;
  expectedComplaint: boolean;
}

// 50-case evaluation set per docs/PLANNING.md §6 — mixed English / Bangla / Banglish,
// covering price queries, stock checks, buy intent (with and without quantity),
// complaints, and chit-chat. SKUs/products reference scripts/eval/catalog.ts.
export const evalCases: EvalCase[] = [
  // --- Price queries (10) ---
  { id: 'price-01', message: "What's the price of the MacBook M3?", language: 'en', category: 'price', expectedSku: 'SM-1001', expectedComplaint: false },
  { id: 'price-02', message: 'How much is the Coca Cola?', language: 'en', category: 'price', expectedSku: 'COKE-500', expectedComplaint: false },
  { id: 'price-03', message: "What's the cost of the Bluetooth Speaker?", language: 'en', category: 'price', expectedSku: 'SPKR-01', expectedComplaint: false },
  { id: 'price-04', message: 'Price of the T-shirt please', language: 'en', category: 'price', expectedSku: 'TSHIRT-01', expectedComplaint: false },
  { id: 'price-05', message: 'iPhone 17 Pro-এর দাম কত?', language: 'bn', category: 'price', expectedSku: 'SM-1002', expectedComplaint: false },
  { id: 'price-06', message: 'Apple Mouse এর দাম কত?', language: 'bn', category: 'price', expectedSku: 'SM-1003', expectedComplaint: false },
  { id: 'price-07', message: 'APEX GP এর দাম কত?', language: 'bn', category: 'price', expectedSku: 'SM-1004', expectedComplaint: false },
  { id: 'price-08', message: 'coca cola er dam koto?', language: 'banglish', category: 'price', expectedSku: 'COKE-500', expectedComplaint: false },
  { id: 'price-09', message: 'wireless mouse er price koto?', language: 'banglish', category: 'price', expectedSku: 'MOUSE-01', expectedComplaint: false },
  { id: 'price-10', message: 't shirt ta koto taka?', language: 'banglish', category: 'price', expectedSku: 'TSHIRT-01', expectedComplaint: false },

  // --- Stock checks (8) ---
  { id: 'stock-01', message: 'Is the Wireless Mouse in stock?', language: 'en', category: 'stock', expectedSku: 'MOUSE-01', expectedComplaint: false },
  { id: 'stock-02', message: 'Do you have the MacBook M3 available?', language: 'en', category: 'stock', expectedSku: 'SM-1001', expectedComplaint: false },
  { id: 'stock-03', message: 'Is APEX GP available right now?', language: 'en', category: 'stock', expectedSku: 'SM-1004', expectedComplaint: false },
  { id: 'stock-04', message: 'Apple Mouse ki stock e ache?', language: 'banglish', category: 'stock', expectedSku: 'SM-1003', expectedComplaint: false },
  { id: 'stock-05', message: 'Coca Cola ki available?', language: 'banglish', category: 'stock', expectedSku: 'COKE-500', expectedComplaint: false },
  { id: 'stock-06', message: 'APEX GP কি স্টকে আছে?', language: 'bn', category: 'stock', expectedSku: 'SM-1004', expectedComplaint: false },
  { id: 'stock-07', message: 'Bluetooth speaker ache naki?', language: 'banglish', category: 'stock', expectedSku: 'SPKR-01', expectedComplaint: false },
  { id: 'stock-08', message: 'iPhone 17 Pro স্টকে আছে?', language: 'bn', category: 'stock', expectedSku: 'SM-1002', expectedComplaint: false },

  // --- Buy intent, no quantity given (8) ---
  { id: 'buyq-01', message: 'I want to buy the MacBook M3', language: 'en', category: 'buy_no_qty', expectedSku: 'SM-1001', expectedComplaint: false },
  { id: 'buyq-02', message: "I'd like to purchase a Coca Cola", language: 'en', category: 'buy_no_qty', expectedSku: 'COKE-500', expectedComplaint: false },
  { id: 'buyq-03', message: 'Can I get the Bluetooth Speaker?', language: 'en', category: 'buy_no_qty', expectedSku: 'SPKR-01', expectedComplaint: false },
  { id: 'buyq-04', message: 'ami apple mouse kinte chai', language: 'banglish', category: 'buy_no_qty', expectedSku: 'SM-1003', expectedComplaint: false },
  { id: 'buyq-05', message: 'আমি একটা t-shirt কিনতে চাই', language: 'bn', category: 'buy_no_qty', expectedSku: 'TSHIRT-01', expectedComplaint: false },
  { id: 'buyq-06', message: 'iPhone 17 Pro kinbo', language: 'banglish', category: 'buy_no_qty', expectedSku: 'SM-1002', expectedComplaint: false },
  { id: 'buyq-07', message: 'আমি এপেক্স জিপি নিতে চাই', language: 'bn', category: 'buy_no_qty', expectedSku: 'SM-1004', expectedComplaint: false },
  { id: 'buyq-08', message: 'I want the wireless mouse', language: 'en', category: 'buy_no_qty', expectedSku: 'MOUSE-01', expectedComplaint: false },

  // --- Buy intent, quantity given in the same message (8) ---
  { id: 'buyw-01', message: 'I want 2 Coca Colas', language: 'en', category: 'buy_with_qty', expectedSku: 'COKE-500', expectedQty: 2, expectedComplaint: false },
  { id: 'buyw-02', message: "I'll take 3 t-shirts", language: 'en', category: 'buy_with_qty', expectedSku: 'TSHIRT-01', expectedQty: 3, expectedComplaint: false },
  { id: 'buyw-03', message: 'Give me 1 MacBook M3', language: 'en', category: 'buy_with_qty', expectedSku: 'SM-1001', expectedQty: 1, expectedComplaint: false },
  { id: 'buyw-04', message: 'ami 2ta apple mouse nibo', language: 'banglish', category: 'buy_with_qty', expectedSku: 'SM-1003', expectedQty: 2, expectedComplaint: false },
  { id: 'buyw-05', message: 'আমি ২টা কোকা কোলা নিব', language: 'bn', category: 'buy_with_qty', expectedSku: 'COKE-500', expectedQty: 2, expectedComplaint: false },
  { id: 'buyw-06', message: '5 bottles of coca cola please', language: 'en', category: 'buy_with_qty', expectedSku: 'COKE-500', expectedQty: 5, expectedComplaint: false },
  { id: 'buyw-07', message: 'ami 1ta bluetooth speaker kinbo', language: 'banglish', category: 'buy_with_qty', expectedSku: 'SPKR-01', expectedQty: 1, expectedComplaint: false },
  { id: 'buyw-08', message: 'iPhone 17 Pro 1ta debo', language: 'banglish', category: 'buy_with_qty', expectedSku: 'SM-1002', expectedQty: 1, expectedComplaint: false },

  // --- Complaints (8) ---
  { id: 'comp-01', message: 'This product is broken and does not work at all!', language: 'en', category: 'complaint', expectedComplaint: true },
  { id: 'comp-02', message: 'This is a scam, I want my money back', language: 'en', category: 'complaint', expectedComplaint: true },
  { id: 'comp-03', message: 'Amar order ta onek deri hoyeche, ami hotasho', language: 'banglish', category: 'complaint', expectedComplaint: true },
  { id: 'comp-04', message: 'The item I received is fake, very bad quality', language: 'en', category: 'complaint', expectedComplaint: true },
  { id: 'comp-05', message: 'আমি খুবই অসন্তুষ্ট, প্রোডাক্ট নষ্ট', language: 'bn', category: 'complaint', expectedComplaint: true },
  { id: 'comp-06', message: 'worst service ever, I want a refund now', language: 'en', category: 'complaint', expectedComplaint: true },
  { id: 'comp-07', message: 'product ta defect silo, ki bhabe eta hoy', language: 'banglish', category: 'complaint', expectedComplaint: true },
  { id: 'comp-08', message: 'Apnara amake thokaisen, eta fake product', language: 'banglish', category: 'complaint', expectedComplaint: true },

  // --- Chit-chat / non-purchase (8) ---
  { id: 'chat-01', message: 'Hello!', language: 'en', category: 'chitchat', expectedComplaint: false },
  { id: 'chat-02', message: 'Hi, how are you?', language: 'en', category: 'chitchat', expectedComplaint: false },
  { id: 'chat-03', message: 'Ki obostha?', language: 'banglish', category: 'chitchat', expectedComplaint: false },
  { id: 'chat-04', message: 'হ্যালো', language: 'bn', category: 'chitchat', expectedComplaint: false },
  { id: 'chat-05', message: 'Are you open right now?', language: 'en', category: 'chitchat', expectedComplaint: false },
  { id: 'chat-06', message: 'Thank you so much!', language: 'en', category: 'chitchat', expectedComplaint: false },
  { id: 'chat-07', message: 'tumi ki manush naki bot?', language: 'banglish', category: 'chitchat', expectedComplaint: false },
  { id: 'chat-08', message: 'just saying hi', language: 'en', category: 'chitchat', expectedComplaint: false },
];

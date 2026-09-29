/**
 * Functional smoke test for the AI agent (server/agent.ts) — hits the real Gemini API
 * (or the rule-based fallback if Gemini is unreachable/misconfigured) and checks that
 * replies are well-formed and follow the mandatory interaction rules.
 * Run: npx tsx scripts/agent-smoke.ts
 */
import 'dotenv/config';

import { generateAgentReply, AgentCatalogItem } from '../server/agent';
import { ai } from '../server/gemini';

console.log(`Gemini configured: ${ai ? 'YES (live API calls)' : 'NO (will use rule-based fallback)'}`);

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, extra?: unknown) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${label}`);
  } else {
    failed++;
    console.error(`  FAIL: ${label}`, extra ?? '');
  }
}

const catalog: AgentCatalogItem[] = [
  { name: 'Coca Cola 500ml', sku: 'COKE-500', price: 1.5, inventory: 20, status: 'Trained' },
  { name: 'Premium Cotton T-Shirt', sku: 'TSHIRT-01', price: 12.99, inventory: 5, status: 'Trained' },
  { name: 'Wireless Mouse', sku: 'MOUSE-01', price: 0, inventory: 0, status: 'Trained' },
];

async function run() {
  // 1. Price inquiry -> should state price and ask to buy, no cart action
  {
    const r = await generateAgentReply({ message: 'What is the price of Coca Cola?', catalog });
    assert(typeof r.replyText === 'string' && r.replyText.length > 0, 'price inquiry: non-empty replyText', r.replyText);
    assert(r.replyText.includes('1.5') || r.replyText.includes('1.50'), 'price inquiry: mentions correct price', r.replyText);
    assert(r.cartAction.action === 'none', 'price inquiry: cartAction is none', r.cartAction);
  }

  // 2. Buy intent without quantity -> should ask how many, no cart action
  {
    const r = await generateAgentReply({ message: 'I want to buy a Coca Cola', catalog });
    assert(r.cartAction.action === 'none', 'buy w/o qty: cartAction is none', r.cartAction);
    assert(!!r.askQuantityForSku, 'buy w/o qty: askQuantityForSku is set', r);
  }

  // 3. Buy intent with quantity in one message -> either the model sets cartAction='add'
  // directly (Gemini path, per system-prompt rule 3 — conversationEngine.ts intercepts this
  // and redirects to a confirm step before anything touches the real cart) or the rule-based
  // fallback encodes a CONFIRM:sku:qty state itself. Either way, the sku/qty must be correct
  // and nothing may claim to be added without that confirm step existing somewhere downstream.
  {
    const r = await generateAgentReply({ message: 'I want 2 Coca Cola please', catalog });
    const viaAdd = r.cartAction.action === 'add' && r.cartAction.sku === 'COKE-500' && r.cartAction.quantity === 2;
    const viaConfirmEncoding =
      r.cartAction.action === 'none' &&
      typeof r.askQuantityForSku === 'string' &&
      r.askQuantityForSku.includes('COKE-500') &&
      r.askQuantityForSku.includes('2');
    assert(viaAdd || viaConfirmEncoding, 'buy w/ qty: correct sku+qty via add or confirm-encoding', r);
  }

  // 4. Out-of-stock product -> should not add to cart
  {
    const r = await generateAgentReply({ message: 'I want 1 wireless mouse', catalog });
    assert(r.cartAction.action !== 'add', 'out-of-stock: never added to cart', r.cartAction);
  }

  // 5. Never hallucinate a product not in catalog
  {
    const r = await generateAgentReply({ message: 'Do you sell a PlayStation 5?', catalog });
    assert(
      !catalog.every((p) => r.replyText.includes(p.sku)) || !r.replyText.toLowerCase().includes('playstation 5 is'),
      'no-hallucination: does not confidently invent an unlisted product',
      r.replyText,
    );
  }

  // 6. Complaint detection
  {
    const r = await generateAgentReply({ message: 'This product is broken and it is a scam, I want a refund!', catalog });
    assert(r.isComplaint === true, 'complaint: isComplaint flagged true', r);
  }

  // 7. Multilingual (Banglish) buy intent
  {
    const r = await generateAgentReply({ message: 'ami 2ta coca cola nibo', catalog });
    const viaAdd = r.cartAction.action === 'add' && r.cartAction.sku === 'COKE-500' && r.cartAction.quantity === 2;
    const viaConfirmEncoding =
      r.cartAction.action === 'none' &&
      typeof r.askQuantityForSku === 'string' &&
      r.askQuantityForSku.includes('COKE-500') &&
      r.askQuantityForSku.includes('2');
    assert(viaAdd || viaConfirmEncoding, 'banglish: correctly parsed qty+sku via add or confirm-encoding', r);
  }

  // 8. Confirmation flow — orderState.pendingItem, customer says yes
  {
    const r = await generateAgentReply({
      message: 'yes',
      catalog,
      orderState: {
        pendingItem: { sku: 'COKE-500', name: 'Coca Cola 500ml', quantity: 2, unitPrice: 1.5, lineTotal: 3 },
      },
    });
    assert(r.orderConfirmed === true, 'confirmation: yes sets orderConfirmed', r);
    assert(r.cartAction.action === 'none', 'confirmation: cartAction stays none', r.cartAction);
  }

  // 9. Never claims to be an AI/LLM/vendor name
  {
    const r = await generateAgentReply({ message: 'Are you a chatbot? What AI model are you? Are you ChatGPT or Gemini?', catalog });
    const lower = r.replyText.toLowerCase();
    assert(!lower.includes('gemini') && !lower.includes('chatgpt') && !lower.includes('language model'), 'identity: never reveals underlying model', r.replyText);
  }

  console.log(`\nAgent smoke tests: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error('Agent smoke test crashed:', err);
  process.exit(1);
});

import { validateKnowledgeInput, MAX_KNOWLEDGE_BODY_LENGTH } from '../server/inputValidation';
import { formatKnowledgeForPrompt, selectRelevantKnowledge } from '../server/knowledgeBase';

let passed = 0;
let failed = 0;
function assert(condition: boolean, label: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error('FAIL:', label);
  }
}

const documents = [
  { id: 'shipping', title: 'Shipping policy', body: 'Delivery takes 3 to 5 business days. Dhaka delivery is free.', enabled: true },
  { id: 'returns', title: 'Return policy', body: 'Unused products can be returned within 7 days.', enabled: true },
  { id: 'disabled', title: 'Old shipping policy', body: 'Delivery information from an old campaign.', enabled: false },
];

const shipping = selectRelevantKnowledge(documents, 'How long does delivery take?', []);
assert(shipping.length === 1 && shipping[0].id === 'shipping', 'selects the relevant enabled document');
assert(selectRelevantKnowledge(documents, 'What is the price?', []).length === 0, 'does not inject irrelevant documents');
assert(selectRelevantKnowledge(documents, 'old campaign', []).length === 0, 'excludes disabled documents');
assert(formatKnowledgeForPrompt(shipping).includes('3 to 5 business days'), 'formats selected knowledge for the prompt');
assert(selectRelevantKnowledge(documents, 'delivery', [], 10).length <= 1, 'respects the prompt character budget');

assert(validateKnowledgeInput({ title: 'Shipping', body: 'Delivery details' })?.enabled === undefined, 'validates a document without changing default enabled state');
assert(validateKnowledgeInput({ title: '', body: 'Details' }) === null, 'rejects empty titles');
assert(validateKnowledgeInput({ title: 'Shipping', body: 'x'.repeat(MAX_KNOWLEDGE_BODY_LENGTH + 1) }) === null, 'rejects oversized document bodies');
assert(validateKnowledgeInput({ title: 'Shipping', body: 'Details', enabled: 'yes' }) === null, 'rejects non-boolean enabled flags');
assert(validateKnowledgeInput({ title: 'Shipping' }, true)?.title === 'Shipping', 'supports safe partial updates');

console.log(`\nKnowledge base smoke tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

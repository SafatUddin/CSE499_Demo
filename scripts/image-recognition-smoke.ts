import {
  MAX_INBOUND_IMAGE_BYTES,
  normalizeImageRecognitionResult,
  validateInboundImage,
} from '../server/imageRecognition';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) passed++;
  else {
    failed++;
    console.error('FAIL:', label);
  }
}

const catalog = [
  { name: 'Red Shirt', sku: 'SHIRT-RED', price: 20, imageUrl: 'https://example.com/red.jpg' },
  { name: 'Blue Shirt', sku: 'SHIRT-BLUE', price: 20, imageUrl: 'https://example.com/blue.jpg' },
];

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
assert(validateInboundImage(jpeg)?.mime === 'image/jpeg', 'accepts JPEG magic bytes');
assert(validateInboundImage(png)?.mime === 'image/png', 'accepts PNG magic bytes');
assert(validateInboundImage(Buffer.from('not an image')) === null, 'rejects non-image bytes');
assert(validateInboundImage(Buffer.alloc(MAX_INBOUND_IMAGE_BYTES + 1)) === null, 'rejects oversized images');

const exact = normalizeImageRecognitionResult({
  match: 'exact',
  candidates: [{ sku: 'SHIRT-RED', confidence: 0.94, reason: 'same color and cut' }],
}, catalog);
assert(exact.match === 'exact' && exact.sku === 'SHIRT-RED', 'keeps exact catalog match');

const ambiguous = normalizeImageRecognitionResult({
  match: 'ambiguous',
  candidates: [
    { sku: 'SHIRT-BLUE', confidence: 0.71, reason: 'similar shape' },
    { sku: 'SHIRT-RED', confidence: 0.68, reason: 'similar shape' },
  ],
}, catalog);
assert(ambiguous.sku === null && ambiguous.candidates.length === 2, 'does not auto-select ambiguous match');

const foreign = normalizeImageRecognitionResult({
  match: 'exact',
  candidates: [{ sku: 'OTHER-STORE-SKU', confidence: 1, reason: 'spoofed' }],
}, catalog);
assert(foreign.match === 'none' && foreign.sku === null, 'rejects SKU outside the supplied store catalog');

const clamped = normalizeImageRecognitionResult({
  candidates: [{ sku: 'SHIRT-RED', confidence: 42, reason: 'bad model value' }],
}, catalog);
assert(clamped.confidence === 1 && clamped.sku === 'SHIRT-RED', 'clamps confidence and derives safe exact match');

console.log(`\nImage recognition smoke tests: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

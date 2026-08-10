/**
 * Smoke tests for Security Phase 7 input validation helpers.
 * Run: npx tsx scripts/validate-input-smoke.ts
 */
import {
  validateProductInput,
  sanitizeCartInput,
  validateCartSkusInStore,
  validateAvatarUrl,
  conversationPatchHasOnlyAllowedKeys,
  MAX_PASSWORD_LENGTH,
} from '../server/inputValidation';
import { isPasswordStrongEnough, MIN_PASSWORD_LENGTH } from '../server/auth';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error('FAIL:', label);
  }
}

// Product validation
assert(validateProductInput({ name: 'Widget', sku: 'W-1', price: 9.99, inventory: 5 }) !== null, 'valid product');
assert(validateProductInput({ name: 'Widget', sku: 'W-1', price: -1, inventory: 5 }) === null, 'negative price');
assert(validateProductInput({ name: 'Widget', sku: 'W-1', price: NaN, inventory: 5 }) === null, 'NaN price');
assert(validateProductInput({ name: 'Widget', sku: 'W-1', price: Infinity, inventory: 5 }) === null, 'Infinity price');
assert(validateProductInput({ name: 'Widget', sku: 'W-1', price: 0, inventory: -1 }) === null, 'negative inventory');
assert(validateProductInput({ name: 'Widget', sku: 'W-1', price: 0, inventory: 1.5 }) === null, 'fractional inventory');
assert(validateProductInput({ name: 'Widget', sku: 'W-1', price: 0, inventory: 2_000_000 }) === null, 'oversized inventory');
assert(validateProductInput({ name: '', sku: 'W-1', price: 0, inventory: 0 }) === null, 'empty name');
assert(validateProductInput({ name: ['x'], sku: 'W-1', price: 0, inventory: 0 }) === null, 'array name');

// Cart validation
assert(sanitizeCartInput([{ sku: 'A', quantity: 2 }]) !== null, 'valid cart');
assert(sanitizeCartInput([{ sku: 'A', quantity: 0 }]) === null, 'zero quantity');
assert(sanitizeCartInput([{ sku: 'A', quantity: -1 }]) === null, 'negative quantity');
assert(sanitizeCartInput([{ sku: 'A', quantity: 1.5 }]) === null, 'fractional quantity');
assert(sanitizeCartInput([{ sku: 'A', quantity: 99999 }]) === null, 'huge quantity');
assert(sanitizeCartInput([{ sku: '', quantity: 1 }]) === null, 'malformed SKU');
assert(sanitizeCartInput([{ sku: 'A', quantity: 1, extra: true }]) === null, 'arbitrary cart properties');
assert(
  validateCartSkusInStore([{ sku: 'A', quantity: 1 }], new Set(['B'])) === false,
  'foreign-store SKU',
);
assert(
  validateCartSkusInStore([{ sku: 'A', quantity: 1 }], new Set(['A'])) === true,
  'known SKU',
);

// Mass assignment guard
assert(
  conversationPatchHasOnlyAllowedKeys({ status: 'Active', awaitingQuantityFor: 'evil' }) === false,
  'security-sensitive field rejected',
);
assert(conversationPatchHasOnlyAllowedKeys({ cart: [] }) === true, 'allowed cart patch');

// Password validation
assert(isPasswordStrongEnough('1234567') === false, 'password too short');
assert(isPasswordStrongEnough('12345678') === true, 'password min length ok');
assert(isPasswordStrongEnough('x'.repeat(MAX_PASSWORD_LENGTH + 1)) === false, 'password too long');
assert(isPasswordStrongEnough(12345678) === false, 'non-string password');

// Avatar URL validation
assert(validateAvatarUrl('https://example.com/a.png') === true, 'valid https URL');
assert(validateAvatarUrl('javascript:alert(1)') === false, 'javascript URL rejected');
assert(validateAvatarUrl('data:image/png;base64,abc') === false, 'data URL rejected');
assert(validateAvatarUrl('file:///etc/passwd') === false, 'file URL rejected');
assert(validateAvatarUrl('https://example.com/' + 'a'.repeat(3000)) === false, 'oversized URL rejected');

console.log(`\nValidation smoke tests: ${passed} passed, ${failed} failed (min password length: ${MIN_PASSWORD_LENGTH})`);
process.exit(failed > 0 ? 1 : 0);

import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidGa4ClientId, purchaseParameters } from '../services/analytics.js';

test('GA client IDs accept the gtag client ID shape and reject arbitrary values', () => {
  assert.equal(isValidGa4ClientId('1234567890.9876543210'), true);
  assert.equal(isValidGa4ClientId('email@example.com'), false);
  assert.equal(isValidGa4ClientId('1234.abc'), false);
  assert.equal(isValidGa4ClientId('1'.repeat(90)), false);
  assert.equal(isValidGa4ClientId(null), false);
});

test('purchase attribution sends the fixed CandidFan offer and a non-identifying transaction reference', () => {
  const first = purchaseParameters('payment-request-123');
  const again = purchaseParameters('payment-request-123');
  assert.deepEqual(first, again);
  assert.equal(first.transaction_id.startsWith('cf_'), true);
  assert.equal(first.transaction_id.includes('payment-request-123'), false);
  assert.equal(first.currency, 'EUR');
  assert.equal(first.value, 50);
  assert.equal(first.items[0].item_id, 'candidfan_lifetime_premium');
});

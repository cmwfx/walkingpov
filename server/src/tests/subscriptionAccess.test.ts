import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveMembership } from '../services/subscriptionAccess.js';

test('stored CandidFan premium status remains premium without consulting archived integration grants', () => {
  assert.deepEqual(effectiveMembership('premium'), { membership_status: 'premium', premium_plan: 'lifetime' });
});

test('non-premium CandidFan membership states are preserved exactly', () => {
  for (const status of ['free', 'pending', 'denied'] as const) {
    assert.deepEqual(effectiveMembership(status), { membership_status: status, premium_plan: null });
  }
});

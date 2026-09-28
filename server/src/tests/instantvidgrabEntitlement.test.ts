import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  canonicalEntitlementPayload,
  instantVidGrabEntitlementSchema,
} from '../services/instantvidgrabEntitlement.js';

const common = {
  payloadHash: 'a'.repeat(64),
  walkingpovUserId: '123e4567-e89b-42d3-a456-426614174000',
  instantvidgrabUserId: 'ivg_synthetic_user',
  grantState: 'active' as const,
  grantVersion: 1,
};

test('legacy order-event payload keeps its exact provider-neutral idempotency bytes', () => {
  const parsed = instantVidGrabEntitlementSchema.parse({
    ...common,
    eventId: 'ivg:ord_0123456789abcdef0123456789abcdef:1',
    sourceId: 'ord_0123456789abcdef0123456789abcdef',
  });
  const canonical = canonicalEntitlementPayload(parsed);

  assert.equal(parsed.sourceType, 'instantvidgrab_order');
  assert.equal(canonical, JSON.stringify({
    eventId: 'ivg:ord_0123456789abcdef0123456789abcdef:1',
    walkingpovUserId: common.walkingpovUserId,
    instantvidgrabUserId: common.instantvidgrabUserId,
    sourceId: 'ord_0123456789abcdef0123456789abcdef',
    grantState: 'active',
    grantVersion: 1,
  }));
});

test('manual grant events bind source type and omit provider/payment data', () => {
  const parsed = instantVidGrabEntitlementSchema.parse({
    ...common,
    eventId: 'ivg:manual:man_0123456789abcdef0123456789abcdef:1',
    sourceType: 'manual',
    sourceId: 'man_0123456789abcdef0123456789abcdef',
  });
  const canonical = canonicalEntitlementPayload(parsed);
  const hash = createHash('sha256').update(canonical, 'utf8').digest('hex');

  assert.deepEqual(JSON.parse(canonical), {
    eventId: 'ivg:manual:man_0123456789abcdef0123456789abcdef:1',
    sourceType: 'manual',
    walkingpovUserId: common.walkingpovUserId,
    instantvidgrabUserId: common.instantvidgrabUserId,
    sourceId: 'man_0123456789abcdef0123456789abcdef',
    grantState: 'active',
    grantVersion: 1,
  });
  assert.equal(hash, createHash('sha256').update(canonical, 'utf8').digest('hex'));
  assert.doesNotMatch(canonical, /whop|payment|checkout|origin|walkingpov_domain/i);
});

test('source IDs must match their source type and provider-specific fields are rejected', () => {
  assert.equal(instantVidGrabEntitlementSchema.safeParse({
    ...common,
    eventId: 'ivg:manual:man_0123456789abcdef0123456789abcdef:1',
    sourceType: 'manual',
    sourceId: 'ord_0123456789abcdef0123456789abcdef',
  }).success, false);
  assert.equal(instantVidGrabEntitlementSchema.safeParse({
    ...common,
    eventId: 'ivg:ord_0123456789abcdef0123456789abcdef:1',
    sourceId: 'ord_0123456789abcdef0123456789abcdef',
    paymentId: 'pay_provider_id',
  }).success, false);
});

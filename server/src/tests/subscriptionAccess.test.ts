import assert from 'node:assert/strict';
import test from 'node:test';
import { derivePremiumPlan } from '../services/membershipPlan.js';
import { deriveWalkingPOVAccessSnapshot } from '../services/instantvidgrabHandoff.js';

test('monthly access expires at the paid boundary and independent lifetime access survives', () => {
  const now=Date.parse('2026-10-07T12:00:00Z');
  const monthly={source_type:'instantvidgrab_subscription',state:'active',expires_at:'2026-10-07T12:00:00Z'};
  assert.equal(derivePremiumPlan([monthly],now),null);
  assert.equal(derivePremiumPlan([{...monthly,expires_at:'2026-10-08T12:00:00Z'}],now),'monthly');
  assert.equal(derivePremiumPlan([monthly,{source_type:'legacy_payment_request',state:'active',expires_at:null}],now),'lifetime');
  assert.equal(derivePremiumPlan([{...monthly,state:'suspended',expires_at:'2026-10-08T12:00:00Z'}],now),null);
});
test('monthly grants cannot create a permanent legacy snapshot or change its version',()=>{
  const lifetime={product:'walkingpov',source_type:'instantvidgrab_order',state:'active',version:3};
  const monthly={product:'walkingpov',source_type:'instantvidgrab_subscription',state:'active',version:5};
  assert.deepEqual(deriveWalkingPOVAccessSnapshot([monthly]),{legacyPremium:false,legacyGrantVersion:0});
  assert.deepEqual(deriveWalkingPOVAccessSnapshot([lifetime,monthly]),{legacyPremium:true,legacyGrantVersion:3});
});

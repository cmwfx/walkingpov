import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  legacyDirectDownloadsEnabled,
  legacyGiftCardSubmissionsEnabled,
  instantVidGrabCheckoutEnabled,
  instantVidGrabDownloadsEnabled,
  instantVidGrabLegacyMemberMigrationEnabled,
  instantVidGrabLegacyMemberMigrationSandboxConfigured,
} from '../services/legacyFeatureFlags.js';

test('legacy gift-card submissions default to disabled and require an explicit true flag', () => {
  assert.equal(legacyGiftCardSubmissionsEnabled(undefined), false);
  assert.equal(legacyGiftCardSubmissionsEnabled('false'), false);
  assert.equal(legacyGiftCardSubmissionsEnabled('TRUE'), false);
  assert.equal(legacyGiftCardSubmissionsEnabled('true'), true);
});

test('legacy direct downloads default to disabled and require an explicit true flag', () => {
  assert.equal(legacyDirectDownloadsEnabled(undefined), false);
  assert.equal(legacyDirectDownloadsEnabled('false'), false);
  assert.equal(legacyDirectDownloadsEnabled('true'), true);
});

test('InstantVidGrab checkout and download routing default to disabled and require explicit flags', () => {
  assert.equal(instantVidGrabCheckoutEnabled(undefined), false);
  assert.equal(instantVidGrabCheckoutEnabled('false'), false);
  assert.equal(instantVidGrabCheckoutEnabled('true'), true);
  assert.equal(instantVidGrabDownloadsEnabled(undefined), false);
  assert.equal(instantVidGrabDownloadsEnabled('false'), false);
  assert.equal(instantVidGrabDownloadsEnabled('true'), true);
});

test('legacy member migration defaults to disabled and requires an explicit true flag', () => {
  assert.equal(instantVidGrabLegacyMemberMigrationEnabled(undefined), false);
  assert.equal(instantVidGrabLegacyMemberMigrationEnabled('false'), false);
  assert.equal(instantVidGrabLegacyMemberMigrationEnabled('TRUE'), false);
  assert.equal(instantVidGrabLegacyMemberMigrationEnabled('true'), true);
});

test('legacy member migration requires a matching non-production Supabase branch URL', () => {
  assert.equal(instantVidGrabLegacyMemberMigrationSandboxConfigured({
    environment: 'sandbox',
    sandboxProjectRef: 'sandboxref1234567890',
    supabaseUrl: 'https://sandboxref1234567890.supabase.co',
  }), true);
  assert.equal(instantVidGrabLegacyMemberMigrationSandboxConfigured({
    environment: 'sandbox',
    sandboxProjectRef: 'ghredjydntjlfykgrqqq',
    supabaseUrl: 'https://ghredjydntjlfykgrqqq.supabase.co',
  }), false);
  assert.equal(instantVidGrabLegacyMemberMigrationSandboxConfigured({
    environment: 'sandbox',
    sandboxProjectRef: 'sandboxref1234567890',
    supabaseUrl: 'https://ghredjydntjlfykgrqqq.supabase.co',
  }), false);
  assert.equal(instantVidGrabLegacyMemberMigrationSandboxConfigured({
    environment: 'sandbox',
    sandboxProjectRef: 'sandboxref1234567890',
    supabaseUrl: 'https://sandboxref1234567890.supabase.co:5443',
  }), false);
  assert.equal(instantVidGrabLegacyMemberMigrationSandboxConfigured({
    environment: 'production',
    sandboxProjectRef: 'sandboxref1234567890',
    supabaseUrl: 'https://sandboxref1234567890.supabase.co',
  }), false);
});

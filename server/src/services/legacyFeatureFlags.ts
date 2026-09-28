export function legacyGiftCardSubmissionsEnabled(value = process.env.LEGACY_GIFTCARD_SUBMISSIONS_ENABLED) {
  return value === 'true';
}

export function legacyDirectDownloadsEnabled(value = process.env.LEGACY_DIRECT_DOWNLOADS_ENABLED) {
  return value === 'true';
}

export function instantVidGrabCheckoutEnabled(value = process.env.INSTANTVIDGRAB_CHECKOUT_ENABLED) {
  return value === 'true';
}

export function instantVidGrabDownloadsEnabled(value = process.env.INSTANTVIDGRAB_DOWNLOADS_ENABLED) {
  return value === 'true';
}

export function instantVidGrabLegacyMemberMigrationEnabled(
  value = process.env.INSTANTVIDGRAB_LEGACY_MEMBER_MIGRATION_ENABLED,
) {
  return value === 'true';
}

const WALKINGPOV_PRODUCTION_SUPABASE_REF = 'ghredjydntjlfykgrqqq';

export function instantVidGrabLegacyMemberMigrationSandboxConfigured(input: {
  environment?: string;
  sandboxProjectRef?: string;
  supabaseUrl?: string;
} = {
  environment: process.env.INSTANTVIDGRAB_LEGACY_MEMBER_MIGRATION_ENV,
  sandboxProjectRef: process.env.INSTANTVIDGRAB_LEGACY_MEMBER_MIGRATION_SANDBOX_SUPABASE_REF,
  supabaseUrl: process.env.SUPABASE_URL,
}) {
  const ref = input.sandboxProjectRef || '';
  if (
    input.environment !== 'sandbox' ||
    !/^[a-z0-9]{20}$/.test(ref) ||
    ref === WALKINGPOV_PRODUCTION_SUPABASE_REF
  ) return false;

  try {
    const url = new URL(input.supabaseUrl || '');
    return url.protocol === 'https:'
      && url.hostname === `${ref}.supabase.co`
      && !url.port
      && !url.username
      && !url.password
      && (url.pathname === '/' || url.pathname === '')
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}

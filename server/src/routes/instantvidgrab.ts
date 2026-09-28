import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { AuthRequest, verifyToken } from '../middleware/auth.js';
import { requireIvgInternalAuth } from '../middleware/ivgInternalAuth.js';
import { verifyCsrfToken } from '../middleware/csrf.js';
import { supabaseAdmin } from '../config/supabase.js';
import { signMediaKey } from '../services/mediaSignature.js';
import {
  resolveAuthorizedWalkingPOVVideo,
  VideoResolutionError,
} from '../services/instantvidgrabVideoResolution.js';
import {
  buildInstantVidGrabCallback,
  createAuthorizationCode,
  createVerifierChallenge,
  digestAuthorizationValue,
  deriveWalkingPOVAccessSnapshot,
  instantVidGrabAuthorizationSchema,
  instantVidGrabExchangeSchema,
  instantVidGrabLinkSchema,
} from '../services/instantvidgrabHandoff.js';
import {
  canonicalEntitlementPayload,
  instantVidGrabEntitlementSchema,
} from '../services/instantvidgrabEntitlement.js';
import {
  buildLegacyMemberMigrationPage,
  type LegacyMigrationGrant,
} from '../services/instantvidgrabLegacyMemberMigration.js';
import {
  instantVidGrabCheckoutEnabled,
  instantVidGrabDownloadsEnabled,
  instantVidGrabLegacyMemberMigrationEnabled,
  instantVidGrabLegacyMemberMigrationSandboxConfigured,
} from '../services/legacyFeatureFlags.js';

const router = Router();
const AUTH_CODE_LIFETIME_MS = 2 * 60 * 1_000;

// Keep only the incoming, signed fulfillment callback available while orders
// that were already in checkout are reconciled. All user/account integration
// endpoints remain retired.
router.use((req, res, next) => {
  if (req.path === "/entitlements") return next();
  return res.status(410).json({ error: { code: "integration_removed" } });
});

const instantVidGrabVideoResolutionSchema = z.object({
  walkingpovUserId: z.string().uuid(),
  instantvidgrabUserId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/),
  videoId: z.string().uuid(),
}).strict();

const legacyMemberMigrationPageSchema = z.object({
  afterGrantId: z.string().uuid().nullable().default(null),
  limit: z.number().int().min(1).max(50).default(25),
  mode: z.enum(['dry_run', 'apply']),
}).strict();

function callbackUrl() {
  const configured = process.env.INSTANTVIDGRAB_AUTHORIZATION_CALLBACK_URL || '';
  try {
    return buildInstantVidGrabCallback(configured, 'synthetic-code', 'synthetic-state').split('?')[0];
  } catch {
    return null;
  }
}

router.post('/authorize', verifyToken, verifyCsrfToken, async (req: AuthRequest, res) => {
  const input = instantVidGrabAuthorizationSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Invalid account handoff request.' });
  if (input.data.intent === 'checkout' && !instantVidGrabCheckoutEnabled()) {
    return res.status(503).json({ error: 'Card checkout is temporarily unavailable.' });
  }
  if (input.data.intent === 'download' && !instantVidGrabDownloadsEnabled()) {
    return res.status(503).json({ error: 'Secure downloads are temporarily unavailable.' });
  }
  if (!req.user?.email_verified) return res.status(403).json({ error: 'Verify your CandidFan email before continuing.' });

  const configuredCallback = callbackUrl();
  if (!configuredCallback) return res.status(503).json({ error: 'Account connection is temporarily unavailable.' });

  try {
    const { data: sourceUser, error: sourceError } = await supabaseAdmin.auth.admin.getUserById(req.user.id);
    if (sourceError || !sourceUser.user?.email || !sourceUser.user.email_confirmed_at) {
      return res.status(403).json({ error: 'Verify your CandidFan email before continuing.' });
    }

    const { data: existingLink, error: linkError } = await supabaseAdmin
      .from('ivg_identity_links')
      .select('instantvidgrab_user_id, state')
      .eq('walkingpov_user_id', req.user.id)
      .maybeSingle();
    if (linkError) throw linkError;

    const code = createAuthorizationCode();
    const expiresAt = new Date(Date.now() + AUTH_CODE_LIFETIME_MS).toISOString();
    const { error: insertError } = await supabaseAdmin.from('ivg_auth_codes').insert({
      code_hash: digestAuthorizationValue(code),
      walkingpov_user_id: req.user.id,
      instantvidgrab_user_id: existingLink?.state === 'verified' ? existingLink.instantvidgrab_user_id : null,
      state_hash: digestAuthorizationValue(input.data.state),
      verifier_challenge: input.data.challenge,
      intent: input.data.intent,
      destination: input.data.intent === 'checkout' ? 'checkout' : input.data.intent === 'download' ? 'download' : 'dashboard',
      selected_video_id: input.data.selectedVideoId || null,
      expires_at: expiresAt,
      consumed_at: null,
    });
    if (insertError) throw insertError;

    return res.json({
      redirect_to: buildInstantVidGrabCallback(configuredCallback, code, input.data.state),
      expires_at: expiresAt,
    });
  } catch {
    console.error('ivg-authorization-issue-failed');
    return res.status(503).json({ error: 'Account connection is temporarily unavailable.' });
  }
});

router.post('/exchange', requireIvgInternalAuth, async (req, res) => {
  const input = instantVidGrabExchangeSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'invalid_authorization_code' } });

  try {
    const now = new Date().toISOString();
    const { data: authCode, error: consumeError } = await supabaseAdmin
      .from('ivg_auth_codes')
      .update({ consumed_at: now })
      .eq('code_hash', digestAuthorizationValue(input.data.code))
      .eq('state_hash', digestAuthorizationValue(input.data.state))
      .eq('verifier_challenge', createVerifierChallenge(input.data.verifier))
      .is('consumed_at', null)
      .gt('expires_at', now)
      .select('walkingpov_user_id, instantvidgrab_user_id, intent, destination, selected_video_id')
      .maybeSingle();

    if (consumeError) throw consumeError;
    if (!authCode) return res.status(401).json({ error: { code: 'invalid_authorization_code' } });
    if ((authCode.intent === 'checkout' && !instantVidGrabCheckoutEnabled())
      || (authCode.intent === 'download' && !instantVidGrabDownloadsEnabled())) {
      return res.status(503).json({ error: { code: 'feature_unavailable' } });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(authCode.walkingpov_user_id);
    const verifiedUser = authData.user;
    if (authError || !verifiedUser?.email || !verifiedUser.email_confirmed_at) {
      return res.status(403).json({ error: { code: 'verified_identity_required' } });
    }

    const { data: grants, error: grantsError } = await supabaseAdmin
      .from('ivg_access_grants')
      .select('product, state, version')
      .eq('user_id', authCode.walkingpov_user_id)
      .eq('product', 'walkingpov');
    if (grantsError) throw grantsError;
    const accessSnapshot = deriveWalkingPOVAccessSnapshot(grants || []);

    return res.json({
      walkingpovUserId: authCode.walkingpov_user_id,
      instantvidgrabUserId: authCode.instantvidgrab_user_id,
      email: verifiedUser.email,
      intent: authCode.intent,
      destination: authCode.destination,
      selectedVideoId: authCode.selected_video_id,
      ...accessSnapshot,
    });
  } catch {
    console.error('ivg-authorization-exchange-failed');
    return res.status(503).json({ error: { code: 'integration_unavailable' } });
  }
});

router.post('/link', requireIvgInternalAuth, async (req, res) => {
  const input = instantVidGrabLinkSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'invalid_identity_link' } });

  try {
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.getUserById(input.data.walkingpovUserId);
    if (authError || !authData.user?.email_confirmed_at) {
      return res.status(403).json({ error: { code: 'verified_identity_required' } });
    }

    const [sourceResult, targetResult] = await Promise.all([
      supabaseAdmin.from('ivg_identity_links').select('instantvidgrab_user_id, state').eq('walkingpov_user_id', input.data.walkingpovUserId).maybeSingle(),
      supabaseAdmin.from('ivg_identity_links').select('walkingpov_user_id, state').eq('instantvidgrab_user_id', input.data.instantvidgrabUserId).maybeSingle(),
    ]);
    if (sourceResult.error || targetResult.error) throw sourceResult.error || targetResult.error;

    const { data: grants, error: grantsError } = await supabaseAdmin
      .from('ivg_access_grants')
      .select('product, state, version')
      .eq('user_id', input.data.walkingpovUserId)
      .eq('product', 'walkingpov');
    if (grantsError) throw grantsError;
    const accessSnapshot = deriveWalkingPOVAccessSnapshot(grants || []);

    const sourceLink = sourceResult.data;
    const targetLink = targetResult.data;
    if (sourceLink || targetLink) {
      const matches = sourceLink?.instantvidgrab_user_id === input.data.instantvidgrabUserId
        && targetLink?.walkingpov_user_id === input.data.walkingpovUserId
        && sourceLink?.state !== 'revoked'
        && targetLink?.state !== 'revoked';
      if (!matches) return res.status(409).json({ error: { code: 'identity_link_conflict' } });
      return res.json({ linked: true, existing: true, ...accessSnapshot });
    }

    const { error: insertError } = await supabaseAdmin.from('ivg_identity_links').insert({
      walkingpov_user_id: input.data.walkingpovUserId,
      instantvidgrab_user_id: input.data.instantvidgrabUserId,
      state: 'verified',
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (insertError?.code === '23505') {
      const [sourceAfterRace, targetAfterRace] = await Promise.all([
        supabaseAdmin.from('ivg_identity_links').select('instantvidgrab_user_id, state').eq('walkingpov_user_id', input.data.walkingpovUserId).maybeSingle(),
        supabaseAdmin.from('ivg_identity_links').select('walkingpov_user_id, state').eq('instantvidgrab_user_id', input.data.instantvidgrabUserId).maybeSingle(),
      ]);
      if (sourceAfterRace.error || targetAfterRace.error) throw sourceAfterRace.error || targetAfterRace.error;
      if (sourceAfterRace.data?.instantvidgrab_user_id === input.data.instantvidgrabUserId
        && targetAfterRace.data?.walkingpov_user_id === input.data.walkingpovUserId) {
        return res.json({ linked: true, existing: true, ...accessSnapshot });
      }
      return res.status(409).json({ error: { code: 'identity_link_conflict' } });
    }
    if (insertError) throw insertError;
    return res.json({ linked: true, existing: false, ...accessSnapshot });
  } catch {
    console.error('ivg-identity-link-failed');
    return res.status(503).json({ error: { code: 'integration_unavailable' } });
  }
});

router.post('/resolve-video', requireIvgInternalAuth, async (req, res) => {
  const input = instantVidGrabVideoResolutionSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'invalid_video_request' } });
  if (!instantVidGrabDownloadsEnabled()) {
    return res.status(503).json({ error: { code: 'feature_unavailable' } });
  }
  const mediaSigningSecret = process.env.MEDIA_SIGNING_SECRET || '';
  const mediaOrigin = process.env.MEDIA_BASE_URL || 'https://media.candidfan.com';

  try {
    const result = await resolveAuthorizedWalkingPOVVideo({
      ...input.data,
      mediaOrigin,
      mediaSigningSecret,
      store: {
        async readIdentityLink(walkingpovUserId) {
          const { data, error } = await supabaseAdmin
            .from('ivg_identity_links')
            .select('instantvidgrab_user_id, state')
            .eq('walkingpov_user_id', walkingpovUserId)
            .maybeSingle();
          if (error) throw error;
          return data
            ? { instantvidgrabUserId: data.instantvidgrab_user_id, state: data.state }
            : null;
        },
        async readUser(walkingpovUserId) {
          const { data, error } = await supabaseAdmin
            .from('users')
            .select('membership_status, is_admin')
            .eq('id', walkingpovUserId)
            .maybeSingle();
          if (error) throw error;
          return data
            ? { membershipStatus: data.membership_status, isAdmin: data.is_admin === true }
            : null;
        },
        async readReadyVideo(videoId) {
          const { data, error } = await supabaseAdmin
            .from('videos')
            .select('updated_at')
            .eq('id', videoId)
            .eq('status', 'ready')
            .maybeSingle();
          if (error) throw error;
          return data ? { updatedAt: data.updated_at } : null;
        },
        async readMediaAsset(videoId) {
          const { data, error } = await supabaseAdmin
            .from('media_assets')
            .select('storage_key, content_type, size_bytes')
            .eq('video_id', videoId)
            .maybeSingle();
          if (error) throw error;
          return data
            ? {
                storageKey: data.storage_key,
                contentType: data.content_type,
                sizeBytes: Number(data.size_bytes),
              }
            : null;
        },
      },
      signMediaKey,
    });
    return res.set('Cache-Control', 'private, no-store').json(result);
  } catch (error) {
    if (error instanceof VideoResolutionError) {
      return res.status(error.status).json({ error: { code: error.code } });
    }
    console.error('ivg-video-resolution-failed');
    return res.status(503).json({ error: { code: 'video_resolution_unavailable' } });
  }
});

router.post('/entitlements', requireIvgInternalAuth, async (req, res) => {
  const input = instantVidGrabEntitlementSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'invalid_entitlement_event' } });

  const expectedHash = createHash('sha256')
    .update(canonicalEntitlementPayload(input.data), 'utf8')
    .digest('hex');
  if (expectedHash !== input.data.payloadHash) {
    return res.status(400).json({ error: { code: 'invalid_entitlement_hash' } });
  }

  try {
    const { data: link, error: linkError } = await supabaseAdmin
      .from('ivg_identity_links')
      .select('instantvidgrab_user_id, state')
      .eq('walkingpov_user_id', input.data.walkingpovUserId)
      .maybeSingle();
    if (linkError) throw linkError;
    if (link?.state !== 'verified' || link.instantvidgrab_user_id !== input.data.instantvidgrabUserId) {
      return res.status(409).json({ error: { code: 'identity_link_conflict' } });
    }

    const { data, error } = await supabaseAdmin.rpc('apply_ivg_entitlement_event', {
      p_event_id: input.data.eventId,
      p_payload_hash: `\\x${input.data.payloadHash}`,
      p_user_id: input.data.walkingpovUserId,
      p_source_type: input.data.sourceType,
      p_source_id: input.data.sourceId,
      p_grant_state: input.data.grantState,
      p_grant_version: input.data.grantVersion,
    });
    if (error) throw error;

    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.applied !== 'boolean' || typeof result.current_version !== 'number') {
      throw new Error('Invalid entitlement response');
    }
    return res.json({ accepted: true, applied: result.applied, grantVersion: result.current_version });
  } catch {
    console.error('ivg-entitlement-apply-failed');
    return res.status(503).json({ error: { code: 'integration_unavailable' } });
  }
});

router.post('/migration/premium-members', requireIvgInternalAuth, async (req, res) => {
  const input = legacyMemberMigrationPageSchema.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: { code: 'invalid_migration_page' } });
  if (!instantVidGrabLegacyMemberMigrationSandboxConfigured()) {
    return res.status(403).json({ error: { code: 'migration_sandbox_required' } });
  }
  if (input.data.mode === 'apply' && !instantVidGrabLegacyMemberMigrationEnabled()) {
    return res.status(403).json({ error: { code: 'migration_disabled' } });
  }

  try {
    const page = await buildLegacyMemberMigrationPage({
      afterGrantId: input.data.afterGrantId,
      limit: input.data.limit,
      mode: input.data.mode,
      store: {
        async readActiveGrantPage({ afterGrantId, limit }) {
          let query = supabaseAdmin
            .from('ivg_access_grants')
            .select('id, user_id')
            .eq('product', 'walkingpov')
            .eq('state', 'active')
            .order('id', { ascending: true })
            .limit(limit);
          if (afterGrantId) query = query.gt('id', afterGrantId);
          const { data, error } = await query;
          if (error) throw error;
          return (data || []).map((grant) => ({ id: grant.id, userId: grant.user_id }));
        },
        async readGrantRowsForUsers(userIds) {
          const rows: LegacyMigrationGrant[] = [];
          for (let afterGrantId: string | null = null; ; ) {
            let query = supabaseAdmin
              .from('ivg_access_grants')
              .select('id, user_id, state, version')
              .eq('product', 'walkingpov')
              .in('user_id', userIds)
              .order('id', { ascending: true })
              .limit(500);
            if (afterGrantId) query = query.gt('id', afterGrantId);
            const { data, error } = await query;
            if (error) throw error;
            const page = data || [];
            rows.push(...page.map((grant) => ({
              id: grant.id,
              userId: grant.user_id,
              state: grant.state as LegacyMigrationGrant['state'],
              version: grant.version,
            })));
            if (page.length < 500) break;
            afterGrantId = page.at(-1)?.id ?? null;
            if (!afterGrantId) break;
          }
          return rows;
        },
        async readSourceUser(userId) {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
          if (error) {
            if ((error as { status?: unknown }).status === 404) return null;
            throw error;
          }
          return data.user
            ? { email: data.user.email ?? null, emailConfirmedAt: data.user.email_confirmed_at ?? null }
            : null;
        },
      },
    });
    return res.set('Cache-Control', 'private, no-store').json(page);
  } catch {
    console.error('ivg-legacy-member-migration-page-failed');
    return res.status(503).json({ error: { code: 'migration_unavailable' } });
  }
});

export default router;

import { z } from 'zod';

const orderSourceIdPattern = /^ord_[a-f0-9]{32}$/;
const manualSourceIdPattern = /^man_[a-f0-9]{32}$/;

export const instantVidGrabEntitlementSchema = z.object({
  eventId: z.string().min(1).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  payloadHash: z.string().regex(/^[0-9a-f]{64}$/),
  sourceType: z.enum(['instantvidgrab_order', 'manual']).default('instantvidgrab_order'),
  walkingpovUserId: z.string().uuid(),
  instantvidgrabUserId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,35}$/),
  sourceId: z.string().regex(/^(?:ord|man)_[a-f0-9]{32}$/),
  grantState: z.enum(['active', 'suspended', 'revoked']),
  grantVersion: z.number().int().min(1).max(2_147_483_647),
}).strict().superRefine((value, context) => {
  const validSource = value.sourceType === 'manual'
    ? manualSourceIdPattern.test(value.sourceId)
    : orderSourceIdPattern.test(value.sourceId);
  if (!validSource) {
    context.addIssue({ code: 'custom', path: ['sourceId'], message: 'Source ID does not match source type.' });
  }
});

export type InstantVidGrabEntitlement = z.infer<typeof instantVidGrabEntitlementSchema>;

export function canonicalEntitlementPayload(input: InstantVidGrabEntitlement) {
  // Keep the exact legacy order-event bytes so already persisted idempotency
  // hashes remain valid. Manual grants include their provider-neutral source.
  const payload = input.sourceType === 'manual'
    ? {
        eventId: input.eventId,
        sourceType: input.sourceType,
        walkingpovUserId: input.walkingpovUserId,
        instantvidgrabUserId: input.instantvidgrabUserId,
        sourceId: input.sourceId,
        grantState: input.grantState,
        grantVersion: input.grantVersion,
      }
    : {
        eventId: input.eventId,
        walkingpovUserId: input.walkingpovUserId,
        instantvidgrabUserId: input.instantvidgrabUserId,
        sourceId: input.sourceId,
        grantState: input.grantState,
        grantVersion: input.grantVersion,
      };
  return JSON.stringify(payload);
}

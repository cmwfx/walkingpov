export type StoredMembershipStatus = 'free' | 'pending' | 'premium' | 'denied';

/**
 * CandidFan's users row is the canonical membership source. The old IVG grants
 * are retained for audit, but are intentionally not queried by runtime code.
 */
export function effectiveMembership(storedStatus: StoredMembershipStatus) {
  return {
    membership_status: storedStatus,
    premium_plan: storedStatus === 'premium' ? 'lifetime' as const : null,
  };
}

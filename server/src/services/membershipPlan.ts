export type EffectiveGrant = {state:string; source_type:string; expires_at?:string|null};
export function derivePremiumPlan(grants: EffectiveGrant[], now = Date.now()): 'lifetime' | 'monthly' | null {
  const active = grants.filter(g => g.state === 'active' && (!g.expires_at || Date.parse(g.expires_at) > now));
  if (active.some(g => g.source_type !== 'instantvidgrab_subscription')) return 'lifetime';
  return active.length ? 'monthly' : null;
}

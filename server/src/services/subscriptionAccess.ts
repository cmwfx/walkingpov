import { supabaseAdmin } from '../config/supabase.js';
import { derivePremiumPlan } from './membershipPlan.js';
export async function effectiveMembership(userId: string, storedStatus: 'free'|'pending'|'premium'|'denied') {
  const {data,error} = await supabaseAdmin.from('ivg_access_grants').select('state, source_type, expires_at').eq('user_id',userId).eq('product','walkingpov');
  if (error) throw error;
  const plan = derivePremiumPlan(data ?? []);
  if (plan) return {membership_status:'premium' as const,premium_plan:plan};
  // Legacy profile-only accounts remain supported; subscription-backed profiles
  // cannot retain Premium after their last grant expires.
  if (!data?.length && storedStatus === 'premium') return {membership_status:'premium' as const,premium_plan:'lifetime' as const};
  return {membership_status:storedStatus === 'premium' ? 'free' as const : storedStatus,premium_plan:null};
}

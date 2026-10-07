import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.js';
import { signInternalRequest } from '../services/ivgInternalSignature.js';

const router = Router();
async function subscriptionForUser(userId:string) {
  const {data,error} = await supabaseAdmin.from('ivg_subscriptions').select('source_id,status,grant_state,paid_through,current_period_end,cancel_at_period_end,cancellation_pending').eq('user_id',userId).order('paid_through',{ascending:false,nullsFirst:false}).limit(10);
  if (error) throw error;
  return data?.find(s => !['canceled','expired'].includes(s.status)) ?? data?.[0] ?? null;
}
router.get('/subscription',verifyToken,async (req:AuthRequest,res) => {
  try {
    const subscription = await subscriptionForUser(req.user!.id);
    return res.set('Cache-Control','private, no-store').json({plan:req.user!.premium_plan ?? null,subscription:subscription ? {status:subscription.status,paidThrough:subscription.paid_through,currentPeriodEnd:subscription.current_period_end,cancelAtPeriodEnd:subscription.cancel_at_period_end,cancellationPending:subscription.cancellation_pending,priceMinor:999,currency:'eur'} : null});
  } catch { return res.status(503).json({error:'Subscription details are temporarily unavailable. Please try again.'}); }
});
router.post('/subscription/cancel',verifyToken,async (req:AuthRequest,res) => {
  if (!z.object({}).strict().safeParse(req.body).success) return res.status(400).json({error:'Invalid cancellation request.'});
  try {
    const {data:link,error} = await supabaseAdmin.from('ivg_identity_links').select('instantvidgrab_user_id,state').eq('walkingpov_user_id',req.user!.id).maybeSingle();
    if (error || link?.state !== 'verified') return res.status(409).json({error:'The subscription account connection is unavailable.'});
    const configuredBase = process.env.INSTANTVIDGRAB_API_BASE_URL || 'https://instantvidgrab.online';
    const base = new URL(configuredBase);
    if (base.protocol !== 'https:' || base.origin !== 'https://instantvidgrab.online' || base.pathname !== '/' || base.search || base.hash) throw new Error('Invalid billing host');
    const path='/api/internal/integrations/walkingpov/subscriptions';
    const body=JSON.stringify({walkingpovUserId:req.user!.id,instantvidgrabUserId:link.instantvidgrab_user_id});
    const keyId=process.env.WALKINGPOV_TO_IVG_HMAC_CURRENT_KEY_ID || '';
    const secret=process.env.WALKINGPOV_TO_IVG_HMAC_CURRENT_SECRET || '';
    if (!/^[a-z0-9_-]{1,64}$/i.test(keyId) || Buffer.byteLength(secret)<32) throw new Error('Missing billing configuration');
    const timestamp=String(Math.floor(Date.now()/1000));
    const nonce=randomBytes(24).toString('base64url');
    const signature=signInternalRequest({keyId,method:'POST',path,timestamp,nonce,body:Buffer.from(body)},secret);
    const response=await fetch(`${base.origin}${path}`,{method:'POST',headers:{'content-type':'application/json','x-ivg-key-id':keyId,'x-ivg-timestamp':timestamp,'x-ivg-nonce':nonce,'x-ivg-signature':signature},body,redirect:'error',signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw new Error('Cancellation not confirmed');
    const result=z.object({cancelled:z.literal(true)}).parse(await response.json());
    return res.set('Cache-Control','private, no-store').json(result);
  } catch { return res.status(503).json({error:'We could not confirm cancellation. Please try again; repeating the request will not create another charge.'}); }
});
export default router;

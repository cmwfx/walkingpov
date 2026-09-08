import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { encrypt, decrypt } from '../services/encryption.js';
import { BRAND } from '../config/brand.js';

const router = Router();

router.get('/offer', (_req, res) => res.json(BRAND.offer));

router.post('/submit', paymentLimiter, verifyToken, async (req: AuthRequest, res) => {
  const proof = typeof req.body?.proof === 'string' ? req.body.proof.trim() : '';
  if (!proof || proof.length > 500) return res.status(400).json({ error: 'Gift-card proof is required and must be at most 500 characters' });
  try {
    const encrypted = encrypt(proof);
    const { data, error } = await supabaseAdmin.rpc('submit_payment_request', {
      p_user_id: req.user!.id,
      p_encrypted_proof: encrypted,
      p_amount_minor: BRAND.offer.amountMinor,
      p_currency: BRAND.offer.currency,
    });
    if (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'A payment request is already pending' });
      throw error;
    }
    res.status(201).json({ id: data, status: 'pending', offer: BRAND.offer });
  } catch (error) {
    console.error('payment submission failed', error);
    res.status(500).json({ error: 'Unable to submit payment proof' });
  }
});

router.get('/mine', verifyToken, async (req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('payment_requests')
    .select('id,amount_minor,currency,status,notes,created_at,updated_at')
    .eq('user_id', req.user!.id)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return res.status(500).json({ error: 'Unable to load payment history' });
  res.json(data || []);
});

router.get('/admin/requests', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from('payment_requests')
      .select('id,user_id,amount_minor,currency,encrypted_proof,status,reviewed_by,reviewed_at,notes,created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    if (error) throw error;
    const userIds = [...new Set((requests || []).map((item) => item.user_id))];
    const { data: users, error: userError } = userIds.length ? await supabaseAdmin.from('users').select('id,email,membership_status').in('id', userIds) : { data: [], error: null };
    if (userError) throw userError;
    const byId = new Map((users || []).map((user) => [user.id, user]));
    res.json((requests || []).map((request) => ({
      id: request.id,
      user_id: request.user_id,
      user_email: byId.get(request.user_id)?.email || 'unknown',
      membership_status: byId.get(request.user_id)?.membership_status || 'free',
      amount_minor: request.amount_minor,
      currency: request.currency,
      proof: decrypt(request.encrypted_proof),
      status: request.status,
      notes: request.notes,
      created_at: request.created_at,
    })));
  } catch (error) {
    console.error('payment queue failed', error);
    res.status(500).json({ error: 'Unable to load payment requests' });
  }
});

router.post('/admin/requests/:id/review', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const decision = req.body?.decision;
  if (decision !== 'approved' && decision !== 'denied') return res.status(400).json({ error: 'Decision must be approved or denied' });
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.slice(0, 1000) : null;
  const { data, error } = await supabaseAdmin.rpc('review_payment', {
    p_payment_id: req.params.id,
    p_reviewer_id: req.user!.id,
    p_decision: decision,
    p_notes: notes,
  });
  if (error) {
    if (error.code === 'P0002') return res.status(404).json({ error: 'Payment request not found' });
    if (error.code === '42501') return res.status(403).json({ error: 'Admin access required' });
    console.error('payment review failed', error);
    return res.status(500).json({ error: 'Unable to review payment' });
  }
  res.json(data);
});

export default router;


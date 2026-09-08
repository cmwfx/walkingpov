import { Router } from 'express';
import { AuthRequest, requireAdmin, verifyToken } from '../middleware/auth.js';
import { paymentLimiter } from '../middleware/rateLimiter.js';
import { supabaseAdmin } from '../config/supabase.js';
import { encrypt, decrypt, isEncrypted } from '../services/encryption.js';

const router = Router();

function errorCode(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  return message.replace(/[^a-z_]/g, '').slice(0, 60);
}

router.post('/submit', paymentLimiter, verifyToken, async (req: AuthRequest, res) => {
  const proof = typeof req.body?.proof === 'string' ? req.body.proof.trim() : '';
  if (!proof || proof.length > 500) return res.status(400).json({ error: 'Enter a valid gift card proof.' });
  try {
    const encrypted = encrypt(proof);
    const { error } = await supabaseAdmin.rpc('submit_payment_request', {
      p_user_id: req.user!.id,
      p_proof_encrypted: encrypted,
    });
    if (error) throw error;
    return res.status(201).json({ message: 'Your gift card proof was submitted for review.' });
  } catch (error) {
    const code = errorCode(error);
    if (code.includes('pending_exists')) return res.status(409).json({ error: 'You already have a payment awaiting review.' });
    if (code.includes('already_premium')) return res.status(409).json({ error: 'Your membership is already active.' });
    console.error('payment-submit-failed');
    return res.status(500).json({ error: 'Unable to submit payment proof.' });
  }
});

router.get('/requests', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('payment_requests')
    .select('id, user_id, proof_encrypted, status, created_at, notes')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) {
    console.error('payment-requests-read-failed');
    return res.status(500).json({ error: 'Unable to load payment requests.' });
  }
  const userIds = [...new Set((data || []).map((row) => row.user_id))];
  const users = userIds.length ? await supabaseAdmin.from('users').select('id, email').in('id', userIds) : { data: [], error: null };
  if (users.error) return res.status(500).json({ error: 'Unable to load payment request owners.' });
  const emails = new Map((users.data || []).map((user) => [user.id, user.email]));
  try {
    return res.json((data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      email: emails.get(row.user_id) || 'unknown',
      proof: isEncrypted(row.proof_encrypted) ? decrypt(row.proof_encrypted) : '',
      status: row.status,
      created_at: row.created_at,
      notes: row.notes,
    })));
  } catch {
    console.error('payment-proof-read-failed');
    return res.status(500).json({ error: 'Unable to load payment proofs.' });
  }
});

router.post('/:id/review', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const decision = req.body?.decision;
  const notes = typeof req.body?.notes === 'string' ? req.body.notes.trim().slice(0, 2000) : null;
  if (!['approved', 'denied'].includes(decision)) return res.status(400).json({ error: 'Choose approved or denied.' });
  try {
    const { error } = await supabaseAdmin.rpc('review_payment_request', {
      p_request_id: req.params.id,
      p_admin_id: req.user!.id,
      p_decision: decision,
      p_notes: notes,
    });
    if (error) throw error;
    return res.json({ message: 'Payment review saved.' });
  } catch (error) {
    const code = errorCode(error);
    if (code.includes('already_reviewed')) return res.status(409).json({ error: 'This request was already reviewed.' });
    if (code.includes('not_found')) return res.status(404).json({ error: 'Payment request not found.' });
    console.error('payment-review-failed');
    return res.status(500).json({ error: 'Unable to save payment review.' });
  }
});

export default router;

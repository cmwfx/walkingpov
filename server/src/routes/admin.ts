import { Router } from 'express';
import { AuthRequest, requireAdmin, verifyToken } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

router.get('/stats', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  const [videos, users, payments, premium] = await Promise.all([
    supabaseAdmin.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('membership_status', 'premium'),
  ]);
  if (videos.error || users.error || payments.error || premium.error) {
    console.error('admin-stats-read-failed');
    return res.status(500).json({ error: 'Unable to load admin statistics' });
  }
  return res.json({ total_videos: videos.count || 0, total_users: users.count || 0, pending_payments: payments.count || 0, premium_users: premium.count || 0 });
});

router.get('/support', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, subject, status, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    console.error('admin-support-list-failed');
    return res.status(500).json({ error: 'Unable to load support tickets.' });
  }
  const ids = [...new Set((data || []).map((ticket) => ticket.user_id))];
  const owners = ids.length ? await supabaseAdmin.from('users').select('id, email').in('id', ids) : { data: [], error: null };
  if (owners.error) return res.status(500).json({ error: 'Unable to load ticket owners.' });
  const emailById = new Map((owners.data || []).map((owner) => [owner.id, owner.email]));
  return res.json((data || []).map((ticket) => ({ ...ticket, email: emailById.get(ticket.user_id) || 'unknown' })));
});

export default router;

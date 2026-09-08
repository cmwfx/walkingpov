import { Router } from 'express';
import { supabaseAdmin } from '../config/supabase.js';
import { verifyToken, requireAdmin, type AuthRequest } from '../middleware/auth.js';
import { supportLimiter } from '../middleware/rateLimiter.js';

const router = Router();

async function getTicket(id: string) {
  const { data, error } = await supabaseAdmin.from('support_tickets').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function canAccess(id: string, req: AuthRequest) {
  const ticket = await getTicket(id);
  return ticket && (req.user!.is_admin || ticket.owner_user_id === req.user!.id) ? ticket : null;
}

router.get('/tickets', verifyToken, async (req: AuthRequest, res) => {
  let query = supabaseAdmin.from('support_tickets').select('id,owner_user_id,subject,status,user_last_read_at,admin_last_read_at,last_activity_at,created_at,updated_at').order('last_activity_at', { ascending: false }).limit(100);
  if (!req.user!.is_admin) query = query.eq('owner_user_id', req.user!.id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: 'Unable to load tickets' });
  res.json(data || []);
});

router.post('/tickets', supportLimiter, verifyToken, async (req: AuthRequest, res) => {
  const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!subject || subject.length > 200) return res.status(400).json({ error: 'Subject must be between 1 and 200 characters' });
  if (!body || body.length > 5000) return res.status(400).json({ error: 'Message must be between 1 and 5000 characters' });
  const { data, error } = await supabaseAdmin.rpc('create_support_ticket', { p_owner_id: req.user!.id, p_subject: subject, p_body: body });
  if (error) {
    console.error('ticket creation failed', error);
    return res.status(500).json({ error: 'Unable to create ticket' });
  }
  res.status(201).json(data);
});

router.get('/tickets/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const ticket = await canAccess(req.params.id, req);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    const { data: messages, error } = await supabaseAdmin
      .from('support_messages')
      .select('id,ticket_id,author_user_id,body,created_at')
      .eq('ticket_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    await supabaseAdmin.from('support_tickets').update(req.user!.is_admin ? { admin_last_read_at: new Date().toISOString() } : { user_last_read_at: new Date().toISOString() }).eq('id', req.params.id);
    res.json({ ...ticket, messages: messages || [] });
  } catch (error) {
    console.error('ticket lookup failed', error);
    res.status(500).json({ error: 'Unable to load ticket' });
  }
});

router.post('/tickets/:id/messages', supportLimiter, verifyToken, async (req: AuthRequest, res) => {
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!body || body.length > 5000) return res.status(400).json({ error: 'Message must be between 1 and 5000 characters' });
  const ticket = await canAccess(req.params.id, req);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const { data, error } = await supabaseAdmin.rpc('create_support_message', {
    p_ticket_id: req.params.id,
    p_author_id: req.user!.id,
    p_body: body,
    p_send_email: req.user!.is_admin && req.body?.send_email === true,
  });
  if (error) {
    if (error.code === '42501') return res.status(403).json({ error: 'Ticket access denied' });
    console.error('ticket reply failed', error);
    return res.status(500).json({ error: 'Unable to send reply' });
  }
  res.status(201).json(data);
});

router.patch('/tickets/:id', verifyToken, async (req: AuthRequest, res) => {
  const ticket = await canAccess(req.params.id, req);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const status = req.body?.status;
  if (status !== 'open' && status !== 'closed') return res.status(400).json({ error: 'Status must be open or closed' });
  const { data, error } = await supabaseAdmin.from('support_tickets').update({ status }).eq('id', req.params.id).select('id,status,updated_at').single();
  if (error) return res.status(500).json({ error: 'Unable to update ticket' });
  res.json(data);
});

// Explicit aliases keep admin navigation and API semantics clear while using
// the same ownership checks as the shared ticket handlers.
router.get('/admin/tickets', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin.from('support_tickets').select('*').order('last_activity_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: 'Unable to load tickets' });
  res.json(data || []);
});

export default router;


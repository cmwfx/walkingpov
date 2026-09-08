import { Router } from 'express';
import { AuthRequest, requireAdmin, verifyToken } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';

const router = Router();

function text(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function supportError(error: unknown) {
  return (error instanceof Error ? error.message : '').replace(/[^a-z_]/g, '').slice(0, 80);
}

async function readTicket(ticketId: string, userId: string, isAdmin: boolean) {
  const { data: ticket, error } = await supabaseAdmin
    .from('support_tickets')
    .select('id, user_id, subject, status, created_at, updated_at')
    .eq('id', ticketId)
    .maybeSingle();
  if (error || !ticket || (!isAdmin && ticket.user_id !== userId)) return null;
  const { data: messages, error: messageError } = await supabaseAdmin
    .from('support_messages')
    .select('id, ticket_id, author_id, body, created_at')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });
  if (messageError) throw messageError;
  return { ...ticket, messages: messages || [] };
}

router.get('/', verifyToken, async (req: AuthRequest, res) => {
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('id, subject, status, created_at, updated_at')
    .eq('user_id', req.user!.id)
    .order('updated_at', { ascending: false });
  if (error) {
    console.error('support-list-failed');
    return res.status(500).json({ error: 'Unable to load support tickets.' });
  }
  return res.json(data || []);
});

router.post('/', verifyToken, async (req: AuthRequest, res) => {
  const subject = text(req.body?.subject, 160);
  const body = text(req.body?.body, 10000);
  if (!subject || !body) return res.status(400).json({ error: 'A subject and message are required.' });
  const { data, error } = await supabaseAdmin.rpc('create_support_ticket', {
    p_user_id: req.user!.id,
    p_subject: subject,
    p_body: body,
  });
  if (error) {
    console.error('support-create-failed');
    return res.status(500).json({ error: 'Unable to create support ticket.' });
  }
  return res.status(201).json({ id: data });
});

router.get('/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const ticket = await readTicket(req.params.id, req.user!.id, req.user!.is_admin);
    if (!ticket) return res.status(404).json({ error: 'Support ticket not found.' });
    return res.json(ticket);
  } catch {
    console.error('support-read-failed');
    return res.status(500).json({ error: 'Unable to load support ticket.' });
  }
});

router.post('/:id/messages', verifyToken, async (req: AuthRequest, res) => {
  const body = text(req.body?.body, 10000);
  if (!body) return res.status(400).json({ error: 'Enter a message.' });
  const notifyEmail = req.user!.is_admin && req.body?.notify_email === true;
  const ticket = await readTicket(req.params.id, req.user!.id, req.user!.is_admin);
  if (!ticket) return res.status(404).json({ error: 'Support ticket not found.' });
  if (ticket.status === 'closed' && !req.user!.is_admin) return res.status(409).json({ error: 'Reopen the ticket before replying.' });
  const { data, error } = await supabaseAdmin.rpc('add_support_message', {
    p_ticket_id: req.params.id,
    p_author_id: req.user!.id,
    p_body: body,
    p_notify_email: notifyEmail,
  });
  if (error) {
    const code = supportError(error);
    if (code.includes('invalid_body')) return res.status(400).json({ error: 'Message is too long.' });
    console.error('support-reply-failed');
    return res.status(500).json({ error: 'Unable to save support reply.' });
  }
  return res.status(201).json({ id: data });
});

router.post('/:id/status', verifyToken, async (req: AuthRequest, res) => {
  const status = req.body?.status;
  if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid ticket status.' });
  if (status === 'closed' && !req.user!.is_admin) return res.status(403).json({ error: 'Only support staff can close tickets.' });
  const ticket = await readTicket(req.params.id, req.user!.id, req.user!.is_admin);
  if (!ticket) return res.status(404).json({ error: 'Support ticket not found.' });
  const { error } = await supabaseAdmin.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) {
    console.error('support-status-failed');
    return res.status(500).json({ error: 'Unable to update ticket status.' });
  }
  return res.json({ status });
});

router.get('/admin/all', verifyToken, requireAdmin, async (_req: AuthRequest, res) => {
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

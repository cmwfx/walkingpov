import { Router } from 'express';
import { AuthRequest, verifyToken } from '../middleware/auth.js';
import { supabaseAdmin } from '../config/supabase.js';
import { getUnreadTicketIds, markTicketRead } from '../services/supportUnread.js';

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
  try {
    const unread = await getUnreadTicketIds(req.user!.id, (data || []).map((ticket) => ticket.id));
    return res.json((data || []).map((ticket) => ({ ...ticket, unread: unread.has(ticket.id) })));
  } catch {
    console.error('support-unread-read-failed');
    return res.status(500).json({ error: 'Unable to load support notifications.' });
  }
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
    await markTicketRead(req.params.id, req.user!.id);
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
  let ticket;
  try {
    ticket = await readTicket(req.params.id, req.user!.id, req.user!.is_admin);
  } catch {
    console.error('support-reply-read-failed');
    return res.status(500).json({ error: 'Unable to load support ticket.' });
  }
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
  let ticket;
  try {
    ticket = await readTicket(req.params.id, req.user!.id, req.user!.is_admin);
  } catch {
    console.error('support-status-read-failed');
    return res.status(500).json({ error: 'Unable to load support ticket.' });
  }
  if (!ticket) return res.status(404).json({ error: 'Support ticket not found.' });
  const { error } = await supabaseAdmin.from('support_tickets').update({ status, updated_at: new Date().toISOString() }).eq('id', req.params.id);
  if (error) {
    console.error('support-status-failed');
    return res.status(500).json({ error: 'Unable to update ticket status.' });
  }
  return res.json({ status });
});

export default router;

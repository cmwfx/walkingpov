import { supabaseAdmin } from '../config/supabase.js';

export async function getUnreadTicketIds(userId: string, ticketIds: string[]) {
  if (!ticketIds.length) return new Set<string>();

  const [messages, reads] = await Promise.all([
    supabaseAdmin
      .from('support_messages')
      .select('ticket_id, author_id, created_at')
      .in('ticket_id', ticketIds)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('support_ticket_reads')
      .select('ticket_id, last_read_at')
      .eq('user_id', userId)
      .in('ticket_id', ticketIds),
  ]);

  if (messages.error) throw messages.error;
  if (reads.error) throw reads.error;

  const latestByTicket = new Map<string, { author_id: string; created_at: string }>();
  for (const message of messages.data || []) {
    if (!latestByTicket.has(message.ticket_id)) latestByTicket.set(message.ticket_id, message);
  }
  const readAtByTicket = new Map((reads.data || []).map((read) => [read.ticket_id, read.last_read_at]));
  const unread = new Set<string>();

  for (const [ticketId, message] of latestByTicket) {
    const lastReadAt = readAtByTicket.get(ticketId);
    if (message.author_id !== userId && (!lastReadAt || new Date(message.created_at).getTime() > new Date(lastReadAt).getTime())) unread.add(ticketId);
  }

  return unread;
}

export async function markTicketRead(ticketId: string, userId: string) {
  const { error } = await supabaseAdmin.from('support_ticket_reads').upsert(
    { ticket_id: ticketId, user_id: userId, last_read_at: new Date().toISOString() },
    { onConflict: 'ticket_id,user_id' },
  );
  if (error) throw error;
}

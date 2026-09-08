import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { getTicket, replyToTicket, updateTicket } from '@/lib/api';
import type { SupportMessage, SupportTicket } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SupportThread({ admin = false }: { admin?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [body, setBody] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const load = () => { if (id) void getTicket(id).then((data) => { setTicket(data); setMessages(data.messages); }); };
  useEffect(load, [id]);
  if (!ticket) return <div className="container mx-auto py-20 text-center text-slate-400">Loading ticket…</div>;
  return <div className="container mx-auto max-w-3xl px-4 py-10"><Link to={admin ? '/admin/support' : '/support'} className="inline-flex items-center text-sm text-slate-400"><ArrowLeft className="mr-2 h-4 w-4" />Back to tickets</Link><Card className="mt-6 border-white/10 bg-white/5"><CardHeader><CardTitle className="flex items-center justify-between text-white"><span>{ticket.subject}</span><Button size="sm" variant="outline" onClick={async () => { await updateTicket(ticket.id, ticket.status === 'open' ? 'closed' : 'open'); load(); }}>{ticket.status === 'open' ? 'Close' : 'Reopen'}</Button></CardTitle></CardHeader><CardContent><div className="space-y-4">{messages.map((message) => <div key={message.id} className={'rounded-xl p-4 ' + (message.author_user_id === user?.id ? 'ml-8 bg-violet-500/15' : 'mr-8 bg-white/5')}><p className="whitespace-pre-wrap text-sm text-slate-200">{message.body}</p><p className="mt-2 text-xs text-slate-500">{new Date(message.created_at).toLocaleString()}</p></div>)}</div><form className="mt-6 space-y-3" onSubmit={async (event) => { event.preventDefault(); if (!body.trim()) return; await replyToTicket(ticket.id, body, admin && sendEmail); setBody(''); setSendEmail(false); load(); }}><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} placeholder="Write a plain-text reply…" className="min-h-32 w-full rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white" required />{admin && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} />Send email alert to the user</label>}<Button type="submit"><Send className="mr-2 h-4 w-4" />Send reply</Button></form></CardContent></Card></div>;
}


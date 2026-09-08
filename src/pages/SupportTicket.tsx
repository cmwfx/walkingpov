/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, RotateCcw } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getTicket, replyTicket, setTicketStatus } from '@/lib/api';
import type { SupportMessage, SupportTicket as Ticket } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function SupportTicket() {
  const { id = '' } = useParams(); const { user, isAdmin } = useAuth(); const [ticket, setTicket] = useState<(Ticket & { messages: SupportMessage[] }) | null>(null); const [body, setBody] = useState(''); const [notifyEmail, setNotifyEmail] = useState(false); const [error, setError] = useState('');
  const load = async () => { try { setTicket(await getTicket(id)); } catch { setError('Unable to load this ticket.'); } };
  useEffect(() => { void load(); }, [id]);
  const submit = async (event: FormEvent) => { event.preventDefault(); try { await replyTicket(id, body, notifyEmail); setBody(''); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save reply.'); } };
  const toggle = async () => { if (!ticket) return; try { await setTicketStatus(id, ticket.status === 'closed' ? 'open' : 'closed'); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update status.'); } };
  if (!ticket) return <div className="container mx-auto px-4 py-20 text-center text-slate-300">{error || 'Loading ticket…'}</div>;
  const canReply = ticket.status === 'open' || isAdmin;
  return <div className="container mx-auto max-w-3xl px-4 py-10"><Link to={isAdmin ? '/admin/support' : '/support'}><Button variant="ghost" className="text-slate-300 hover:bg-white/5 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />All tickets</Button></Link><Card className="mt-5 border-slate-700/70 bg-slate-900/75 text-white shadow-2xl shadow-black/10"><CardHeader className="border-b border-white/10"><div className="flex items-start justify-between gap-4"><div><CardTitle>{ticket.subject}</CardTitle><p className="mt-2 text-sm text-slate-400">{ticket.status === 'open' ? 'Open' : 'Closed'} · Started {new Date(ticket.created_at).toLocaleDateString()}</p></div>{(isAdmin || ticket.status === 'closed') && <Button variant="outline" size="sm" className="border-white/15 text-white" onClick={() => void toggle()}>{ticket.status === 'closed' ? <><RotateCcw className="mr-2 h-4 w-4" />Reopen</> : <><CheckCircle className="mr-2 h-4 w-4" />Close</>}</Button>}</div></CardHeader><CardContent className="pt-6"><div className="space-y-3">{ticket.messages.map((message) => <div className={`rounded-xl border p-4 ${message.author_id === user?.id ? 'border-violet-300/20 bg-violet-300/10' : 'border-white/10 bg-slate-950/40'}`} key={message.id}><p className="whitespace-pre-wrap text-sm leading-6">{message.body}</p><p className="mt-3 text-xs text-slate-500">{message.author_id === user?.id ? 'You' : 'CandidFan support'} · {new Date(message.created_at).toLocaleString()}</p></div>)}</div>{canReply && <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-3"><Textarea value={body} maxLength={10000} required onChange={(e) => setBody(e.target.value)} placeholder="Write a reply..." className="border-slate-700/80 bg-slate-950/70 text-white placeholder:text-slate-500 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/30" />{isAdmin && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />Send a generic email notice</label>}{error && <p className="text-sm text-rose-300">{error}</p>}<Button className="bg-gradient-to-r from-violet-600 to-sky-600">Send reply</Button></form>}</CardContent></Card></div>;
}

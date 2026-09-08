import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, MessageSquare, Plus } from 'lucide-react';
import { createTicket, getTickets } from '@/lib/api';
import type { SupportTicket } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export function Support({ admin = false }: { admin?: boolean }) {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const { toast } = useToast();
  const load = () => void getTickets(admin).then(setTickets);
  useEffect(load, [admin]);
  return <div className="container mx-auto max-w-5xl px-4 py-10"><div className="mb-8"><p className="text-sm uppercase tracking-[0.25em] text-violet-300">Support</p><h1 className="mt-2 flex items-center gap-2 text-3xl font-bold text-white"><LifeBuoy className="h-7 w-7 text-violet-300" />{admin ? 'Ticket inbox' : 'Your support tickets'}</h1><p className="mt-2 text-slate-400">Plain-text conversations stay inside CandidFan.</p></div>
    {!admin && <Card className="mb-8 border-white/10 bg-white/5"><CardHeader><CardTitle className="text-white">Start a ticket</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); try { await createTicket(subject, body); setSubject(''); setBody(''); load(); toast({ title: 'Ticket created' }); } catch (error) { toast({ title: 'Unable to create ticket', description: error instanceof Error ? error.message : 'Try again', variant: 'destructive' }); } }}><div className="space-y-2"><Label htmlFor="subject">Subject</Label><Input id="subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} required /></div><div className="space-y-2"><Label htmlFor="body">Message</Label><textarea id="body" value={body} onChange={(event) => setBody(event.target.value)} maxLength={5000} required className="min-h-32 w-full rounded-md border border-white/10 bg-white/5 p-3 text-sm text-white" /></div><Button type="submit"><Plus className="mr-2 h-4 w-4" />Create ticket</Button></form></CardContent></Card>}
    <div className="space-y-3">{tickets.map((ticket) => <Link to={(admin ? '/admin/support/' : '/support/') + ticket.id} key={ticket.id}><Card className="border-white/10 bg-white/5 transition hover:bg-white/10"><CardContent className="flex items-center justify-between p-4"><div><p className="font-medium text-white">{ticket.subject}</p><p className="mt-1 text-xs text-slate-400">{new Date(ticket.last_activity_at).toLocaleString()}</p></div><span className="flex items-center gap-2 text-sm text-slate-300"><MessageSquare className="h-4 w-4" />{ticket.status}</span></CardContent></Card></Link>)}</div>
    {tickets.length === 0 && <p className="py-12 text-center text-slate-500">No tickets yet.</p>}
  </div>;
}


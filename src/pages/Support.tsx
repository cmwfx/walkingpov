import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellRing, Clock3, LifeBuoy, MessageCircle, Send } from 'lucide-react';
import { createTicket, getTickets } from '@/lib/api';
import type { SupportTicket } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const fieldClassName = 'mt-2 border-slate-700/80 bg-slate-950/70 text-white shadow-inner shadow-black/10 placeholder:text-slate-500 focus-visible:border-violet-400/70 focus-visible:ring-violet-400/30';

export function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getTickets().then(setTickets).catch(() => setError('Unable to load support tickets.'));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await createTicket(subject, body);
      navigate(`/support/${result.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create ticket.');
    } finally {
      setBusy(false);
    }
  };

  const unreadCount = tickets.filter((ticket) => ticket.unread).length;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-medium text-violet-200">
          <LifeBuoy className="h-3.5 w-3.5" />
          Private channel
        </div>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-white">Private support</h1>
        <p className="mt-2 max-w-2xl text-slate-400">Only you and authorized CandidFan support staff can read these messages.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-slate-700/70 bg-slate-900/75 text-white shadow-2xl shadow-black/10">
          <CardHeader className="border-b border-white/10 pb-5">
            <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-5 w-5 text-violet-300" />Start a ticket</CardTitle>
            <p className="text-sm text-slate-400">Send a private message and we will reply here.</p>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={(event) => void submit(event)} className="space-y-5">
              <div>
                <Label htmlFor="subject" className="text-slate-200">Subject</Label>
                <Input id="subject" maxLength={160} required value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="What can we help with?" className={fieldClassName} />
              </div>
              <div>
                <Label htmlFor="body" className="text-slate-200">Message</Label>
                <Textarea id="body" maxLength={10000} required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write your message here..." className={`${fieldClassName} min-h-36 resize-y`} />
                <p className="mt-2 text-xs text-slate-500">Please include any details that will help us answer quickly.</p>
              </div>
              {error && <p className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
              <Button disabled={busy} className="bg-gradient-to-r from-violet-600 to-sky-600 shadow-lg shadow-violet-900/20"><Send className="mr-2 h-4 w-4" />{busy ? 'Sending...' : 'Create ticket'}</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-slate-700/70 bg-slate-900/75 text-white shadow-2xl shadow-black/10">
          <CardHeader className="border-b border-white/10 pb-5">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Your tickets</CardTitle>
              {unreadCount > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-400/15 px-2.5 py-1 text-xs font-semibold text-violet-200"><BellRing className="h-3.5 w-3.5" />{unreadCount} new</span>}
            </div>
            <p className="text-sm text-slate-400">Your replies and support responses stay here.</p>
          </CardHeader>
          <CardContent className="space-y-3 pt-6">
            {tickets.length ? tickets.map((ticket) => (
              <Link className={`block rounded-xl border p-4 transition ${ticket.unread ? 'border-violet-300/40 bg-violet-300/10 hover:bg-violet-300/15' : 'border-white/10 bg-slate-950/30 hover:border-white/20 hover:bg-white/[0.04]'}`} to={`/support/${ticket.id}`} key={ticket.id}>
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-white">{ticket.subject}</span>
                  {ticket.unread ? <span className="shrink-0 rounded-full bg-violet-400/20 px-2 py-1 text-[11px] font-semibold text-violet-200">New message</span> : <span className="text-xs capitalize text-slate-400">{ticket.status}</span>}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />Updated {new Date(ticket.updated_at).toLocaleDateString()}</p>
              </Link>
            )) : <p className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">No tickets yet.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

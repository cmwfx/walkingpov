import { useEffect, useState } from 'react';
import { ArrowLeft, BellRing, Clock3, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAdminTickets } from '@/lib/api';
import type { SupportTicket } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminSupport() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminTickets().then(setTickets).catch(() => setError('Unable to load support inbox.'));
  }, []);

  const unreadCount = tickets.filter((ticket) => ticket.unread).length;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <Link to="/admin"><Button variant="ghost" className="text-slate-300 hover:bg-white/5 hover:text-white"><ArrowLeft className="mr-2 h-4 w-4" />Admin</Button></Link>
      <div className="mb-8 mt-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-medium text-violet-200"><LifeBuoy className="h-3.5 w-3.5" />Private support</div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white">Support inbox</h1>
            <p className="mt-2 text-slate-400">Read and answer private member tickets from one place.</p>
          </div>
          {unreadCount > 0 && <span className="inline-flex items-center gap-2 rounded-full bg-violet-400/15 px-3 py-1.5 text-sm font-semibold text-violet-200"><BellRing className="h-4 w-4" />{unreadCount} new {unreadCount === 1 ? 'message' : 'messages'}</span>}
        </div>
      </div>

      <Card className="border-slate-700/70 bg-slate-900/75 text-white shadow-2xl shadow-black/10">
        <CardHeader className="border-b border-white/10 pb-5">
          <CardTitle className="text-base">Member conversations</CardTitle>
          <p className="text-sm text-slate-400">The optional email checkbox is available inside each ticket.</p>
        </CardHeader>
        <CardContent className="space-y-3 pt-6">
          {error && <p className="rounded-lg border border-rose-300/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}
          {tickets.length ? tickets.map((ticket) => (
            <Link className={`block rounded-xl border p-4 transition ${ticket.unread ? 'border-violet-300/40 bg-violet-300/10 hover:bg-violet-300/15' : 'border-white/10 bg-slate-950/30 hover:border-white/20 hover:bg-white/[0.04]'}`} to={`/support/${ticket.id}`} key={ticket.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{ticket.subject}</p>
                  <p className="mt-1 text-sm text-slate-400">{ticket.email}</p>
                </div>
                {ticket.unread ? <span className="shrink-0 rounded-full bg-violet-400/20 px-2 py-1 text-[11px] font-semibold text-violet-200">New message</span> : <span className="text-xs capitalize text-slate-400">{ticket.status}</span>}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />Updated {new Date(ticket.updated_at).toLocaleDateString()}</p>
            </Link>
          )) : <p className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-500">No support tickets.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

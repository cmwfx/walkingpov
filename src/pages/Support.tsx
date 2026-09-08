import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createTicket, getTickets } from '@/lib/api';
import type { SupportTicket } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]); const [subject, setSubject] = useState(''); const [body, setBody] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  const load = async () => { try { setTickets(await getTickets()); } catch { setError('Unable to load support tickets.'); } };
  useEffect(() => { void load(); }, []);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { const result = await createTicket(subject, body); navigate(`/support/${result.id}`); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create ticket.'); } finally { setBusy(false); } };
  return <div className="container mx-auto max-w-4xl px-4 py-12"><h1 className="text-3xl font-black">Private support</h1><p className="mt-2 text-slate-400">Only you and authorized CandidFan support staff can read these messages.</p><div className="mt-8 grid gap-6 md:grid-cols-5"><Card className="border-white/10 bg-white/[0.05] text-white md:col-span-3"><CardHeader><CardTitle>Start a ticket</CardTitle></CardHeader><CardContent><form onSubmit={(event) => void submit(event)} className="space-y-4"><div><Label htmlFor="subject">Subject</Label><Input id="subject" maxLength={160} required value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2" /></div><div><Label htmlFor="body">Message</Label><Textarea id="body" maxLength={10000} required value={body} onChange={(e) => setBody(e.target.value)} className="mt-2" /></div>{error && <p className="text-sm text-rose-300">{error}</p>}<Button disabled={busy} className="bg-gradient-to-r from-violet-600 to-sky-600">{busy ? 'Sending…' : 'Create ticket'}</Button></form></CardContent></Card><Card className="border-white/10 bg-white/[0.05] text-white md:col-span-2"><CardHeader><CardTitle>Your tickets</CardTitle></CardHeader><CardContent className="space-y-3">{tickets.length ? tickets.map((ticket) => <Link className="block rounded-lg border border-white/10 p-3 hover:bg-white/5" to={`/support/${ticket.id}`} key={ticket.id}><div className="flex justify-between gap-2"><span className="font-medium">{ticket.subject}</span><span className="text-xs capitalize text-violet-200">{ticket.status}</span></div><p className="mt-1 text-xs text-slate-500">Updated {new Date(ticket.updated_at).toLocaleDateString()}</p></Link>) : <p className="text-sm text-slate-500">No tickets yet.</p>}</CardContent></Card></div></div>;
}

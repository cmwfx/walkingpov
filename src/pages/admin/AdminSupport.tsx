import { useEffect, useState } from 'react';
import { ArrowLeft, LifeBuoy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getAdminTickets } from '@/lib/api';
import type { SupportTicket } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function AdminSupport() { const [tickets, setTickets] = useState<SupportTicket[]>([]); const [error, setError] = useState(''); useEffect(() => { getAdminTickets().then(setTickets).catch(() => setError('Unable to load support inbox.')); }, []); return <div className="container mx-auto max-w-4xl px-4 py-10"><Link to="/admin"><Button variant="ghost" className="text-slate-300"><ArrowLeft className="mr-2 h-4 w-4" />Admin</Button></Link><Card className="mt-5 border-white/10 bg-white/[0.05] text-white"><CardHeader><CardTitle className="flex items-center gap-2"><LifeBuoy className="h-5 w-5 text-violet-300" />Support inbox</CardTitle><p className="text-sm text-slate-400">The optional email checkbox is available inside each ticket.</p></CardHeader><CardContent className="space-y-3">{error && <p className="text-sm text-rose-300">{error}</p>}{tickets.length ? tickets.map((ticket) => <Link className="block rounded-lg border border-white/10 p-4 hover:bg-white/5" to={`/support/${ticket.id}`} key={ticket.id}><div className="flex justify-between gap-3"><span className="font-medium">{ticket.subject}</span><span className="text-xs capitalize text-violet-200">{ticket.status}</span></div><p className="mt-1 text-sm text-slate-400">{ticket.email}</p></Link>) : <p className="text-sm text-slate-500">No support tickets.</p>}</CardContent></Card></div>; }

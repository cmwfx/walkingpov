/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPaymentRequests, reviewPayment } from '@/lib/api';
import type { PaymentRequest } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

export function ReviewPayments() {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [error, setError] = useState('');
  const load = async () => { try { setRequests(await getPaymentRequests()); } catch { setError('Unable to load payment requests.'); } };
  useEffect(() => { void load(); }, []);
  const decide = async (id: string, decision: 'approved' | 'denied', notes: string) => { try { await reviewPayment(id, decision, notes); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save review.'); } };
  return <div className="container mx-auto max-w-4xl px-4 py-10"><Link to="/admin"><Button variant="ghost" className="text-slate-300"><ArrowLeft className="mr-2 h-4 w-4" />Admin</Button></Link><Card className="mt-5 border-white/10 bg-white/[0.05] text-white"><CardHeader><CardTitle>Payment review</CardTitle><p className="text-sm text-slate-400">Gift card proofs are decrypted only in this owner/admin view.</p></CardHeader><CardContent className="space-y-5">{error && <p className="text-sm text-rose-300">{error}</p>}{requests.length === 0 && <p className="text-sm text-slate-500">No pending payments.</p>}{requests.map((request) => <PaymentRow key={request.id} request={request} onDecide={decide} />)}</CardContent></Card></div>;
}

function PaymentRow({ request, onDecide }: { request: PaymentRequest; onDecide: (id: string, decision: 'approved' | 'denied', notes: string) => Promise<void> }) {
  const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false);
  const choose = async (decision: 'approved' | 'denied') => { setBusy(true); await onDecide(request.id, decision, notes); setBusy(false); };
  return <div className="rounded-xl border border-white/10 bg-black/20 p-5"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{request.email}</p><p className="text-xs text-slate-500">{new Date(request.created_at).toLocaleString()}</p></div><code className="rounded bg-white/5 px-2 py-1 text-sm text-violet-200">{request.proof}</code></div><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Optional internal note" className="mt-4" /><div className="mt-4 flex gap-2"><Button disabled={busy} onClick={() => void choose('approved')} className="bg-emerald-600 hover:bg-emerald-500"><Check className="mr-2 h-4 w-4" />Approve</Button><Button disabled={busy} onClick={() => void choose('denied')} variant="outline" className="border-rose-300/20 text-rose-200"><X className="mr-2 h-4 w-4" />Deny</Button></div></div>;
}

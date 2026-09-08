import { useEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { getPaymentRequests, reviewPayment } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';

export function ReviewPayments() {
  const [requests, setRequests] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const { toast } = useToast();
  const load = () => void getPaymentRequests().then(setRequests);
  useEffect(load, []);
  return <div className="container mx-auto max-w-4xl px-4 py-10"><div className="mb-8"><p className="text-sm uppercase tracking-[0.25em] text-violet-300">Payments</p><h1 className="mt-2 text-3xl font-bold text-white">Gift-card review</h1></div><div className="space-y-5">{requests.map((request) => <Card key={request.id} className="border-white/10 bg-white/5"><CardHeader><CardTitle className="flex items-center justify-between text-white"><span>{request.user_email}</span><span className="flex items-center gap-2 text-sm font-normal text-amber-200"><Clock className="h-4 w-4" />Pending</span></CardTitle></CardHeader><CardContent className="space-y-4"><div className="rounded-lg border border-white/10 bg-black/20 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Encrypted proof, decrypted only for this admin view</p><p className="mt-2 break-all font-mono text-sm text-slate-200">{request.proof}</p></div><Input value={notes[request.id] || ''} onChange={(event) => setNotes({ ...notes, [request.id]: event.target.value })} placeholder="Optional review note" maxLength={1000} /><div className="flex gap-3"><Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={busy === request.id} onClick={async () => { setBusy(request.id); try { await reviewPayment(request.id, 'approved', notes[request.id] || ''); load(); toast({ title: 'Payment approved' }); } catch (error) { toast({ title: 'Review failed', description: error instanceof Error ? error.message : 'Try again', variant: 'destructive' }); } finally { setBusy(''); } }}><CheckCircle className="mr-2 h-4 w-4" />Approve</Button><Button className="flex-1" variant="destructive" disabled={busy === request.id} onClick={async () => { setBusy(request.id); try { await reviewPayment(request.id, 'denied', notes[request.id] || ''); load(); toast({ title: 'Payment denied' }); } catch (error) { toast({ title: 'Review failed', description: error instanceof Error ? error.message : 'Try again', variant: 'destructive' }); } finally { setBusy(''); } }}><XCircle className="mr-2 h-4 w-4" />Deny</Button></div></CardContent></Card>)}{requests.length === 0 && <p className="py-16 text-center text-slate-500">No pending gift-card requests.</p>}</div></div>;
}


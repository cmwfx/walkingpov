import { useEffect, useState } from 'react';
import { ExternalLink, Gift, ShieldCheck } from 'lucide-react';
import { getMyPayments, getOffer, submitPayment } from '@/lib/api';
import { GIFT_CARD_LINK } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import type { PaymentRequest } from '@/lib/supabase';

export function PaymentSubmit() {
  const [proof, setProof] = useState('');
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [offer, setOffer] = useState<{ label: string; purchaseUrl: string }>({ label: '€50', purchaseUrl: GIFT_CARD_LINK });
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => { void Promise.all([getMyPayments(), getOffer()]).then(([history, nextOffer]) => { setRequests(history); setOffer(nextOffer); }); }, []);
  const pending = requests.some((request) => request.status === 'pending');
  return <div className="container mx-auto max-w-3xl px-4 py-10"><Card className="border-white/10 bg-white/5"><CardHeader><CardTitle className="flex items-center gap-2 text-white"><Gift className="h-5 w-5 text-violet-300" />Unlock lifetime access for {offer.label}</CardTitle><CardDescription>Purchase the supplied Rewarble Visa gift card, then send its proof for manual review.</CardDescription></CardHeader><CardContent className="space-y-6">
    <div className="rounded-xl border border-violet-400/20 bg-violet-400/10 p-5"><p className="text-sm text-slate-200">1. Buy the €50 card using the official purchase link.</p><a className="mt-3 inline-flex items-center text-sm text-violet-200 underline" href={offer.purchaseUrl} target="_blank" rel="noreferrer">Open purchase link <ExternalLink className="ml-2 h-4 w-4" /></a><p className="mt-4 text-sm text-slate-200">2. Paste the gift-card code or proof below. It is encrypted before storage and only decrypted for admin review.</p></div>
    <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); setLoading(true); try { await submitPayment(proof); setProof(''); setRequests(await getMyPayments()); toast({ title: 'Proof submitted', description: 'Your request is queued for review.' }); } catch (error) { toast({ title: 'Unable to submit', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' }); } finally { setLoading(false); } }}>
      <div className="space-y-2"><Label htmlFor="proof">Gift-card proof</Label><Input id="proof" value={proof} onChange={(event) => setProof(event.target.value)} maxLength={500} required disabled={pending} placeholder="Enter the code or proof provided by Rewarble" /></div>
      <Button type="submit" disabled={loading || pending}>{pending ? 'Already pending review' : loading ? 'Submitting securely…' : 'Submit for review'}</Button>
    </form>
    {requests.length > 0 && <div className="space-y-3"><h2 className="font-semibold text-white">Recent submissions</h2>{requests.map((request) => <div key={request.id} className="flex items-center justify-between rounded-lg border border-white/10 p-3 text-sm"><span className="text-slate-300">{new Date(request.created_at).toLocaleString()}</span><span className="capitalize text-violet-200">{request.status}</span></div>)}</div>}
    <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />CandidFan never accepts crypto payments. The outgoing hello@candidfan.com address is not monitored; use support tickets after signing in.</p>
  </CardContent></Card></div>;
}


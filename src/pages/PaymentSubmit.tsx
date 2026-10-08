import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, CheckCircle, Gift, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PaymentBenefits } from '@/components/PaymentBenefits';
import { PaymentFaq } from '@/components/PaymentFaq';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { CONTACT_INFO, GIFT_CARD_LINK } from '@/lib/utils';
import { submitPayment } from '@/lib/api';
import { getAnalyticsClientId, trackAnalyticsEvent } from '@/lib/analytics';

const paymentAnalytics = { currency: 'USD', value: 30, payment_page_version: 'giftcard_only_v1' };

export function PaymentSubmit() {
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const analyticsClientId = useRef<Promise<string | null> | null>(null);
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const hasPendingReview = user?.membership_status === 'pending';
  const isPremium = user?.membership_status === 'premium';

  useEffect(() => { analyticsClientId.current ??= getAnalyticsClientId(); }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading || !proof.trim()) return;
    setLoading(true);
    try {
      const gaClientId = await (analyticsClientId.current ?? getAnalyticsClientId());
      await submitPayment(proof.trim(), gaClientId);
      trackAnalyticsEvent('payment_proof_submitted', { ...paymentAnalytics, payment_method: 'gift_card' });
      await refreshUser();
      setSubmitted(true);
      toast({ title: 'Payment submitted!', description: 'Your gift-card code is under review. We will contact you soon.' });
    } catch (error) {
      toast({ title: 'Unable to submit payment', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (hasPendingReview || submitted) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-2xl rounded-2xl border-white/10 bg-slate-950/40">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center"><div className="rounded-full bg-amber-400/10 p-4"><CheckCircle className="size-12 text-amber-300" /></div></div>
            <CardTitle className="text-2xl">Payment Under Review</CardTitle>
            <CardDescription>{submitted ? 'Thank you. Your gift-card code is being verified.' : 'Your gift-card submission is still being reviewed. You do not need to submit it again.'}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className="min-h-12 w-full"><Link to="/dashboard">Go to Dashboard</Link></Button></CardContent>
        </Card>
      </div>
    );
  }

  if (isPremium) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-2xl rounded-2xl border-white/10 bg-slate-950/40">
          <CardHeader>
            <CardTitle className="text-2xl">Your CandidFan Premium is active</CardTitle>
            <CardDescription>Your existing CandidFan access is preserved. You do not need to pay again.</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className="min-h-12 w-full"><Link to="/dashboard">Return to Dashboard</Link></Button></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative isolate overflow-x-clip">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.12),transparent_65%)]" />
      <div className="mx-auto grid max-w-6xl gap-y-8 px-4 pb-16 pt-7 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-12 lg:gap-y-10 lg:pb-16 lg:pt-14">
        <header className="lg:col-start-1">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-violet-200"><Sparkles aria-hidden="true" className="size-3.5" /> CANDIDFAN PREMIUM</div>
          <h1 className="text-[2.25rem] font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">Full videos.<br /><span className="bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-transparent">One payment. Lifetime access.</span></h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base lg:mt-5 lg:text-lg lg:leading-7">Unlock full-video downloads from the CandidFan library for $30 once. Payment is handled by a REWARBLE VISA gift card and verified manually.</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-300 sm:text-sm lg:mt-6">
            {['Full downloads', 'Premium library', 'No recurring bills'].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3.5 text-violet-300" />{item}</span>)}
          </div>
        </header>

        <aside aria-label="Gift-card payment" className="lg:col-start-2 lg:row-start-1 lg:row-span-3">
          <div className="overflow-hidden rounded-3xl border border-violet-400/25 bg-slate-950/50 shadow-[0_24px_80px_-32px_rgba(124,58,237,0.35)]">
            <div aria-hidden="true" className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500" />
            <div className="p-5 sm:p-6">
              <p className="text-xs font-semibold tracking-[0.14em] text-violet-300">LIFETIME PREMIUM</p>
              <div className="mt-3 flex items-end gap-3"><span className="text-5xl font-semibold leading-none tracking-tight text-white">$30</span><span className="pb-1 text-sm text-slate-400">one-time payment</span></div>
              <p className="mt-2 text-sm text-slate-400"><span className="line-through">$120</span> <span className="ml-1 rounded-full bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-200">75% off</span></p>
              <p className="mt-3 text-sm font-medium text-slate-200">CandidFan Premium — lifetime access</p>
              <div className="mt-5 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
                <div className="flex items-center gap-3">
                  <Gift aria-hidden="true" className="size-5 shrink-0 text-violet-200" />
                  <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-white">REWARBLE VISA gift card</h2><p className="mt-0.5 text-xs font-medium text-violet-200">$30 gift-card payment</p></div>
                  <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-violet-300" />
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-300">Buy the $30 card from the retailer, then return here and submit its code for review.</p>
              </div>
              <a href={GIFT_CARD_LINK} target="_blank" rel="noopener noreferrer" onClick={() => trackAnalyticsEvent('gift_card_outbound_click', { ...paymentAnalytics, cta_location: 'payment_page' })} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition-colors hover:from-violet-500 hover:to-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">Buy the $30 gift card <ArrowRight aria-hidden="true" className="size-4 -rotate-45" /></a>
              <form onSubmit={handleSubmit} className="mt-6 space-y-3 border-t border-white/10 pt-5">
                <Label htmlFor="proof" className="text-sm text-slate-200">Enter your gift-card code</Label>
                <Input id="proof" aria-describedby="proof-help" placeholder="Gift-card code" value={proof} onChange={(event) => setProof(event.target.value)} maxLength={500} required autoCapitalize="characters" autoComplete="off" spellCheck={false} className="min-h-12 rounded-xl border-white/15 bg-slate-900 text-base text-white placeholder:text-slate-500" />
                <div id="proof-help" className="flex justify-between gap-2 text-xs text-slate-400"><span>Enter the code shown by the retailer</span><span className="shrink-0">{proof.length}/500</span></div>
                <Button type="submit" className="min-h-12 w-full rounded-xl" disabled={loading || !proof.trim()}>{loading ? 'Submitting...' : 'Submit gift-card code'}</Button>
              </form>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">Codes are reviewed {CONTACT_INFO.reviewTime}. We will email you when verification is complete.</p>
            </div>
            <div className="border-t border-white/10 px-5 py-3 text-center text-xs text-slate-400">Need a hand? <Link to="/support" className="inline-flex min-h-11 items-center font-medium text-violet-300 underline underline-offset-4 hover:text-violet-200">Contact support</Link></div>
          </div>
        </aside>

        <div className="lg:col-start-1 lg:row-start-2"><PaymentBenefits /></div>
        <div className="lg:col-start-1 lg:row-start-3"><PaymentFaq /></div>
      </div>
    </div>
  );
}

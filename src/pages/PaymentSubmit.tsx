import { Link } from 'react-router-dom';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Check, CheckCircle, ChevronDown, CreditCard, Gift, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PaymentBenefits } from '@/components/PaymentBenefits';
import { PaymentFaq } from '@/components/PaymentFaq';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { cn, CONTACT_INFO, GIFT_CARD_LINK, INSTANTVIDGRAB_CHECKOUT_ENABLED, INSTANTVIDGRAB_URL, MONTHLY_SUBSCRIPTIONS_ENABLED } from '@/lib/utils';
import { submitPayment } from '@/lib/api';
import { getAnalyticsClientId, trackAnalyticsEvent } from '@/lib/analytics';

const paymentAnalytics = { currency: 'EUR', value: 50, payment_page_version: 'v2' };
const checkoutButtonClass = 'flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition-colors hover:from-violet-500 hover:to-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';

function trackCardCheckout(location: 'payment_card' | 'payment_sticky', tier: 'monthly'|'lifetime') {
  trackAnalyticsEvent('card_checkout_outbound_click', { ...paymentAnalytics, value:tier === 'monthly' ? 9.99 : 50, pricing_tier:tier, cta_location: location });
}

export function PaymentSubmit() {
  const [tier,setTier] = useState<'monthly'|'lifetime'>(MONTHLY_SUBSCRIPTIONS_ENABLED && INSTANTVIDGRAB_CHECKOUT_ENABLED ? 'monthly' : 'lifetime');
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [giftCardOpen, setGiftCardOpen] = useState(!INSTANTVIDGRAB_CHECKOUT_ENABLED);
  const [mainCheckoutVisible, setMainCheckoutVisible] = useState(true);
  const [footerVisible, setFooterVisible] = useState(false);
  const checkoutButton = useRef<HTMLAnchorElement>(null);
  const checkoutTracked = useRef(false);
  const analyticsClientId = useRef<Promise<string | null> | null>(null);
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const hasPendingLegacyReview = user?.membership_status === 'pending';
  const isMonthlyPremium = user?.membership_status === 'premium' && user?.premium_plan === 'monthly';
  const isAlreadyPremium = user?.membership_status === 'premium' && !isMonthlyPremium;
  const selectedTier = isMonthlyPremium ? 'lifetime' : tier;
  const monthly = selectedTier === 'monthly';
  const checkoutUrl = `${INSTANTVIDGRAB_URL}/connect/start?intent=checkout&tier=${selectedTier}`;

  useEffect(() => { analyticsClientId.current ??= getAnalyticsClientId(); }, []);
  useEffect(() => {
    if (!user || hasPendingLegacyReview || isAlreadyPremium || checkoutTracked.current) return;
    checkoutTracked.current = true;
    trackAnalyticsEvent('begin_checkout', {...paymentAnalytics,value:monthly ? 9.99 : 50,pricing_tier:selectedTier});
  }, [hasPendingLegacyReview, isAlreadyPremium, user, monthly, selectedTier]);
  useEffect(() => {
    const button = checkoutButton.current;
    if (!button || !INSTANTVIDGRAB_CHECKOUT_ENABLED || typeof IntersectionObserver === 'undefined') return;
    const footer = document.querySelector('footer');
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === button) setMainCheckoutVisible(entry.isIntersecting);
        if (entry.target === footer) setFooterVisible(entry.isIntersecting);
      }
    }, { rootMargin: '-80px 0px 0px 0px' });
    observer.observe(button);
    if (footer) observer.observe(footer);
    return () => observer.disconnect();
  }, [hasPendingLegacyReview, isAlreadyPremium, submitted]);

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
      toast({ title: 'Payment submitted!', description: 'Your payment is under review. We will contact you soon.' });
    } catch (error) {
      toast({ title: 'Unable to submit payment', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setLoading(false); }
  };

  if (hasPendingLegacyReview || submitted) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-2xl rounded-2xl border-white/10 bg-slate-950/40">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center"><div className="rounded-full bg-amber-400/10 p-4"><CheckCircle className="size-12 text-amber-300" /></div></div>
            <CardTitle className="text-2xl">Payment Under Review</CardTitle>
            <CardDescription>{submitted ? 'Thank you for your submission. Your payment is being verified.' : 'Your earlier gift-card submission is still being reviewed. You do not need to submit it again.'}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className="min-h-12 w-full"><Link to="/dashboard">Go to Dashboard</Link></Button></CardContent>
        </Card>
      </div>
    );
  }
  if (isAlreadyPremium) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-2xl rounded-2xl border-white/10 bg-slate-950/40">
          <CardHeader>
            <CardTitle className="text-2xl">Your CandidFan Premium is active</CardTitle>
            <CardDescription>Your existing CandidFan access is preserved. We won’t ask you to pay again here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild className="min-h-12 w-full"><a href={`${INSTANTVIDGRAB_URL}/connect/start?intent=connect`}>Connect InstantVidGrab for free</a></Button>
            <Button asChild variant="outline" className="min-h-12 w-full"><Link to="/dashboard">Return to Dashboard</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="relative isolate overflow-x-clip">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[560px] bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.12),transparent_65%)]" />
      <div className="mx-auto grid max-w-6xl gap-y-8 px-4 pb-28 pt-7 sm:px-6 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-x-12 lg:gap-y-10 lg:pb-16 lg:pt-14">
        <header className="lg:col-start-1">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-violet-200"><Sparkles aria-hidden="true" className="size-3.5" /> CANDIDFAN PREMIUM</div>
          <h1 className="text-[2.25rem] font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">Full videos.<br /><span className="bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-transparent">Your choice of access.</span></h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300 sm:text-base lg:mt-5 lg:text-lg lg:leading-7">Download full videos from the CandidFan library.{MONTHLY_SUBSCRIPTIONS_ENABLED ? ' Start for €9.99 a month, or pay €50 once for lifetime Premium.' : ' Pay €50 once for lifetime Premium.'}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-slate-300 sm:text-sm lg:mt-6">
            {['Full downloads', 'Premium library', monthly ? 'Cancel renewal anytime' : 'No monthly bills'].map((item) => <span key={item} className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3.5 text-violet-300" />{item}</span>)}
          </div>
        </header>
        <aside aria-label="Choose your payment method" className="lg:col-start-2 lg:row-start-1 lg:row-span-3">
          <div className={cn('overflow-hidden rounded-3xl border border-violet-400/25 bg-slate-950/50 shadow-[0_24px_80px_-32px_rgba(124,58,237,0.35)]', !giftCardOpen && 'lg:sticky lg:top-24')}>
            <div aria-hidden="true" className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-blue-500" />
            <div className="p-5 sm:p-6">
              {MONTHLY_SUBSCRIPTIONS_ENABLED && INSTANTVIDGRAB_CHECKOUT_ENABLED && !isMonthlyPremium && <fieldset className="mb-6"><legend className="mb-3 text-sm font-semibold text-white">Choose your Premium plan</legend><div className="grid grid-cols-2 gap-2">{(['monthly','lifetime'] as const).map(option => <label key={option} className={cn('relative cursor-pointer rounded-xl border p-3',selectedTier === option ? 'border-violet-400 bg-violet-500/15' : 'border-white/15 bg-white/[0.03]')}><input type="radio" name="premium-plan" value={option} checked={selectedTier === option} onChange={() => {setTier(option);trackAnalyticsEvent('pricing_plan_selected',{pricing_tier:option,value:option === 'monthly' ? 9.99 : 50,currency:'EUR'});}} className="mr-2 accent-violet-500" /><span className="text-sm font-semibold">{option === 'monthly' ? 'Monthly' : 'Lifetime'}</span><span className="mt-2 block text-lg font-semibold">{option === 'monthly' ? '€9.99 / month' : '€50 once'}</span><span className="mt-1 block text-xs text-violet-200">{option === 'monthly' ? 'Cancel renewal anytime' : 'Best value'}</span></label>)}</div></fieldset>}
              {isMonthlyPremium && <p className="mb-4 rounded-xl border border-violet-400/25 bg-violet-500/10 p-3 text-sm text-violet-200">Your monthly Premium is active. Upgrade for €50 once and we’ll stop your monthly renewal after payment. Previous monthly payments are not credited.</p>}
              <p className="text-xs font-semibold tracking-[0.14em] text-violet-300">{monthly ? 'MONTHLY PREMIUM' : 'ONE-TIME UPGRADE'}</p>
              <div className="mt-3 flex items-end gap-3"><span className="text-5xl font-semibold leading-none tracking-tight text-white">{monthly ? '€9.99' : '€50'}</span><span className="pb-1 text-sm text-slate-400">{monthly ? 'per month' : 'One-time payment'}</span></div>
              <p className="mt-3 text-sm font-medium text-slate-200">{monthly ? 'Monthly' : 'Lifetime'} CandidFan Premium</p>
              {INSTANTVIDGRAB_CHECKOUT_ENABLED && <p className="mt-1 flex items-center gap-1.5 text-xs text-violet-200"><Check aria-hidden="true" className="size-3.5 shrink-0" /> InstantVidGrab included{monthly ? ' while your subscription is paid' : ' with card checkout'}</p>}
              {INSTANTVIDGRAB_CHECKOUT_ENABLED && <>
                <div className="mt-5 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
                  <div className="flex items-center gap-3">
                    <CreditCard aria-hidden="true" className="size-5 shrink-0 text-violet-200" />
                    <div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-white">Credit / debit card</h2><p className="mt-0.5 text-xs font-medium text-violet-200">Recommended</p></div>
                    <LockKeyhole aria-hidden="true" className="size-4 shrink-0 text-violet-300" />
                  </div>
                  <p className="mt-3 text-xs leading-5 text-slate-300">Premium activates automatically after payment confirmation.</p>
                </div>
                <a ref={checkoutButton} href={checkoutUrl} onClick={() => trackCardCheckout('payment_card', selectedTier)} className={cn(checkoutButtonClass, 'mt-4 w-full')}>{monthly ? 'Subscribe for €9.99 / month' : 'Get lifetime access — €50'} <ArrowRight aria-hidden="true" className="size-4 shrink-0" /></a>
                <p className="mt-3 text-center text-xs leading-5 text-slate-400">{monthly ? 'Renews every 30 days. Cancel renewal in one click on your dashboard; keep access through your paid period.' : 'No recurring bills.'} Final total shown before you pay.</p>
                <p className="mt-4 flex items-start justify-center gap-1.5 text-xs leading-5 text-slate-400"><LockKeyhole aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /> Card details handled by the payment provider.</p>
                <p className="mt-1 text-center text-xs leading-5 text-slate-400">Checkout continues on InstantVidGrab, then returns to CandidFan.</p>
              </>}
            </div>
            {!isMonthlyPremium && <details id="gift-card-payment" open={giftCardOpen} onToggle={(event) => {setGiftCardOpen(event.currentTarget.open);if (event.currentTarget.open) setTier('lifetime');}} className="group border-t border-white/10">
              <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-4 outline-none hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 sm:px-6 [&::-webkit-details-marker]:hidden">
                <Gift aria-hidden="true" className="size-5 shrink-0 text-slate-300" />
                <span className="flex-1"><span className="block text-sm font-medium text-slate-200">€50 lifetime access by gift card</span><span className="mt-1 block text-xs text-slate-400">REWARBLE VISA · manual review</span></span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-5 px-5 pb-6 sm:px-6">
                <div>
                  <p className="text-sm font-medium text-slate-200">1. Buy a €50 REWARBLE VISA gift card</p>
                  <p className="mt-2 text-xs leading-5 text-slate-400">The retailer opens in a new tab. Return here with your code to activate Premium.</p>
                  <a href={GIFT_CARD_LINK} target="_blank" rel="noopener noreferrer" onClick={() => trackAnalyticsEvent('gift_card_outbound_click', { ...paymentAnalytics, cta_location: 'gift_card_details' })} className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Buy €50 gift card <ArrowRight aria-hidden="true" className="size-4 -rotate-45" /></a>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <Label htmlFor="proof" className="text-sm text-slate-200">2. Enter your gift-card code</Label>
                  <Input id="proof" aria-describedby="proof-help" placeholder="e.g. PY4NW2H7EWKZKTS5" value={proof} onChange={(event) => setProof(event.target.value)} maxLength={500} required autoCapitalize="characters" autoComplete="off" spellCheck={false} className="min-h-12 rounded-xl border-white/15 bg-slate-900 text-base text-white placeholder:text-slate-500" />
                  <div id="proof-help" className="flex justify-between gap-2 text-xs text-slate-400"><span>Letters and numbers from your gift card</span><span className="shrink-0">{proof.length}/500</span></div>
                  <Button type="submit" className="min-h-12 w-full rounded-xl" disabled={loading || !proof.trim()}>{loading ? 'Submitting…' : 'Submit gift-card code'}</Button>
                </form>
                <p className="text-xs leading-5 text-slate-400">Reviewed {CONTACT_INFO.reviewTime}. We’ll email you when verification is complete.</p>
              </div>
            </details>}
            <div className="border-t border-white/10 px-5 py-3 text-center text-xs text-slate-400">Need a hand? <Link to="/support" className="inline-flex min-h-11 items-center font-medium text-violet-300 underline underline-offset-4 hover:text-violet-200">Contact support</Link></div>
          </div>
        </aside>
        <div className="lg:col-start-1 lg:row-start-2"><PaymentBenefits cardCheckoutEnabled={INSTANTVIDGRAB_CHECKOUT_ENABLED} tier={selectedTier} /></div>
        <div className="lg:col-start-1 lg:row-start-3"><PaymentFaq cardCheckoutEnabled={INSTANTVIDGRAB_CHECKOUT_ENABLED} /></div>
      </div>
      {INSTANTVIDGRAB_CHECKOUT_ENABLED && !mainCheckoutVisible && !footerVisible && !giftCardOpen && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-violet-400/20 bg-slate-950/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(0,0,0,0.2)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-4">
          <div className="shrink-0"><p className="text-xl font-semibold text-white">{monthly ? '€9.99' : '€50'}</p><p className="text-xs text-slate-400">{monthly ? 'per month' : 'Pay once'}</p></div>
          <a href={checkoutUrl} onClick={() => trackCardCheckout('payment_sticky', selectedTier)} className={cn(checkoutButtonClass, 'flex-1')}>{monthly ? 'Subscribe' : 'Secure checkout'} <ArrowRight aria-hidden="true" className="size-4 shrink-0" /></a>
        </div>
      </div>}
    </div>
  );
}

import { Crown, LifeBuoy, LockKeyhole } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { cancelSubscription, getSubscription, type BillingSummary } from '@/lib/api';
import { MONTHLY_SUBSCRIPTIONS_ENABLED } from '@/lib/utils';

export function Dashboard() {
  const { user, refreshUser } = useAuth();
  const [billing,setBilling] = useState<BillingSummary|null>(null);
  const [billingError,setBillingError] = useState('');
  const [cancelling,setCancelling] = useState(false);
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let active=true;
    void getSubscription().then(value => {if(active){setBilling(value);setBillingError('');}}).catch(() => {if(active)setBillingError('Could not load subscription details. Please retry.');});
    return () => {active=false;};
  },[user?.id,retry]);
  async function handleCancel() {
    if (cancelling) return;
    setCancelling(true);setBillingError('');
    try {
      await cancelSubscription();
      setBilling(await getSubscription());
      await refreshUser();
      trackAnalyticsEvent('subscription_cancel_succeeded',{pricing_tier:'monthly'});
    } catch(e) {setBillingError(e instanceof Error ? e.message : 'Could not confirm cancellation. Please retry.');}
    finally {setCancelling(false);}
  }
  const subscription=billing?.subscription;
  const monthly=user?.premium_plan === 'monthly';
  const paidThrough=subscription?.paidThrough ? new Date(subscription.paidThrough).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}) : null;
  const status = user?.membership_status;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8">
        <p className="text-sm text-violet-300">Member dashboard</p>
        <h1 className="mt-2 text-3xl font-black">Welcome back</h1>
        <p className="mt-2 text-slate-400">{user?.email}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <Card className="border-white/10 bg-white/[0.05] text-white md:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-5 w-5 text-amber-300" />Membership</CardTitle></CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{status}</p>
            <p className="mt-2 text-sm text-slate-400">{status === 'premium' ? `${monthly ? 'Monthly Premium' : 'Lifetime access'} is active. Protected downloads are available from each catalog item.` : status === 'pending' ? 'Your gift card proof is awaiting manual review.' : status === 'denied' ? 'Your last review was not approved. You can submit new proof when ready.' : MONTHLY_SUBSCRIPTIONS_ENABLED ? 'Choose €9.99 per month or €50 lifetime Premium.' : 'Card checkout starts at €50; a €50 gift card is also accepted.'}</p>
            {(status !== 'premium' || monthly) && <Link to="/payment" onClick={() => trackAnalyticsEvent('premium_cta_click', { cta_location: 'dashboard' })}><Button className="mt-5 bg-gradient-to-r from-violet-600 to-sky-600">{status === 'pending' ? 'View payment details' : monthly ? 'Upgrade to lifetime — €50' : 'Choose your Premium plan'}</Button></Link>}
            {subscription && <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/30 p-4">
              <h2 className="font-semibold">Monthly subscription · €9.99</h2>
              {subscription.cancelAtPeriodEnd ? <p role="status" className="mt-2 text-sm text-violet-200">Renewal cancelled.{paidThrough && ` Access until ${paidThrough}.`}</p> : ['canceled','expired'].includes(subscription.status) ? <p className="mt-2 text-sm text-slate-400">Your monthly subscription has ended.</p> : <>
                <p className="mt-2 text-sm text-slate-400">{paidThrough ? `Paid access through ${paidThrough}.` : 'Payment confirmation is pending.'} {subscription.currentPeriodEnd && `Next renewal: ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}.`}</p>
                <p className="mt-2 text-xs text-slate-400">Cancel renewal with one click. Keep access through your paid period.</p>
                {subscription.cancellationPending && <p role="status" className="mt-3 text-sm text-amber-300">Lifetime is active; stopping monthly renewal is still being confirmed. You can retry cancellation below.</p>}
                <Button variant="outline" className="mt-4 min-h-11 border-white/20" disabled={cancelling} onClick={() => void handleCancel()}>{cancelling ? 'Cancelling…' : 'Cancel subscription'}</Button>
              </>}
            </div>}
            {billingError && <div role="alert" className="mt-4 text-sm text-amber-300"><p>{billingError}</p><Button variant="outline" className="mt-2" onClick={() => setRetry(v=>v+1)}>Retry subscription details</Button></div>}
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-white/[0.05] text-white">
          <CardHeader><CardTitle>Need help?</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-slate-400">Contact the owner privately from your member account.</p><Link to="/support"><Button variant="outline" className="mt-5 border-white/15 text-white"><LifeBuoy className="mr-2 h-4 w-4" />Open support</Button></Link></CardContent>
        </Card>
      </div>

      <div className="mt-5">
        <Link to="/" className="block max-w-sm">
          <Card className="h-full border-white/10 bg-white/[0.05] transition hover:bg-white/[0.08]">
            <CardContent className="p-6"><LockKeyhole className="h-5 w-5 text-violet-300" /><h2 className="mt-4 font-semibold">Browse catalog</h2><p className="mt-1 text-sm text-slate-400">See every ready item.</p></CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

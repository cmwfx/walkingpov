import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useState, type FormEvent } from 'react';
import { PremiumBenefits } from '@/components/PremiumBenefits';
import { DiscountTimer } from '@/components/DiscountTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { CONTACT_INFO, GIFT_CARD_LINK } from '@/lib/utils';
import { submitPayment } from '@/lib/api';
import { CheckCircle, CreditCard, ExternalLink, Sparkles } from 'lucide-react';

export function PaymentSubmit() {
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const hasPendingLegacyReview = user?.membership_status === 'pending';
  const isAlreadyPremium = user?.membership_status === 'premium';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await submitPayment(proof.trim());
      await refreshUser();
      setSubmitted(true);
      toast({ title: 'Payment submitted!', description: 'Your payment is under review. We will contact you soon.' });
    } catch (error) {
      toast({
        title: 'Unable to submit payment',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (hasPendingLegacyReview || submitted) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="text-center">
            <div className="mb-4 flex justify-center"><div className="rounded-full bg-yellow-100 p-4 dark:bg-yellow-900"><CheckCircle className="size-12 text-yellow-600" /></div></div>
            <CardTitle className="text-2xl">Payment Under Review</CardTitle>
            <CardDescription>{submitted ? 'Thank you for your submission. Your payment is being verified.' : 'Your earlier gift-card submission is still being reviewed. You do not need to submit it again.'}</CardDescription>
          </CardHeader>
          <CardContent><Button asChild className="w-full"><Link to="/dashboard">Go to Dashboard</Link></Button></CardContent>
        </Card>
      </div>
    );
  }

  if (isAlreadyPremium) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="mx-auto max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Your CandidFan Premium is active</CardTitle>
            <CardDescription>Your existing CandidFan access is preserved. We won’t ask you to pay again here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button asChild variant="outline" className="w-full"><Link to="/dashboard">Return to Dashboard</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
            <Sparkles className="size-4 text-yellow-500" /> Celebrating 10k Members! <span className="border-l border-primary/20 pl-3">Offer ends in <DiscountTimer /></span>
          </div>
          <h1 className="mb-3 text-4xl font-bold">Lifetime Premium Access</h1>
          <p className="mb-8 text-xl text-muted-foreground">One-time payment of €50</p>
          <div className="mx-auto mb-12 max-w-xl text-left"><PremiumBenefits className="rounded-xl border bg-muted/30 p-6" /></div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>REWARBLE VISA Gift Card Payment</CardTitle>
            <CardDescription>Purchase a €50 REWARBLE VISA gift card from the link below and submit its code. The retailer accepts PayPal, Visa, Mastercard, and other payment methods.</CardDescription>
          </CardHeader>
          <CardContent>
            <a href={GIFT_CARD_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg bg-primary p-4 text-primary-foreground transition-colors hover:bg-primary/90">
              <CreditCard className="size-5" /> Purchase REWARBLE VISA Gift Card <ExternalLink className="size-4" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gift Card Code</CardTitle>
            <CardDescription>Your code looks like PY4NW2H7EWKZKTS5 with letters and numbers.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proof">Gift Card Code</Label>
                <Input id="proof" placeholder="PY4NW2H7EWKZKTS5" value={proof} onChange={(event) => setProof(event.target.value)} maxLength={500} required />
                <div className="flex items-center justify-between text-xs text-muted-foreground"><span>Maximum 500 characters</span><span className={proof.length > 450 ? 'text-yellow-600' : ''}>{proof.length}/500</span></div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Submitting...' : 'Submit Payment'}</Button>
            </form>
            <div className="mt-5 space-y-1 text-sm text-muted-foreground">
              <p>Review time: {CONTACT_INFO.reviewTime}.</p>
              <p>Questions? <Link to="/support" className="text-primary hover:underline">Open support</Link> or email <a className="text-primary hover:underline" href={`mailto:${CONTACT_INFO.email}`}>{CONTACT_INFO.email}</a>.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

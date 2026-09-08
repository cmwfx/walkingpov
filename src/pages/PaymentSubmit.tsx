import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PremiumBenefits } from '@/components/PremiumBenefits';
import { DiscountTimer } from '@/components/DiscountTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { GIFT_CARD_LINK, CONTACT_INFO } from '@/lib/utils';
import { submitPayment } from '@/lib/api';
import { ExternalLink, CreditCard, CheckCircle, Sparkles } from 'lucide-react';

export function PaymentSubmit() {
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await submitPayment(proof.trim());
      await refreshUser();
      setSubmitted(true);

      toast({
        title: 'Payment submitted!',
        description: 'Your payment is under review. We will contact you soon.',
      });

    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to submit payment. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (user?.membership_status === 'pending' || submitted) {
    return (
      <div className="container mx-auto px-4 py-16">
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 rounded-full bg-yellow-100 dark:bg-yellow-900">
                <CheckCircle className="h-12 w-12 text-yellow-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">Payment Under Review</CardTitle>
            <CardDescription>
              Thank you for your submission! Your payment is being verified.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold">Contact Information:</h3>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium">Telegram:</span>{' '}
                  <a href={`https://t.me/${CONTACT_INFO.telegram.replace('@', '')}`}
                     className="text-primary hover:underline"
                     target="_blank"
                     rel="noopener noreferrer">
                    {CONTACT_INFO.telegram}
                  </a>
                </p>
                <p>
                  <span className="font-medium">Email:</span>{' '}
                  <a href={`mailto:${CONTACT_INFO.email}`} className="text-primary hover:underline">
                    {CONTACT_INFO.email}
                  </a>
                </p>
                <p>
                  <span className="font-medium">Review Time:</span> {CONTACT_INFO.reviewTime}
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 rounded-xl bg-primary/10 mb-6 border border-primary/20 backdrop-blur-sm animate-pulse">
            <div className="flex items-center gap-2 mr-3">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <span className="font-bold text-base bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">Celebrating 10k Members!</span>
            </div>
            <div className="flex items-center gap-2 border-l border-primary/20 pl-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Offer Ends In</span>
              <DiscountTimer />
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-2">Lifetime Premium Access</h1>
          <p className="text-xl text-muted-foreground mb-8">One-time payment of €50</p>

          <div className="max-w-xl mx-auto text-left mb-12">
            <PremiumBenefits className="bg-muted/30 p-6 rounded-xl border" />
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>REWARBLE VISA Gift Card Payment</CardTitle>
            <CardDescription>
              Purchase a €50 REWARBLE VISA gift card from the link below and submit the gift card code. Pay with Paypal, Visa, Mastercard, Crypto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <a
              href={GIFT_CARD_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <CreditCard className="h-5 w-5" />
              Purchase REWARBLE VISA Gift Card
              <ExternalLink className="h-4 w-4" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gift Card Code</CardTitle>
            <CardDescription>
              Your code looks like PY4NW2H7EWKZKTS5 with letters and numbers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proof">
                  Gift Card Code
                </Label>
                <Input
                  id="proof"
                  placeholder="PY4NW2H7EWKZKTS5"
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  maxLength={500}
                  required
                />
                <div className="flex justify-between items-center text-xs text-muted-foreground">
                  <span>Maximum 500 characters</span>
                  <span className={proof.length > 450 ? 'text-yellow-600' : ''}>
                    {proof.length}/500
                  </span>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Payment'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

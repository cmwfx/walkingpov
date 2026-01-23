import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { PremiumBenefits } from '@/components/PremiumBenefits';
import { DiscountTimer } from '@/components/DiscountTimer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/supabase';
import { CRYPTO_ADDRESSES, GIFT_CARD_LINK, CONTACT_INFO } from '@/lib/utils';
import { Copy, ExternalLink, Wallet, CreditCard, CheckCircle, Sparkles } from 'lucide-react';

export function PaymentSubmit() {
  const [paymentType, setPaymentType] = useState<'crypto' | 'giftcard'>('crypto');
  const [proof, setProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied!',
      description: `${label} address copied to clipboard`,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get the current authenticated user's ID
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        throw new Error('Not authenticated');
      }

      const { error } = await supabase.from('payment_requests').insert({
        user_id: authUser.id,
        payment_type: paymentType,
        proof: proof.trim(),
        status: 'pending',
      });

      if (error) {
        console.error('Payment insert error:', error);
        throw error;
      }

      // Update user's payment method
      const { error: updateError } = await supabase
        .from('users')
        .update({
          payment_method: paymentType,
          payment_proof: proof.trim(),
          membership_status: 'pending',
        })
        .eq('id', authUser.id);

      if (updateError) {
        console.error('User update error:', updateError);
        throw updateError;
      }

      refreshUser();
      setSubmitted(true);
      
      toast({
        title: 'Payment submitted!',
        description: 'Your payment is under review. We will contact you soon.',
      });

    } catch (err: any) {
      console.error('Payment submission error:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to submit payment. Please try again.',
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
          <p className="text-xl text-muted-foreground mb-8">One-time payment of $30</p>
          
          <div className="max-w-xl mx-auto text-left mb-12">
            <PremiumBenefits className="bg-muted/30 p-6 rounded-xl border" />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card 
            className={`cursor-pointer transition-all ${
              paymentType === 'crypto' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setPaymentType('crypto')}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                <CardTitle>Cryptocurrency</CardTitle>
              </div>
              <CardDescription>Pay with BTC, LTC, or USDT</CardDescription>
            </CardHeader>
          </Card>

          <Card 
            className={`cursor-pointer transition-all ${
              paymentType === 'giftcard' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => setPaymentType('giftcard')}
          >
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>REWARBLE VISA Gift Card</CardTitle>
              </div>
              <CardDescription>Pay with Paypal, Visa, Mastercard etc</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {paymentType === 'crypto' ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Cryptocurrency Addresses</CardTitle>
              <CardDescription>
                Send $30 worth of crypto to one of these addresses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(CRYPTO_ADDRESSES).map(([currency, { address, network }]) => (
                <div key={currency} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold">{currency}</div>
                    <div className="text-xs text-muted-foreground mb-1">
                      Network: {network}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono break-all">
                      {address}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(address, currency)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>REWARBLE VISA Gift Card Payment</CardTitle>
              <CardDescription>
                Purchase a $30 REWARBLE VISA gift card from the link below and submit the gift card code
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
        )}

        <Card>
          <CardHeader>
            <CardTitle>Submit Payment Proof</CardTitle>
            <CardDescription>
              {paymentType === 'crypto' 
                ? 'Enter your transaction ID or hash'
                : 'Enter your REWARBLE VISA gift card code'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proof">
                  {paymentType === 'crypto' ? 'Transaction ID' : 'REWARBLE VISA Gift Card Code'}
                </Label>
                <Input
                  id="proof"
                  placeholder={
                    paymentType === 'crypto' 
                      ? 'Enter transaction hash/ID'
                      : 'Enter REWARBLE VISA gift card code'
                  }
                  value={proof}
                  onChange={(e) => setProof(e.target.value)}
                  required
                />
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

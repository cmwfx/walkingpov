import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CodeInput } from '@/components/CodeInput';
import { useToast } from '@/components/ui/use-toast';

export function VerifyEmail() {
  const { verifyEmailCode, resendVerificationCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState<string>('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    // Get email from navigation state
    const stateEmail = location.state?.email;
    if (stateEmail) {
      setEmail(stateEmail);
    } else {
      // If no email in state, redirect to signup
      toast({
        title: 'Email required',
        description: 'Please sign up first to verify your email',
        variant: 'destructive',
      });
      navigate('/signup');
    }
  }, [location.state, navigate, toast]);

  useEffect(() => {
    // Cooldown timer
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleCodeComplete = async (code: string) => {
    if (!email) return;

    setVerifying(true);
    try {
      const { error } = await verifyEmailCode(email, code);

      if (error) {
        toast({
          title: 'Verification failed',
          description: error.message || 'Invalid or expired code. Please try again.',
          variant: 'destructive',
        });
      } else {
        setVerified(true);
        toast({
          title: 'Email verified!',
          description: 'Redirecting you to payment...',
        });
        
        // Redirect after 2 seconds
        setTimeout(() => {
          navigate('/payment');
        }, 2000);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (!email || cooldown > 0) return;

    setResending(true);
    try {
      const { error } = await resendVerificationCode(email);

      if (error) {
        toast({
          title: 'Resend failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Code sent!',
          description: 'A new verification code has been sent to your email.',
        });
        setCooldown(60); // 60 second cooldown
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Failed to resend code',
        variant: 'destructive',
      });
    } finally {
      setResending(false);
    }
  };

  if (verified) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Email Verified!</CardTitle>
            <CardDescription className="text-center">
              Redirecting you to payment...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Mail className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            We sent an 8-digit code to <strong>{email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="text-center space-y-1">
              <p className="text-sm text-muted-foreground">
                Enter the verification code from your email
              </p>
              <p className="text-xs text-muted-foreground/80">
                Can't find it? Check your spam or junk folder
              </p>
            </div>
            
            <CodeInput 
              length={8}
              onComplete={handleCodeComplete} 
              disabled={verifying}
            />

            {verifying && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verifying code...</span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Didn't receive the code?
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleResendCode}
              disabled={resending || cooldown > 0}
            >
              {resending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                `Resend code in ${cooldown}s`
              ) : (
                'Resend Code'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

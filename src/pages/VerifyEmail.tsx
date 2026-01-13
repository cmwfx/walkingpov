import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function VerifyEmail() {
  const { user, loading, session } = useAuth();
  const navigate = useNavigate();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Check if user is authenticated (either user or session exists)
    if (!loading && (user || session) && !hasRedirected) {
      console.log('User verified, redirecting to payment...', { user, session });
      setHasRedirected(true);
      
      // Redirect to payment page after showing success message
      const timer = setTimeout(() => {
        navigate('/payment');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [user, session, loading, navigate, hasRedirected]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Verifying your email...</CardTitle>
            <CardDescription className="text-center">
              Please wait while we confirm your account
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // If not loading but no user/session, show error
  if (!loading && !user && !session) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 rounded-full bg-red-100 dark:bg-red-900">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-center">Verification Issue</CardTitle>
            <CardDescription className="text-center">
              We couldn't verify your email. The link may have expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Please try logging in or signing up again.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/login')} variant="outline" className="flex-1">
                Login
              </Button>
              <Button onClick={() => navigate('/signup')} className="flex-1">
                Sign Up
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Email verified!</CardTitle>
          <CardDescription className="text-center">
            Redirecting you to the payment page...
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            You'll be able to select your payment method and submit payment information
          </p>
          <Button onClick={() => navigate('/payment')} className="w-full">
            Continue to Payment
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CONTACT_INFO } from '@/lib/utils';
import { User, Crown, Clock, XCircle, KeyRound } from 'lucide-react';

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    return null;
  }

  const getStatusIcon = () => {
    switch (user.membership_status) {
      case 'premium':
        return <Crown className="h-8 w-8 text-yellow-500" />;
      case 'pending':
        return <Clock className="h-8 w-8 text-yellow-500" />;
      case 'denied':
        return <XCircle className="h-8 w-8 text-red-500" />;
      default:
        return <User className="h-8 w-8 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (user.membership_status) {
      case 'premium':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'denied':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusMessage = () => {
    switch (user.membership_status) {
      case 'premium':
        return 'You have lifetime premium access! Enjoy unlimited downloads.';
      case 'pending':
        return 'Your payment is under review. We will contact you soon.';
      case 'denied':
        return 'Your payment was not approved. Please contact support or try again.';
      default:
        return 'Complete your payment to unlock premium access and download all videos.';
    }
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Dashboard</h1>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-muted">
                {getStatusIcon()}
              </div>
              <div>
                <CardTitle>Account Status</CardTitle>
                <CardDescription className={`text-lg font-semibold ${getStatusColor()}`}>
                  {user.membership_status.toUpperCase()}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{getStatusMessage()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Member Since:</span>
              <span className="font-medium">
                {new Date(user.created_at).toLocaleDateString()}
              </span>
            </div>
            {user.payment_method && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="font-medium capitalize">{user.payment_method}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Security Settings
            </CardTitle>
            <CardDescription>
              Manage your account security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Password</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Change your password to keep your account secure
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/forgot-password')}
                  className="w-full sm:w-auto"
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {user.membership_status === 'free' && (
          <Card className="border-primary bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Complete Your Payment
              </CardTitle>
              <CardDescription>
                Get lifetime access to all download links for just $30
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You've verified your email! Now complete your payment to unlock premium access and download all videos.
              </p>
              <Button onClick={() => navigate('/payment')} className="w-full">
                Continue to Payment
              </Button>
            </CardContent>
          </Card>
        )}

        {user.membership_status === 'pending' && (
          <Card className="bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>
                If you have any questions about your payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telegram:</span>
                <a
                  href={`https://t.me/${CONTACT_INFO.telegram.replace('@', '')}`}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {CONTACT_INFO.telegram}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <a
                  href={`mailto:${CONTACT_INFO.email}`}
                  className="text-primary hover:underline"
                >
                  {CONTACT_INFO.email}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Review Time:</span>
                <span>{CONTACT_INFO.reviewTime}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {user.membership_status === 'denied' && (
          <Card className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle>Payment Denied</CardTitle>
              <CardDescription>
                Please contact support or submit a new payment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <a
                    href={`mailto:${CONTACT_INFO.email}`}
                    className="text-primary hover:underline"
                  >
                    {CONTACT_INFO.email}
                  </a>
                </div>
              </div>
              <Button onClick={() => navigate('/payment')} variant="outline" className="w-full">
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

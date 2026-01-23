import { useEffect, useState } from 'react';
import { supabase, type PaymentRequest } from '@/lib/supabase';
import { API_URL } from '@/lib/utils';
import { getAuthHeaders } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { CheckCircle, XCircle, Clock, ArrowLeft, User as UserIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '@/lib/utils';

interface PaymentRequestWithUser extends PaymentRequest {
  user_email?: string;
}

export function ReviewPayments() {
  const [requests, setRequests] = useState<PaymentRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPaymentRequests();
  }, []);

  const fetchPaymentRequests = async () => {
    setLoading(true);
    try {
      const { data: requestsData, error: requestsError } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (requestsError) throw requestsError;

      // Fetch user emails for each request
      const requestsWithUsers = await Promise.all(
        (requestsData || []).map(async (request) => {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', request.user_id)
            .single();

          return {
            ...request,
            user_email: userData?.email || 'Unknown',
          };
        })
      );

      setRequests(requestsWithUsers);
    } catch (error) {
      console.error('Error fetching payment requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payment requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (requestId: string, status: 'approved' | 'denied') => {
    setProcessingId(requestId);

    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      // Update payment request
      const { error: requestError } = await supabase
        .from('payment_requests')
        .update({
          status,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          notes: notes[requestId] || null,
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      // Update user membership status
      const { error: userError } = await supabase
        .from('users')
        .update({
          membership_status: status === 'approved' ? 'premium' : 'denied',
        })
        .eq('id', request.user_id);

      if (userError) throw userError;

      // Send email notification
      try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_URL}/api/payments/notify-review`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            email: request.user_email,
            status,
            reason: notes[requestId],
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to send email notification');
          toast({
            title: 'Warning',
            description: 'Payment updated but email notification failed to send',
            variant: 'destructive',
          });
        }
      } catch (emailError) {
        console.error('Error sending email:', emailError);
        // Don't throw here to avoid rolling back the UI state if email fails
        toast({
          title: 'Warning',
          description: 'Payment updated but email notification failed to send',
          variant: 'destructive',
        });
      }

      toast({
        title: status === 'approved' ? 'Payment Approved' : 'Payment Denied',
        description: `Successfully ${status} payment request`,
      });

      // Remove from list
      setRequests(requests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Error reviewing payment:', error);
      toast({
        title: 'Error',
        description: 'Failed to process payment request',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link to="/admin">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </Button>
      </Link>

      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Review Payments</h1>
          <p className="text-muted-foreground">
            {requests.length > 0 
              ? `${requests.length} payment${requests.length > 1 ? 's' : ''} pending review`
              : 'No pending payments'
            }
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-muted">
                  <CheckCircle className="h-12 w-12 text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground">There are no pending payment requests</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {requests.map((request) => (
              <Card key={request.id} className="border-2">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <UserIcon className="h-5 w-5" />
                        {request.user_email}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Submitted on {formatDate(request.created_at)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">Pending</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                    <div>
                      <Label className="text-muted-foreground">Payment Method</Label>
                      <p className="font-medium capitalize">{request.payment_type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {request.payment_type === 'crypto' ? 'Transaction ID' : 'Gift Card Code'}
                      </Label>
                      <p className="font-mono text-sm break-all">{request.proof}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`notes-${request.id}`}>Review Notes (Optional)</Label>
                    <Input
                      id={`notes-${request.id}`}
                      placeholder="Add any notes about this review..."
                      value={notes[request.id] || ''}
                      onChange={(e) => setNotes({ ...notes, [request.id]: e.target.value })}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleReview(request.id, 'approved')}
                      disabled={processingId !== null}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {processingId === request.id ? 'Processing...' : 'Approve'}
                    </Button>
                    <Button
                      onClick={() => handleReview(request.id, 'denied')}
                      disabled={processingId !== null}
                      variant="destructive"
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {processingId === request.id ? 'Processing...' : 'Deny'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

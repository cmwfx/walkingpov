import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ApiRequestError, authorizeInstantVidGrab } from '@/lib/api';
import { INSTANTVIDGRAB_URL } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ShieldCheck } from 'lucide-react';

const HANDOFF_TOKEN = /^[A-Za-z0-9_-]{43,128}$/;
const VIDEO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function InstantVidGrabAuthorize() {
  const { user, session, loading } = useAuth();
  const location = useLocation();
  const attempted = useRef(false);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [alreadyPremium, setAlreadyPremium] = useState(false);
  const returnTo = `${location.pathname}${location.search}`;
  const handoff = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const state = params.get('state') || '';
    const challenge = params.get('challenge') || '';
    const intentValue = params.get('intent') || '';
    const selectedVideoId = params.get('videoId') || undefined;
    const validIntent = intentValue === 'checkout' || intentValue === 'download' || intentValue === 'connect';
    const valid = HANDOFF_TOKEN.test(state) && HANDOFF_TOKEN.test(challenge) && validIntent &&
      (intentValue !== 'download' || Boolean(selectedVideoId && VIDEO_ID.test(selectedVideoId))) &&
      (!selectedVideoId || VIDEO_ID.test(selectedVideoId));
    return valid ? {
      state,
      challenge,
      intent: intentValue as 'checkout' | 'download' | 'connect',
      ...(selectedVideoId ? { selectedVideoId } : {}),
    } : null;
  }, [location.search]);

  useEffect(() => {
    if (loading || !user || !session?.user.email_confirmed_at || !handoff || attempted.current) return;
    attempted.current = true;
    void authorizeInstantVidGrab(handoff).then(({ redirect_to }) => {
      const callback = new URL(redirect_to);
      const expected = new URL(INSTANTVIDGRAB_URL);
      if (callback.origin !== expected.origin || callback.pathname !== '/connect/callback' ||
        callback.searchParams.get('state') !== handoff.state || !callback.searchParams.get('code') ||
        callback.searchParams.size !== 2) {
        throw new Error('The secure account connection returned an invalid address.');
      }
      window.location.assign(callback.toString());
    }).catch((reason: unknown) => {
      if (reason instanceof ApiRequestError && reason.status === 409) setAlreadyPremium(true);
      setError(reason instanceof Error ? reason.message : 'The account connection could not be started.');
    });
  }, [handoff, loading, retry, session, user]);

  if (loading) {
    return <div className="container mx-auto flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" aria-label="Loading account" /></div>;
  }
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  if (session?.user.email_confirmed_at == null) {
    return <Navigate to="/verify-email" state={{ email: user.email, returnTo }} replace />;
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <Card className="mx-auto max-w-xl">
        <CardHeader className="text-center">
          <div className="mb-3 flex justify-center"><ShieldCheck className="size-10 text-primary" /></div>
          <CardTitle className="text-2xl">Secure account connection</CardTitle>
          <CardDescription>We’re linking your verified CandidFan account to InstantVidGrab to continue. Your passwords and card details are never shared between the sites.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!handoff && <p role="alert" className="text-center text-sm text-destructive">This connection request is invalid or incomplete. Return to the payment page and try again.</p>}
          {handoff && !error && <p role="status" className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Verifying your CandidFan account…</p>}
          {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
          {alreadyPremium && <Button asChild className="w-full"><a href={`${INSTANTVIDGRAB_URL}/connect/start?intent=connect`}>Connect InstantVidGrab for free</a></Button>}
          {error && handoff && !alreadyPremium && <Button className="w-full" onClick={() => { attempted.current = false; setError(''); setRetry((value) => value + 1); }}>Try again</Button>}
          <Button asChild variant="outline" className="w-full"><Link to="/payment">Return to payment</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}

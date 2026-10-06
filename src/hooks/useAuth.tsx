/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ApiRequestError, getMe } from '@/lib/api';
import { trackAnalyticsEvent } from '@/lib/analytics';
import { supabase, type User } from '@/lib/supabase';

type AuthContext = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  verifyEmailCode: (email: string, token: string) => Promise<{ error: Error | null }>;
  resendVerificationCode: (email: string) => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  resetPasswordWithCode: (email: string, token: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  isPremium: boolean;
  isAdmin: boolean;
};
const Context = createContext<AuthContext | null>(null);

// Supabase Auth requests normally complete in well under a second, but a
// browser/network interruption can leave fetch pending indefinitely. Keep the
// auth UI recoverable and let the caller show a retry message instead of
// leaving a button disabled forever.
const AUTH_REQUEST_TIMEOUT_MS = 30_000;

function withAuthTimeout<T>(request: Promise<T>, operation: string): Promise<T> {
  return Promise.race([
    request,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(`${operation} is taking longer than expected. Check your connection and try again.`));
      }, AUTH_REQUEST_TIMEOUT_MS);
    }),
  ]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshUser = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const request = (async () => {
      try {
        setUser((await getMe()).user);
      } catch (error) {
        // Clear stale access only when the server explicitly rejects the session.
        // Transient outages must not turn a returning customer into a signed-out UI.
        if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
          setUser(null);
        }
      }
    })();
    refreshInFlight.current = request;
    try {
      await request;
    } finally {
      if (refreshInFlight.current === request) refreshInFlight.current = null;
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    let initialLoadStarted = false;
    const load = async (nextSession: Session | null, shouldRefresh: boolean) => {
      if (!mounted) return;
      setSession(nextSession);
      if (!nextSession) setUser(null);
      else if (shouldRefresh) await refreshUser();
      if (mounted) setLoading(false);
    };
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') {
        if (initialLoadStarted) return;
        initialLoadStarted = true;
        void load(nextSession, true);
        return;
      }
      void load(nextSession, event === 'SIGNED_IN' || event === 'USER_UPDATED');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (initialLoadStarted) return;
      initialLoadStarted = true;
      void load(data.session, true);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, [refreshUser]);
  useEffect(() => {
    if (!session?.access_token) return;
    let lastRefreshAt = 0;
    const refreshOnReturn = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefreshAt < 1_000) return;
      lastRefreshAt = now;
      void refreshUser();
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, [refreshUser, session?.access_token]);
  const value = useMemo<AuthContext>(() => ({
    user, session, loading,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) trackAnalyticsEvent('login', { method: 'email' });
      return { error };
    },
    signUp: async (email, password) => {
      try {
        const { error } = await withAuthTimeout(
          supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/verify-email` } }),
          'Account creation',
        );
        if (!error) trackAnalyticsEvent('sign_up', { method: 'email' });
        return { error };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error('Unable to create your account. Please try again.') };
      }
    },
    verifyEmailCode: async (email, token) => {
      try {
        const { error } = await withAuthTimeout(
          supabase.auth.verifyOtp({ email, token, type: 'signup' }),
          'Email verification',
        );
        if (!error) trackAnalyticsEvent('email_verified', { method: 'email' });
        return { error };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error('Unable to verify your email. Please try again.') };
      }
    },
    resendVerificationCode: async (email) => {
      try {
        const { error } = await withAuthTimeout(
          supabase.auth.resend({ type: 'signup', email }),
          'Verification email delivery',
        );
        return { error };
      } catch (error) {
        return { error: error instanceof Error ? error : new Error('Unable to resend the verification code. Please try again.') };
      }
    },
    requestPasswordReset: async (email) => { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); return { error }; },
    resetPasswordWithCode: async (email, token, password) => { const verified = await supabase.auth.verifyOtp({ email, token, type: 'recovery' }); if (verified.error) return { error: verified.error }; const { error } = await supabase.auth.updateUser({ password }); return { error }; },
    signOut: async () => { await supabase.auth.signOut(); setSession(null); setUser(null); },
    refreshUser, isAuthenticated: Boolean(session), isPremium: user?.membership_status === 'premium', isAdmin: user?.is_admin === true,
  }), [loading, refreshUser, session, user]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() { const value = useContext(Context); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }

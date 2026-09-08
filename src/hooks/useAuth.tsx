import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, type User } from '@/lib/supabase';
import { getMe } from '@/lib/api';

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isPremium: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => ReturnType<typeof supabase.auth.signInWithPassword>;
  signUp: (email: string, password: string) => ReturnType<typeof supabase.auth.signUp>;
  signOut: () => Promise<void>;
  verifyEmailCode: (email: string, token: string) => ReturnType<typeof supabase.auth.verifyOtp>;
  resendVerificationCode: (email: string) => ReturnType<typeof supabase.auth.resend>;
  requestPasswordReset: (email: string) => ReturnType<typeof supabase.auth.resetPasswordForEmail>;
  updatePassword: (password: string) => ReturnType<typeof supabase.auth.updateUser>;
  resetPasswordWithCode: (email: string, token: string, password: string) => Promise<{ data: unknown; error: Error | null }>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (nextSession: Session | null) => {
    setSession(nextSession);
    if (!nextSession) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser((await getMe()).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => void loadProfile(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => void loadProfile(nextSession));
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user, session, loading, isAuthenticated: Boolean(session), isPremium: user?.membership_status === 'premium', isAdmin: user?.is_admin === true,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signUp: (email, password) => supabase.auth.signUp({ email, password }),
    signOut: async () => { await supabase.auth.signOut(); setUser(null); setSession(null); },
    verifyEmailCode: (email, token) => supabase.auth.verifyOtp({ email, token, type: 'signup' }),
    resendVerificationCode: (email) => supabase.auth.resend({ type: 'signup', email }),
    requestPasswordReset: (email) => supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' }),
    updatePassword: (password) => supabase.auth.updateUser({ password }),
    resetPasswordWithCode: async (email, token, password) => {
      const verification = await supabase.auth.verifyOtp({ email, token, type: 'recovery' });
      if (verification.error) return { data: null, error: verification.error };
      const result = await supabase.auth.updateUser({ password });
      return { data: result.data, error: result.error };
    },
    refreshUser: async () => { if (session) { try { setUser((await getMe()).user); } catch { setUser(null); } } },
  }), [user, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

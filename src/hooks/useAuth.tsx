/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getMe } from '@/lib/api';
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshUser = async () => { try { setUser((await getMe()).user); } catch { setUser(null); } };
  useEffect(() => {
    let mounted = true;
    const load = async (nextSession: Session | null) => { if (!mounted) return; setSession(nextSession); if (nextSession) await refreshUser(); else setUser(null); if (mounted) setLoading(false); };
    supabase.auth.getSession().then(({ data }) => void load(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => void load(nextSession));
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);
  const value = useMemo<AuthContext>(() => ({
    user, session, loading,
    signIn: async (email, password) => { const { error } = await supabase.auth.signInWithPassword({ email, password }); return { error }; },
    signUp: async (email, password) => { const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/verify-email` } }); return { error }; },
    verifyEmailCode: async (email, token) => { const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' }); return { error }; },
    resendVerificationCode: async (email) => { const { error } = await supabase.auth.resend({ type: 'signup', email }); return { error }; },
    requestPasswordReset: async (email) => { const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` }); return { error }; },
    resetPasswordWithCode: async (email, token, password) => { const verified = await supabase.auth.verifyOtp({ email, token, type: 'recovery' }); if (verified.error) return { error: verified.error }; const { error } = await supabase.auth.updateUser({ password }); return { error }; },
    signOut: async () => { await supabase.auth.signOut(); setSession(null); setUser(null); },
    refreshUser, isAuthenticated: Boolean(session), isPremium: user?.membership_status === 'premium', isAdmin: user?.is_admin === true,
  }), [loading, session, user]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAuth() { const value = useContext(Context); if (!value) throw new Error('useAuth must be used inside AuthProvider'); return value; }

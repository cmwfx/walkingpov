import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
if (!url || !publishableKey) throw new Error('CandidFan is missing its public Supabase configuration');

export const supabase = createClient(url, publishableKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});

export type MembershipStatus = 'free' | 'pending' | 'premium' | 'denied';
export type User = { id: string; email: string; membership_status: MembershipStatus; is_admin: boolean };
export type Video = { id: string; title: string; thumbnail_url: string; tags: string[]; is_featured: boolean; created_at: string; updated_at: string };
export type PaymentRequest = { id: string; user_id: string; email: string; proof: string; status: 'pending' | 'approved' | 'denied'; created_at: string; notes?: string | null };
export type SupportTicket = { id: string; user_id?: string; email?: string; subject: string; status: 'open' | 'closed'; unread?: boolean; created_at: string; updated_at: string };
export type SupportMessage = { id: string; ticket_id: string; author_id: string; body: string; created_at: string };
export type ImportJob = { id: string; source_kind: string; status: 'queued' | 'running' | 'completed' | 'failed'; total_items: number; processed_items: number; successful_items: number; failed_items: number; total_bytes: number; processed_bytes: number; started_at?: string | null; completed_at?: string | null; created_at: string };

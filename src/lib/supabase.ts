import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) throw new Error('Missing Supabase browser configuration');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});

export type User = {
  id: string;
  email: string;
  membership_status: 'free' | 'premium';
  is_admin: boolean;
};

export type Video = {
  id: string;
  title: string;
  tags: string[];
  duration_seconds: number;
  width: number | null;
  height: number | null;
  thumbnail_url: string;
  preview_url: string;
  created_at: string;
  published_at: string | null;
};

export type PaymentRequest = {
  id: string;
  amount_minor: number;
  currency: string;
  status: 'pending' | 'approved' | 'denied';
  notes: string | null;
  created_at: string;
  updated_at?: string;
};

export type SupportTicket = {
  id: string;
  owner_user_id: string;
  subject: string;
  status: 'open' | 'closed';
  last_activity_at: string;
  created_at: string;
  user_last_read_at?: string | null;
  admin_last_read_at?: string | null;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  author_user_id: string;
  body: string;
  created_at: string;
};

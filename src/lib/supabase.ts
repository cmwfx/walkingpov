import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export type User = {
  id: string;
  email: string;
  membership_status: 'free' | 'pending' | 'premium' | 'denied';
  payment_method?: 'crypto' | 'giftcard';
  payment_proof?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Video = {
  id: string;
  title: string;
  thumbnail_url: string;
  tags: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DownloadLink = {
  id: string;
  video_id: string;
  label: string;
  url: string;
  order: number;
  created_at: string;
};

export type PaymentRequest = {
  id: string;
  user_id: string;
  payment_type: 'crypto' | 'giftcard';
  proof: string;
  status: 'pending' | 'approved' | 'denied';
  reviewed_by?: string;
  reviewed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
};

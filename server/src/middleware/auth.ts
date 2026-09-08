import { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export type MembershipStatus = 'free' | 'pending' | 'premium' | 'denied';

export interface AuthUser {
  id: string;
  email: string;
  is_admin: boolean;
  membership_status: MembershipStatus;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export async function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const value = req.headers.authorization;
    if (!value?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });

    const token = value.slice('Bearer '.length).trim();
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Invalid or expired token' });

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, email, is_admin, membership_status')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) return res.status(401).json({ error: 'Account profile unavailable' });
    req.user = profile as AuthUser;
    return next();
  } catch {
    console.error('auth-middleware-failed');
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  return next();
}

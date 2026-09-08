import type { NextFunction, Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export interface AuthUser {
  id: string;
  email: string;
  membership_status: 'free' | 'premium';
  is_admin: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export async function verifyToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
    const token = header.slice(7);
    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !authData.user) return res.status(401).json({ error: 'Invalid or expired session' });
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id,email,membership_status,is_admin')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (error || !data) return res.status(401).json({ error: 'User profile not found' });
    req.user = data as AuthUser;
    next();
  } catch (error) {
    console.error('auth verification failed', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  if (!req.user.is_admin) return res.status(403).json({ error: 'Admin access required' });
  next();
}


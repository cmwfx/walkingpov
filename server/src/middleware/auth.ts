import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email?: string;
    is_admin?: boolean;
  };
}

export const verifyToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No auth header or invalid format');
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    console.log('🔑 Verifying token...');

    // Verify the JWT token
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      console.log('❌ Token verification failed:', error?.message || 'No user');
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    console.log('✅ Token verified for user:', user.id);

    // Get user details from our users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, email, is_admin')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.log('❌ User lookup failed:', userError?.message || 'No user data');
      console.log('User error details:', userError);
      return res.status(401).json({ error: 'User not found' });
    }

    console.log('✅ User found:', userData.email, 'Admin:', userData.is_admin);

    req.user = userData;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

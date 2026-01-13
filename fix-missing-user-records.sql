-- Fix: Create missing user records for authenticated users
-- This script syncs auth.users with public.users

-- First, let's see which users are missing
SELECT 
  au.id,
  au.email,
  au.created_at,
  CASE WHEN pu.id IS NULL THEN 'MISSING' ELSE 'EXISTS' END as status
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC;

-- Create missing user records
INSERT INTO public.users (id, email, is_admin, created_at)
SELECT 
  au.id,
  au.email,
  FALSE, -- Default to non-admin
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- If you want to set a specific user as admin, use this:
-- UPDATE public.users SET is_admin = TRUE WHERE email = 'your-admin-email@example.com';

-- Verify all users are now synced
SELECT 
  au.id,
  au.email,
  pu.is_admin,
  pu.membership_status
FROM auth.users au
INNER JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC;

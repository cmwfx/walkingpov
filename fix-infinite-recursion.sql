-- CRITICAL FIX: Infinite Recursion in RLS Policies
-- Run this immediately in Supabase SQL Editor

-- Drop ALL existing policies (including good ones to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;
DROP POLICY IF EXISTS "Anyone can view videos" ON public.videos;
DROP POLICY IF EXISTS "Admins can insert videos" ON public.videos;
DROP POLICY IF EXISTS "Admins can update videos" ON public.videos;
DROP POLICY IF EXISTS "Admins can delete videos" ON public.videos;
DROP POLICY IF EXISTS "Premium users can view download links" ON public.download_links;
DROP POLICY IF EXISTS "Admins can insert download links" ON public.download_links;
DROP POLICY IF EXISTS "Admins can update download links" ON public.download_links;
DROP POLICY IF EXISTS "Admins can delete download links" ON public.download_links;
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admins can view all payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can insert own payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admins can update payment requests" ON public.payment_requests;

-- ============================================================================
-- USERS TABLE POLICIES (Fixed - no recursion)
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ============================================================================
-- VIDEOS TABLE POLICIES
-- ============================================================================

-- Anyone can view videos (no auth required)
CREATE POLICY "Anyone can view videos"
  ON public.videos FOR SELECT
  USING (TRUE);

-- ============================================================================
-- DOWNLOAD LINKS POLICIES
-- ============================================================================

-- No SELECT policy - users cannot directly query download_links
-- They must go through the backend API which uses service role

-- ============================================================================
-- PAYMENT REQUESTS POLICIES
-- ============================================================================

-- Users can view their own payment requests
CREATE POLICY "Users can view own payment requests"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own payment requests
CREATE POLICY "Users can insert own payment requests"
  ON public.payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Verify RLS is still enabled
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Show current policies
-- ============================================================================

SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

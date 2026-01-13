-- CRITICAL FIX: Admin access without infinite recursion
-- This uses a security definer function to check admin status without triggering RLS

-- Step 1: Drop any existing problematic policies
DROP POLICY IF EXISTS "Admins can view all payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admins can update all payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admins can update payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Admins can update all users" ON public.users;

-- Step 2: Create a security definer function to check if current user is admin
-- SECURITY DEFINER means it runs with the privileges of the owner (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create admin policies using the function

-- Allow admins to view all payment requests
CREATE POLICY "Admins can view all payment requests"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Allow admins to update all payment requests
CREATE POLICY "Admins can update all payment requests"
  ON public.payment_requests FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Allow admins to view all users
CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Allow admins to update all users
CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Step 4: Verify the setup
SELECT 
  tablename,
  policyname,
  cmd
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('users', 'payment_requests')
ORDER BY tablename, cmd;

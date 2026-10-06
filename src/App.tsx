import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { VideoDetail } from './pages/VideoDetail';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
import { PaymentSubmit } from './pages/PaymentSubmit';
import { Dashboard } from './pages/Dashboard';
import { Support } from './pages/Support';
import { SupportTicket } from './pages/SupportTicket';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ReviewPayments } from './pages/admin/ReviewPayments';
import { AdminSupport } from './pages/admin/AdminSupport';
import { ImportJobs } from './pages/admin/ImportJobs';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { InstantVidGrabAuthorize } from './pages/InstantVidGrabAuthorize';
import { trackPageView } from './lib/analytics';

function AnalyticsRouteTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!pathname.startsWith('/admin')) trackPageView(pathname);
  }, [pathname]);

  return null;
}

export default function App() {
  return <AuthProvider><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><AnalyticsRouteTracker /><Routes><Route element={<Layout />}>
    <Route path="/" element={<Home />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/video/:id" element={<VideoDetail />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/verify-email" element={<VerifyEmail />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/payment" element={<ProtectedRoute><PaymentSubmit /></ProtectedRoute>} />
    <Route path="/instantvidgrab/authorize" element={<InstantVidGrabAuthorize />} />
    <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
    <Route path="/support/:id" element={<ProtectedRoute><SupportTicket /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
    <Route path="/admin/payments" element={<ProtectedRoute adminOnly><ReviewPayments /></ProtectedRoute>} />
    <Route path="/admin/support" element={<ProtectedRoute adminOnly><AdminSupport /></ProtectedRoute>} />
    <Route path="/admin/import" element={<ProtectedRoute adminOnly><ImportJobs /></ProtectedRoute>} />
  </Route></Routes></BrowserRouter></AuthProvider>;
}

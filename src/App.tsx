import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
import { SupportThread } from './pages/SupportThread';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { ReviewPayments } from './pages/admin/ReviewPayments';
import { BulkUpload } from './pages/admin/BulkUpload';
import { AdminSupport } from './pages/admin/AdminSupport';

export default function App() {
  return <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute requireAuth><Dashboard /></ProtectedRoute>} />
          <Route path="/payment" element={<ProtectedRoute requireAuth><PaymentSubmit /></ProtectedRoute>} />
          <Route path="/support" element={<ProtectedRoute requireAuth><Support /></ProtectedRoute>} />
          <Route path="/support/:id" element={<ProtectedRoute requireAuth><SupportThread /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAuth requireAdmin><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/review-payments" element={<ProtectedRoute requireAuth requireAdmin><ReviewPayments /></ProtectedRoute>} />
          <Route path="/admin/imports" element={<ProtectedRoute requireAuth requireAdmin><BulkUpload /></ProtectedRoute>} />
          <Route path="/admin/support" element={<ProtectedRoute requireAuth requireAdmin><AdminSupport /></ProtectedRoute>} />
          <Route path="/admin/support/:id" element={<ProtectedRoute requireAuth requireAdmin><SupportThread admin /></ProtectedRoute>} />
        </Route>
      </Routes>
    </AuthProvider>
  </BrowserRouter>;
}

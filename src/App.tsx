import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Pages - will be created next
import { Home } from './pages/Home';
import { VideoDetail } from './pages/VideoDetail';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { VerifyEmail } from './pages/VerifyEmail';
import { PaymentSubmit } from './pages/PaymentSubmit';
import { Dashboard } from './pages/Dashboard';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { CreateVideo } from './pages/admin/CreateVideo';
import { ReviewPayments } from './pages/admin/ReviewPayments';
import { BulkUpload } from './pages/admin/BulkUpload';

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        <Route element={<Layout />}>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/video/:id" element={<VideoDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* Protected routes - require auth */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requireAuth>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment"
            element={
              <ProtectedRoute requireAuth>
                <PaymentSubmit />
              </ProtectedRoute>
            }
          />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute requireAuth requireAdmin>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/create-video"
            element={
              <ProtectedRoute requireAuth requireAdmin>
                <CreateVideo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review-payments"
            element={
              <ProtectedRoute requireAuth requireAdmin>
                <ReviewPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/bulk-upload"
            element={
              <ProtectedRoute requireAuth requireAdmin>
                <BulkUpload />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

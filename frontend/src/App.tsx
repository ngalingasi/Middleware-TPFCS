import { BrowserRouter as Router, Routes, Route } from 'react-router';
import { ScrollToTop } from './components/common/ScrollToTop';
import { GepgAuthProvider } from './context/GepgAuthContext';
import GepgProtectedRoute from './components/tpfcs/GepgProtectedRoute';
import GepgAppLayout from './layout/GepgAppLayout';
import { ToastContainer } from './components/tpfcs/Toast';

// ── Auth ────────────────────────────────────────────────────────────────────
import GepgSignIn from './pages/Gepg/SignIn';
import ChangePasswordPage from './pages/Gepg/ChangePasswordPage';

// ── Dashboard ───────────────────────────────────────────────────────────────
import GepgDashboard from './pages/Gepg/Dashboard';

// ── Bills ───────────────────────────────────────────────────────────────────
import BillsListPage from './pages/Gepg/BillsListPage';
import BillDetailPage from './pages/Gepg/BillDetailPage';
import BillCreatePage from './pages/Gepg/BillCreatePage';

// ── Payments ────────────────────────────────────────────────────────────────
import PaymentsListPage from './pages/Gepg/PaymentsListPage';
import PaymentDetailPage from './pages/Gepg/PaymentDetailPage';

// ── Reconciliation ──────────────────────────────────────────────────────────
import ReconciliationListPage from './pages/Gepg/ReconciliationListPage';
import ReconciliationDetailPage from './pages/Gepg/ReconciliationDetailPage';

// ── Admin ───────────────────────────────────────────────────────────────────
import GepgUsersPage from './pages/Gepg/UsersPage';
import ApiKeysPage from './pages/Gepg/ApiKeysPage';
import ProfilePage from './pages/Gepg/ProfilePage';

// ── Fallback ────────────────────────────────────────────────────────────────
import NotFound from './pages/OtherPage/NotFound';

export default function App() {
  return (
    <GepgAuthProvider>
      <ToastContainer />
      <Router>
        <ScrollToTop />
        <Routes>
          {/* ── Public ──────────────────────────────────────────────────── */}
          <Route path="/signin" element={<GepgSignIn />} />

          {/* ── All authenticated users ────────────────────────────────── */}
          <Route element={<GepgProtectedRoute />}>
            <Route path="/change-password" element={<ChangePasswordPage />} />

            <Route element={<GepgAppLayout />}>
              <Route index path="/" element={<GepgDashboard />} />

              <Route path="/bills" element={<BillsListPage />} />
              <Route path="/bills/new" element={<BillCreatePage />} />
              <Route path="/bills/:billId" element={<BillDetailPage />} />

              <Route path="/payments" element={<PaymentsListPage />} />
              <Route path="/payments/:paymentId" element={<PaymentDetailPage />} />

              <Route path="/reconciliation" element={<ReconciliationListPage />} />
              <Route path="/reconciliation/:requestId" element={<ReconciliationDetailPage />} />

              <Route path="/profile" element={<ProfilePage />} />
            </Route>
          </Route>

          {/* ── Admin only ──────────────────────────────────────────────── */}
          <Route element={<GepgProtectedRoute adminOnly />}>
            <Route element={<GepgAppLayout />}>
              <Route path="/users" element={<GepgUsersPage />} />
              <Route path="/api-keys" element={<ApiKeysPage />} />
            </Route>
          </Route>

          {/* ── Fallback ────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </GepgAuthProvider>
  );
}

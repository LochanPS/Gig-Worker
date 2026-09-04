// Router + role-based routing. Redirects to the right dashboard per role.
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.js';
import Login from './pages/Login.js';
import Layout from './components/Layout.js';
import CompanyOverview from './pages/company/Overview.js';
import NewPayout from './pages/company/NewPayout.js';
import PayRunPage from './pages/company/PayRun.js';
import Schedules from './pages/company/Schedules.js';
import CompanyInvoices from './pages/company/Invoices.js';
import FreelancerHome from './pages/freelancer/Home.js';
import FreelancerInvoices from './pages/freelancer/Invoices.js';
import PayoutAccounts from './pages/freelancer/PayoutAccounts.js';
import Identity from './pages/freelancer/Identity.js';
import History from './pages/freelancer/History.js';
import AdminMonitor from './pages/admin/Monitor.js';
import AdminRules from './pages/admin/Rules.js';
import AdminTreasury from './pages/admin/Treasury.js';
import PaymentDetail from './pages/PaymentDetail.js';
import Verify from './pages/Verify.js';
import Customers from './pages/Customers.js';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="login"><span className="muted">Loading…</span></div>;
  if (!user) return <Login />;

  const home = user.role === 'COMPANY' ? '/company' : user.role === 'FREELANCER' ? '/me' : '/admin';
  return (
    <Layout>
      <Routes>
        {user.role === 'COMPANY' && <>
          <Route path="/company" element={<CompanyOverview />} />
          <Route path="/company/pay" element={<NewPayout />} />
          <Route path="/company/batch" element={<PayRunPage />} />
          <Route path="/company/schedules" element={<Schedules />} />
          <Route path="/company/invoices" element={<CompanyInvoices />} />
          <Route path="/company/payments/:id" element={<PaymentDetail backTo="/company" />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/verify" element={<Verify />} />
        </>}
        {user.role === 'FREELANCER' && <>
          <Route path="/me" element={<FreelancerHome />} />
          <Route path="/me/invoices" element={<FreelancerInvoices />} />
          <Route path="/me/payout-accounts" element={<PayoutAccounts />} />
          <Route path="/me/identity" element={<Identity />} />
          <Route path="/me/history" element={<History />} />
          <Route path="/me/payments/:id" element={<PaymentDetail backTo="/me" />} />
          <Route path="/verify" element={<Verify />} />
        </>}
        {user.role === 'ADMIN' && <>
          <Route path="/admin" element={<AdminMonitor />} />
          <Route path="/admin/rules" element={<AdminRules />} />
          <Route path="/admin/treasury" element={<AdminTreasury />} />
          <Route path="/admin/payments/:id" element={<PaymentDetail backTo="/admin" />} />
          <Route path="/customers" element={<Customers />} />
        </>}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  );
}

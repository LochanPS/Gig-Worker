// Router + role-based routing. Redirects to the right dashboard per role.
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.js';
import Login from './pages/Login.js';
import Layout from './components/Layout.js';
import CompanyOverview from './pages/company/Overview.js';
import NewPayout from './pages/company/NewPayout.js';
import CompanyInvoices from './pages/company/Invoices.js';
import FreelancerHome from './pages/freelancer/Home.js';
import FreelancerInvoices from './pages/freelancer/Invoices.js';
import AdminMonitor from './pages/admin/Monitor.js';
import PaymentDetail from './pages/PaymentDetail.js';

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
          <Route path="/company/invoices" element={<CompanyInvoices />} />
          <Route path="/company/payments/:id" element={<PaymentDetail backTo="/company" />} />
        </>}
        {user.role === 'FREELANCER' && <>
          <Route path="/me" element={<FreelancerHome />} />
          <Route path="/me/invoices" element={<FreelancerInvoices />} />
          <Route path="/me/payments/:id" element={<PaymentDetail backTo="/me" />} />
        </>}
        {user.role === 'ADMIN' && <Route path="/admin" element={<AdminMonitor />} />}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Layout>
  );
}

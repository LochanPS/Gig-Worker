import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, homeFor, RequireRole } from '@/lib/auth';
import { ConsoleLayout } from '@/layouts/ConsoleLayout';
import { Login } from '@/routes/auth/Login';
import { Register } from '@/routes/auth/Register';
import { OnboardFreelancer } from '@/routes/auth/OnboardFreelancer';
import { OnboardCompany } from '@/routes/auth/OnboardCompany';
import { CompanyOverview } from '@/routes/company/Overview';
import { PayWizard } from '@/routes/company/PayWizard';
import { PaymentDetail } from '@/routes/company/PaymentDetail';
import { CompanyFreelancers } from '@/routes/company/Freelancers';
import { CompanyInvoices } from '@/routes/company/Invoices';
import { FreelancerHome } from '@/routes/freelancer/Home';
import { FreelancerHistory } from '@/routes/freelancer/History';
import { FreelancerInvoices } from '@/routes/freelancer/Invoices';
import { FreelancerIdentity } from '@/routes/freelancer/Identity';
import { AdminMonitor } from '@/routes/admin/Monitor';
import { AdminQueue } from '@/routes/admin/Queue';
import { AdminAlerts } from '@/routes/admin/Alerts';
import { AdminRules } from '@/routes/admin/Rules';
import { AdminTreasury } from '@/routes/admin/Treasury';

function RootRedirect() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return <Navigate to={user ? homeFor(user.role) : '/login'} replace />;
}

function ConsoleGuard() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <ConsoleLayout />;
}

const ANY = ['COMPANY', 'FREELANCER', 'ADMIN'] as const;

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/onboarding/freelancer" element={<RequireRole roles={['FREELANCER']}><OnboardFreelancer /></RequireRole>} />
      <Route path="/onboarding/company" element={<RequireRole roles={['COMPANY']}><OnboardCompany /></RequireRole>} />

      <Route element={<ConsoleGuard />}>
        {/* Company */}
        <Route path="/company" element={<RequireRole roles={['COMPANY']}><CompanyOverview /></RequireRole>} />
        <Route path="/company/pay" element={<RequireRole roles={['COMPANY']}><PayWizard /></RequireRole>} />
        <Route path="/company/payments/:id" element={<RequireRole roles={[...ANY]}><PaymentDetail /></RequireRole>} />
        <Route path="/company/freelancers" element={<RequireRole roles={['COMPANY']}><CompanyFreelancers /></RequireRole>} />
        <Route path="/company/invoices" element={<RequireRole roles={['COMPANY']}><CompanyInvoices /></RequireRole>} />

        {/* Freelancer */}
        <Route path="/me" element={<RequireRole roles={['FREELANCER']}><FreelancerHome /></RequireRole>} />
        <Route path="/me/history" element={<RequireRole roles={['FREELANCER']}><FreelancerHistory /></RequireRole>} />
        <Route path="/me/invoices" element={<RequireRole roles={['FREELANCER']}><FreelancerInvoices /></RequireRole>} />
        <Route path="/me/identity" element={<RequireRole roles={['FREELANCER']}><FreelancerIdentity /></RequireRole>} />

        {/* Admin */}
        <Route path="/admin" element={<RequireRole roles={['ADMIN']}><AdminMonitor /></RequireRole>} />
        <Route path="/admin/queue" element={<RequireRole roles={['ADMIN']}><AdminQueue /></RequireRole>} />
        <Route path="/admin/alerts" element={<RequireRole roles={['ADMIN']}><AdminAlerts /></RequireRole>} />
        <Route path="/admin/rules" element={<RequireRole roles={['ADMIN']}><AdminRules /></RequireRole>} />
        <Route path="/admin/treasury" element={<RequireRole roles={['ADMIN']}><AdminTreasury /></RequireRole>} />
      </Route>

      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}

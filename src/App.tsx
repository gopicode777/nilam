import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from './store';
import Shell from './components/Shell';
import { Login, Otp, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NewCase from './pages/NewCase';
import CaseWorkspace from './pages/Case';
import Plans from './pages/Plans';
import PublicLayout from './components/PublicLayout';
import Landing from './pages/Landing';
import { Legal, Pricing, Sample, Shared } from './pages/Public';
import { Compare, Professionals, Settings } from './pages/Tools';
import { AdminAnalytics, AdminRules, AdminCases, AdminLogs, AdminOverview, AdminReviews, AdminSources, AdminUser, AdminUsers } from './pages/Admin';

export default function App() {
  const s = useStore(), u = s.users.find(x => x.id === s.session);
  const admin = u?.role === 'admin';
  return (
    <HashRouter>
      <Routes>
        <Route element={<PublicLayout />}><Route path="/pricing" element={<Pricing />} /><Route path="/sample" element={<Sample />} /><Route path="/share/:token" element={<Shared />} /><Route path="/legal/:doc" element={<Legal />} />{!u && <Route path="/" element={<Landing />} />}</Route>
        {!u ? <>
          <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/otp" element={<Otp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </> : <Route element={<Shell />}>
          <Route path="/" element={admin ? <Navigate to="/admin" replace /> : <Dashboard />} /><Route path="/compare" element={<Compare />} /><Route path="/professionals" element={<Professionals />} /><Route path="/settings" element={<Settings />} />
          <Route path="/new" element={<NewCase />} /><Route path="/cases/:id/*" element={<CaseWorkspace />} /><Route path="/plans" element={<Plans />} />
          {admin && <><Route path="/admin" element={<AdminOverview />} /><Route path="/admin/users" element={<AdminUsers />} /><Route path="/admin/users/:id" element={<AdminUser />} />
            <Route path="/admin/cases" element={<AdminCases />} /><Route path="/admin/reviews" element={<AdminReviews />} /><Route path="/admin/analytics" element={<AdminAnalytics />} /><Route path="/admin/rules" element={<AdminRules />} /><Route path="/admin/sources" element={<AdminSources />} /><Route path="/admin/logs" element={<AdminLogs />} /></>}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>}
      </Routes>
    </HashRouter>
  );
}

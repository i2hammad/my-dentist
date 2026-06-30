import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Admins from './pages/Admins.jsx';
import Dentists from './pages/Dentists.jsx';
import DentistDetail from './pages/DentistDetail.jsx';
import Verification from './pages/Verification.jsx';
import Patients from './pages/Patients.jsx';
import PatientDetail from './pages/PatientDetail.jsx';
import Treatments from './pages/Treatments.jsx';
import Gallery from './pages/Gallery.jsx';
import Reviews from './pages/Reviews.jsx';
import Appointments from './pages/Appointments.jsx';
import Bills from './pages/Bills.jsx';
import Rewards from './pages/Rewards.jsx';
import Settings from './pages/Settings.jsx';
import Campaigns from './pages/Campaigns.jsx';
import PatientCampaigns from './pages/PatientCampaigns.jsx';
import Analytics from './pages/Analytics.jsx';
import Broadcast from './pages/Broadcast.jsx';
import AuditLog from './pages/AuditLog.jsx';
import Commission from './pages/Commission.jsx';

function Protected({ children }) {
  const { admin, loading } = useAuth();
  if (loading) return <div className="loading">Loading…</div>;
  if (!admin) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={<Protected><Layout /></Protected>}
      >
        <Route index element={<Dashboard />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="admins" element={<Admins />} />
        <Route path="dentists" element={<Dentists />} />
        <Route path="dentists/:id" element={<DentistDetail />} />
        <Route path="verification" element={<Verification />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="treatments" element={<Treatments />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="bills" element={<Bills />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="commission" element={<Commission />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="patient-campaigns" element={<PatientCampaigns />} />
        <Route path="broadcast" element={<Broadcast />} />
        <Route path="audit-logs" element={<AuditLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

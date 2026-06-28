import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login    from './pages/Login';
import Profile  from './pages/Profile';
import Dashboard from './pages/Dashboard';
import Calendar  from './pages/Calendar';
import Reports   from './pages/Reports';
import Equipment from './pages/Equipment';
import UnitMembers from './pages/UnitMembers';
import OrgAdmin    from './pages/OrgAdmin';
import LossReport  from './pages/LossReport';
import Arenden     from './pages/Arenden';
import Documents   from './pages/Documents';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Laddar…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.profile_complete) return <Navigate to="/profil" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/profil" element={<Profile />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/kalender" element={<Protected><Calendar /></Protected>} />
      <Route path="/rapporter" element={<Protected><Reports /></Protected>} />
      <Route path="/utrustning" element={<Protected><Equipment /></Protected>} />
      <Route path="/arenden" element={<Protected><Arenden /></Protected>} />
      <Route path="/enhet" element={<Protected><UnitMembers /></Protected>} />
      <Route path="/org" element={<Protected><OrgAdmin /></Protected>} />
      <Route path="/dokument" element={<Protected><Documents /></Protected>} />
      <Route path="/blankett/:id" element={<LossReport />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

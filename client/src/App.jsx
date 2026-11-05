import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui.jsx';
import { useAuth } from './auth.jsx';
import { getToken } from './authStore.js';
import Layout from './components/Layout.jsx';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ChangeLogs from './pages/ChangeLogs.jsx';
import StaffChat from './pages/StaffChat.jsx';
import UsersPage from './pages/Users.jsx';
import LicenseKey from './pages/LicenseKey.jsx';
import ScreenShots from './pages/ScreenShots.jsx';
import Security from './pages/Security.jsx';
import WebsiteUsers from './pages/WebsiteUsers.jsx';
import NotFound from './pages/NotFound.jsx';

function Protected({ children }) {
  const { user } = useAuth();
  const token = getToken();
  const location = useLocation();
  if (!user || !token) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Layout>{children}</Layout>;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  const token = getToken();
  if (user && token) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/changelogs" element={<Protected><ChangeLogs /></Protected>} />
        <Route path="/chat" element={<Protected><StaffChat /></Protected>} />
        <Route path="/users" element={<Protected><UsersPage /></Protected>} />
        <Route path="/license-key" element={<Protected><LicenseKey /></Protected>} />
        <Route path="/screenshots" element={<Protected><ScreenShots /></Protected>} />
        <Route path="/security" element={<Protected><Security /></Protected>} />
        <Route path="/website-users" element={<Protected><WebsiteUsers /></Protected>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </ToastProvider>
  );
}

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ParticleCanvas from './components/ui/ParticleCanvas';
import OnboardingPage from './app/page.jsx';
import PatientDashboard from './app/dashboard/page.jsx';
import AdminConsoleDashboard from './app/admin/console/page.jsx';
import DoctorWorkspaceDashboard from './app/doctor/workspace/page.jsx';
import './index.css';

// Guard wrapper logic execution structure
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex flex-col items-center justify-center space-y-2">
        <div className="text-emerald-400 font-black text-xs uppercase tracking-widest animate-pulse">Initializing System Framework...</div>
        <div className="h-0.5 w-32 bg-slate-900 overflow-hidden relative"><div className="h-full bg-emerald-500 w-1/2 absolute animate-infinite-loading"></div></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ParticleCanvas />
        <div className="relative z-10 min-h-screen w-full flex flex-col items-center justify-center">
          <Routes>
            {/* Onboarding Gate Route */}
            <Route path="/" element={<OnboardingPage />} />
            
            {/* Role Dedicated Spaces */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['patient', 'admin']}>
                <PatientDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/admin/console" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminConsoleDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/doctor/workspace" element={
              <ProtectedRoute allowedRoles={['dermat', 'admin']}>
                <DoctorWorkspaceDashboard />
              </ProtectedRoute>
            } />
            
            {/* Fallback Catch-All Safety Override Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}
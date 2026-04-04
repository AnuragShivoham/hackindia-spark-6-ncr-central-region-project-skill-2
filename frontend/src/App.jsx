import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LogOut, User } from 'lucide-react';
import { useStore } from './store';
import { api } from './api/client';
import { StatusBadge, ProgressBar, Spinner } from './components/UI';
import GoalPage from './pages/GoalPage';
import ClarifyPage from './pages/ClarifyPage';
import DashboardPage from './pages/DashboardPage';
import CompletePage from './pages/CompletePage';
import IdePage from './pages/IdePage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import PlanConfirmationPage from './pages/PlanConfirmationPage';

import ProjectsPage from './pages/ProjectsPage';

import MentorPage from './pages/MentorPage';
import MarketplacePage from './pages/MarketplacePage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import CourseBuilderPage from './pages/CourseBuilderPage';

function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const { project, projectId, userName, token, avatar, logout, role } = useStore();
  const onDash = location.pathname === '/dashboard';
  const onLogin = location.pathname === '/login';

  if (onLogin || location.pathname === '/ide') return null;

  const navBtn = (label, path) => ({
    background: location.pathname === path ? 'rgba(88,166,255,0.15)' : 'none',
    border: location.pathname === path ? '1px solid rgba(88,166,255,0.3)' : '1px solid transparent',
    color: location.pathname === path ? '#58a6ff' : 'var(--tx-m)',
    cursor: 'pointer', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, fontFamily: 'var(--sans)'
  });

  return (
    <header className="hdr">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate(role === 'mentor' ? '/mentor' : '/projects')}>
        <div className="logo">AMIT-BODHIT</div>
        <div className="logo-sub">AI Development Hub</div>
      </div>
      
      {token && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16 }}>
          <button onClick={() => navigate('/projects')} style={navBtn('Projects', '/projects')}>Projects</button>
          {projectId && (
            <button onClick={() => navigate('/dashboard')} style={navBtn('Dashboard', '/dashboard')}>Dashboard</button>
          )}
          {role === 'student' && (
            <button onClick={() => navigate('/marketplace')} style={navBtn('Marketplace', '/marketplace')}>Marketplace</button>
          )}
          {role === 'mentor' && (
            <>
              <button onClick={() => navigate('/mentor')} style={navBtn('Intervention', '/mentor')}>Intervention</button>
              <button onClick={() => navigate('/builder')} style={navBtn('Builder', '/builder')}>Course Builder</button>
            </>
          )}
        </div>
      )}

      {project && onDash && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
          <span className="hdr-sep">›</span>
          <span className="hdr-crumb">{project.title}</span>
          <StatusBadge status={project.status} />
          <div style={{ flex: 1, minWidth: 100, marginLeft: 10 }}>
            <ProgressBar pct={project.progress_pct || 0} />
          </div>
        </div>
      )}

      {token && (
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {avatar ? (
              <img src={avatar} alt={userName} style={{ width: 24, height: 24, borderRadius: '50%', border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--bg-o)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={14} color="var(--tx-2)" />
              </div>
            )}
            <span style={{ fontSize: 10, color: 'var(--tx-2)', fontFamily: 'var(--mono)' }}>{userName}</span>
          </div>
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            style={{ background: 'none', border: 'none', color: 'var(--tx-m)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4 }}
            title="Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </header>
  );
}

function ProtectedRoute({ children }) {
  const { token } = useStore();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

function MentorRoute({ children }) {
  const { token, role } = useStore();
  const navigate = useNavigate();
  if (!token) return <Navigate to="/login" replace />;
  if (role !== 'mentor') return <Navigate to="/projects" replace />;
  return children;
}

function HomeRedirect() {
  const { token, role } = useStore();
  if (!token) return <Navigate to="/login" replace />;
  if (role === 'mentor') return <Navigate to="/mentor" replace />;
  return <Navigate to="/projects" replace />;
}

function AppInner() {
  const { token, projectId, applyResponse, isRehydrating, setRehydrating } = useStore();
  
  useEffect(() => {
    console.log('[APP] Rehydration Effect - Token:', !!token, 'PID:', projectId);
    if (!token) {
      console.log('[APP] No token, stopping rehydration');
      setRehydrating(false);
      return;
    }

    const resume = async () => {
      const pid = useStore.getState().projectId;
      const diag = { step: 'start', token: !!token, projectId: pid };
      try {
        if (pid) {
          diag.step = 'resume_pid';
          try {
            const res = await api.resumeProject(pid);
            diag.resId = res.project?.id;
            api.debugLog({ type: 'rehydrate_success_pid', ...diag });
            applyResponse(res);
            return;
          } catch (e) {
            diag.error = e.message;
            api.debugLog({ type: 'rehydrate_fail_pid', ...diag });
            if (e.message.includes('404') || e.message.includes('403')) {
               localStorage.removeItem('ab_pid');
            }
          }
        }
        
        diag.step = 'fetch_latest';
        const res = await api.getLatestProject();
        diag.resId = res.project?.id;
        api.debugLog({ type: 'rehydrate_latest_res', ...diag });
        if (res.project) {
          applyResponse(res);
        } else {
          setRehydrating(false);
        }
      } catch (err) {
        api.debugLog({ type: 'rehydrate_critical', error: err.message, ...diag });
        setRehydrating(false);
      }
    };

    setRehydrating(true);
    resume();
  }, [token, applyResponse, setRehydrating]);

  if (isRehydrating) {
    return (
      <div className="goal-pg" style={{ flexDirection: 'column', gap: 20 }}>
        <Spinner />
        <div style={{ color: 'var(--tx-2)', fontSize: 13, letterSpacing: '0.05em' }}>Resuming your session...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="scan" />
      <Header />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
        <Route path="/goal" element={<ProtectedRoute><GoalPage /></ProtectedRoute>} />
        <Route path="/setup" element={<ProtectedRoute><SetupPage /></ProtectedRoute>} />
        <Route path="/confirm-plan" element={<ProtectedRoute><PlanConfirmationPage /></ProtectedRoute>} />

        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />

        <Route path="/ide" element={<ProtectedRoute><IdePage /></ProtectedRoute>} />
        <Route path="/mentor" element={<MentorRoute><MentorPage /></MentorRoute>} />
        <Route path="/builder" element={<MentorRoute><CourseBuilderPage /></MentorRoute>} />
        <Route path="/builder/:id" element={<MentorRoute><CourseBuilderPage /></MentorRoute>} />
        <Route path="/marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
        <Route path="/marketplace/:id" element={<ProtectedRoute><ProjectDetailPage /></ProtectedRoute>} />
        <Route path="/complete" element={<ProtectedRoute><CompletePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/projects" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  // Replace with your real value from .env if available
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
  
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

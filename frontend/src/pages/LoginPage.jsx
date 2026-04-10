import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { Mail, Shield, ShieldAlert, User, GraduationCap, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../api/client';
import { useStore } from '../store';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, token } = useStore();
  
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('student');
  const [step, setStep] = useState('login'); // login, otp, role
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  // If already logged in, redirect to dashboard or goal
  useEffect(() => {
    if (token) navigate('/');
  }, [token, navigate]);

  const handleSendOtp = async () => {
    if (!email) return setError('Email is required');
    setLoading(true);
    setError('');
    try {
      const res = await api.sendOtp(email);
      setMsg(res.message);
      setStep('otp');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp) return setError('OTP is required');
    setLoading(true);
    setError('');
    try {
      const res = await api.verifyOtp(email, otp, name, role);
      setAuth(res.user, res.token);
      if (res.user.role === 'mentor') {
        navigate('/mentor');
      } else if (res.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/projects');
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleGoogleSuccess = async (response) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.loginGoogle(response.credential, role);
      setAuth(res.user, res.token);
      if (res.user.role === 'mentor') {
        navigate('/mentor');
      } else if (res.user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/projects');
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div className="goal-pg fade-in">
      <div className="goal-box" style={{ maxWidth: 420 }}>
        <div className="g-eye">{step === 'role' ? 'CHOOSE YOUR PATH' : 'SECURE ACCESS'}</div>
        <h1 className="g-h1">
          {step === 'login' && 'Welcome Back'}
          {step === 'otp' && 'Verify Identity'}
          {step === 'role' && 'Select Role'}
        </h1>
        <p className="g-sub">
          {step === 'login' && 'Sign in to access your AI mentor and project dashboard.'}
          {step === 'otp' && `We've sent a 6-digit code to ${email}.`}
          {step === 'role' && 'Are you here to learn or to guide others?'}
        </p>

        {error && (
          <div className="err" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {msg && !error && (
          <div className="succ" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8 }}>
            <CheckCircle2 size={16} /> {msg}
          </div>
        )}

        {step === 'login' && (
          <div className="slide-down">
            <div style={{ marginBottom: 16 }}>
              <label className="lbl">Role Selection</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <button 
                  onClick={() => setRole('student')}
                  className={`btn ${role === 'student' ? 'btn-p' : 'btn-g'}`}
                  style={{ justifyContent: 'center', fontSize: 11 }}
                >
                  <User size={14} /> Student
                </button>
                <button 
                  onClick={() => setRole('mentor')}
                  className={`btn ${role === 'mentor' ? 'btn-p' : 'btn-g'}`}
                  style={{ justifyContent: 'center', fontSize: 11 }}
                >
                  <Shield size={14} /> Mentor
                </button>
                <button 
                  onClick={() => setRole('admin')}
                  className={`btn ${role === 'admin' ? 'btn-p' : 'btn-g'}`}
                  style={{ justifyContent: 'center', fontSize: 11 }}
                >
                  <ShieldAlert size={14} /> Admin
                </button>
              </div>
            </div>

            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('Google Login Failed')}
                theme="filled_black"
                shape="pill"
                width="320"
                text="signin_with"
              />
            </div>

            <div style={{ position: 'relative', textAlign: 'center', marginBottom: 24 }}>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />
              <span style={{ 
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: 'var(--bg)', padding: '0 12px', color: 'var(--tx-m)', fontSize: 10, letterSpacing: '.1em'
              }}>OR EMAIL</span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label className="lbl">Email Address</label>
              <input 
                type="email" 
                className="input" 
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <button 
              className="btn btn-p" 
              style={{ width: '100%', justifyContent: 'center', height: 44 }}
              onClick={handleSendOtp}
              disabled={loading}
            >
              {loading ? <Loader2 className="spin" /> : <>Continue with Email <ArrowRight size={16} /></>}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div className="slide-down">
            <div style={{ marginBottom: 20 }}>
              <label className="lbl">Verification Code</label>
              <input 
                type="text" 
                className="input" 
                placeholder="6-digit code"
                style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 800 }}
                value={otp}
                onChange={e => setOtp(e.target.value)}
                maxLength={6}
              />
            </div>

            <button 
              className="btn btn-p" 
              style={{ width: '100%', justifyContent: 'center', height: 44 }}
              onClick={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? <Loader2 className="spin" /> : <>Verify & Access <ArrowRight size={16} /></>}
            </button>
            <button 
              className="btn" 
              style={{ width: '100%', marginTop: 12, background: 'transparent', color: 'var(--tx-2)' }}
              onClick={() => setStep('login')}
            >
              Back to Sign In
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

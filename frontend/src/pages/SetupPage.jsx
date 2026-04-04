import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store';
import { 
  Check, 
  ArrowRight, 
  Zap, 
  Rocket, 
  Brain, 
  ChevronRight, 
  Plus, 
  X,
  Code,
  Globe,
  Cpu,
  Terminal,
  Info
} from 'lucide-react';

export default function SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applyResponse, setSuccessMsg, project } = useStore();
  
  // Data from previous step (GoalPage)
  const { missing = {}, extracted = {}, message = "" } = location.state || {};
  const pid = project?.id || extracted?.id;

  const [skill, setSkill] = useState('beginner');
  const [time, setTime] = useState(7);
  const [type, setType] = useState('fullstack');
  const [stack, setStack] = useState('');
  const [isStackAuto, setIsStackAuto] = useState(true);
  const [features, setFeatures] = useState([]);
  const [newFeature, setNewFeature] = useState('');
  
  const [loading, setLoad] = useState(false);
  const [error, setError] = useState('');

  // HACKATHON MODE: Smart Stack Mapping
  useEffect(() => {
    if (isStackAuto) {
      if (type === 'ai') setStack('Python + FastAPI + OpenAI');
      else if (type === 'api' && skill === 'beginner') setStack('Node.js + Express + SQLite');
      else if (type === 'api') setStack('Node.js + Express + PostgreSQL');
      else if (type === 'fullstack' && skill === 'beginner') setStack('React + Node.js + Tailwind');
      else if (type === 'fullstack') setStack('Next.js + Supabase + Tailwind');
      else if (type === 'cli') setStack('Node.js + Commander.js');
    }
  }, [type, skill, isStackAuto]);

  const handleAddFeature = () => {
    if (!newFeature.trim()) return;
    if (features.length >= 6) {
      setError('Hackathon Alert: Limit to 6 features for a 100% executable roadmap.');
      return;
    }
    setFeatures([...features, newFeature.trim()]);
    setNewFeature('');
    setError('');
  };

  const removeFeature = (idx) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (features.length < 2) {
      setError('Architect Tip: Define at least 2 core features for a valid plan.');
      return;
    }
    
    setLoad(true);
    setError('');
    
    const answers = {
      skill,
      time,
      type,
      stack: stack || 'not_sure',
      features
    };

    try {
      const res = await api.clarifyGoal(pid, answers);
      applyResponse(res);
      
      if (res.action === 'milestones_generated') {
        setSuccessMsg(res.message);
        navigate('/confirm-plan');
      } else if (res.action === 'plan_ready') {
        setSuccessMsg(res.message);
        navigate('/dashboard');
      }
    } catch(e) { 
      setError(e.message); 
    }
    setLoad(false);
  };

  return (
    <div className="goal-pg" style={{ 
      background: '#010409', 
      display: 'block', 
      overflowY: 'auto', 
      padding: '80px 20px',
      color: 'white'
    }}>
      <style>{`
        .mcq-group { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 40px; }
        .mcq-btn {
          background: #0d1117;
          border: 1px solid #21262d;
          border-radius: 16px;
          padding: 24px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
          position: relative;
          color: #8b949e;
        }
        .mcq-btn:hover { border-color: #58a6ff; background: rgba(56, 139, 253, 0.06); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.3); }
        .mcq-btn.active { border-color: #2ea043; background: rgba(46, 160, 67, 0.07); color: white; box-shadow: 0 0 0 1px rgba(46,160,67,0.2), 0 4px 16px rgba(0,0,0,0.3); }
        .mcq-btn.active .icon-box { color: #3fb950; }
        .icon-box { color: #484f58; margin-bottom: 16px; transition: color 0.2s; }
        .mcq-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
        .mcq-desc { font-size: 12px; opacity: 0.65; line-height: 1.5; }
        .setup-label { color: #3fb950; font-family: monospace; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        .setup-label::before { content: ''; display: block; width: 24px; height: 1px; background: #3fb950; opacity: 0.5; }
        .setup-section { background: #0d1117; border: 1px solid #21262d; border-radius: 16px; padding: 28px; }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <header style={{ marginBottom: 60, textAlign: 'left' }}>
          <div style={{ color: '#8b949e', fontSize: 13, marginBottom: 12, fontFamily: 'monospace' }}>
            // PROJECT CONFIGURATION : ID_{pid?.slice(-6).toUpperCase()}
          </div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16 }}>
            Confirm Project Parameters
          </h1>
          <div style={{ background: 'rgba(56, 139, 253, 0.1)', borderLeft: '3px solid #58a6ff', padding: '16px 20px', borderRadius: '0 8px 8px 0' }}>
             <p style={{ color: '#e6edf3', fontSize: 15, margin: 0, fontStyle: 'italic' }}>
               "{message || "Great choice. Let's lock in the execution plan."}"
             </p>
          </div>
        </header>

        {/* 1. Skill Level */}
        <section>
          <span className="setup-label">01. Experience Level</span>
          <div className="mcq-group">
            {[
              { id: 'beginner', label: 'Beginner', desc: 'Granular tasks & high-frequency hints', icon: <Zap /> },
              { id: 'intermediate', label: 'Intermediate', desc: 'Balanced guidance & deep dives', icon: <Rocket /> },
              { id: 'advanced', label: 'Advanced', desc: 'Architectural goals & open-ended tasks', icon: <Brain /> }
            ].map(s => (
              <button key={s.id} onClick={() => setSkill(s.id)} className={`mcq-btn ${skill === s.id ? 'active' : ''}`}>
                <div className="icon-box">{s.icon}</div>
                <div className="mcq-title">{s.label}</div>
                <div className="mcq-desc">{s.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 2. Duration */}
        <section>
          <span className="setup-label">02. Time Commitment</span>
          <div className="mcq-group">
            {[
              { id: 3, label: '3 Days', desc: 'Lightning Sprint (MVP Focus)', icon: <Zap size={20}/> },
              { id: 7, label: '7 Days', desc: 'Standard Build (Industry Flow)', icon: <Rocket size={20}/> },
              { id: 14, label: '14 Days', desc: 'Deep Build (Production Grade)', icon: <Brain size={20}/> }
            ].map(t => (
              <button key={t.id} onClick={() => setTime(t.id)} className={`mcq-btn ${time === t.id ? 'active' : ''}`}>
                <div className="icon-box">{t.icon}</div>
                <div className="mcq-title">{t.label}</div>
                <div className="mcq-desc">{t.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 3. Project Type */}
        <section>
          <span className="setup-label">03. Project Model</span>
          <div className="mcq-group">
            {[
              { id: 'api', label: 'Backend API', desc: 'JSON services & logic', icon: <Cpu /> },
              { id: 'fullstack', label: 'Fullstack App', desc: 'UI + Database + Auth', icon: <Globe /> },
              { id: 'ai', label: 'AI Integrated', desc: 'LLM & Prompt Logic', icon: <Brain /> },
              { id: 'cli', label: 'CLI Tool', desc: 'Terminal automations', icon: <Terminal /> }
            ].map(item => (
              <button key={item.id} onClick={() => setType(item.id)} className={`mcq-btn ${type === item.id ? 'active' : ''}`}>
                <div className="icon-box">{item.icon}</div>
                <div className="mcq-title">{item.label}</div>
                <div className="mcq-desc">{item.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 4. Tech Stack */}
        <section style={{ marginBottom: 60 }}>
          <span className="setup-label">04. Tech Stack Choice</span>
          <div className="setup-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <div>
                 <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Execution Stack</div>
                 <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.5 }}>Click custom to manually override recommendations.</div>
               </div>
               <button onClick={() => setIsStackAuto(!isStackAuto)} style={{ background: isStackAuto ? 'rgba(46,160,67,0.15)' : '#21262d', border: `1px solid ${isStackAuto ? '#2ea043' : '#30363d'}`, color: isStackAuto ? '#3fb950' : '#8b949e', padding: '6px 14px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 12, transition: 'all 0.2s' }}>
                 {isStackAuto ? '✓ System Recommended' : 'Custom'}
               </button>
            </div>
            {isStackAuto ? (
              <div style={{ background: '#010409', border: '1px solid #21262d', color: '#58a6ff', padding: '18px 20px', borderRadius: 12, fontSize: 16, fontFamily: 'monospace', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12 }}>
                <Code size={20} />
                {stack}
              </div>
            ) : (
              <input className="input" value={stack} onChange={e => setStack(e.target.value)} style={{ padding: 16, fontSize: 14, background: '#010409', border: '1px solid #30363d', color: 'white', width: '100%', borderRadius: 12 }} placeholder="e.g. Go, Gin, Redis, PostgreSQL" />
            )}
          </div>
        </section>

        {/* 5. Features */}
        <section>
          <span className="setup-label">05. Implementation Backlog</span>
          <div className="setup-section">
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input 
                className="input" 
                placeholder="Next feature (e.g. Payment Gateway, Social Login)" 
                value={newFeature} 
                onChange={e => setNewFeature(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddFeature()}
                style={{ flex: 1, background: '#010409', border: '1px solid #21262d', color: 'white', padding: 14, borderRadius: 12 }}
              />
              <button onClick={handleAddFeature} style={{ background: 'rgba(46,160,67,0.15)', border: '1px solid rgba(46,160,67,0.3)', color: '#3fb950', width: 52, borderRadius: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}>
                <Plus size={22} />
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {features.map((f, i) => (
                <div key={i} style={{ background: 'rgba(91,138,245,0.08)', border: '1px solid rgba(91,138,245,0.2)', color: '#a0b4f8', padding: '7px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <Check size={13} color="#3fb950" />
                  {f}
                  <X size={13} onClick={() => removeFeature(i)} style={{ cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.15s' }} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {error && <div style={{ background: 'rgba(248, 81, 73, 0.08)', border: '1px solid rgba(248, 81, 73, 0.3)', color: '#f85149', padding: '14px 18px', borderRadius: 12, marginTop: 32, fontSize: 13 }}>⚠ {error}</div>}

        <div style={{ display: 'flex', gap: 16, marginTop: 80, borderTop: '1px solid #21262d', paddingTop: 40 }}>
           <button className="btn-s" onClick={() => navigate('/goal')} style={{ border: 'none', background: 'transparent', color: '#8b949e' }}>Cancel</button>
           <button className="btn-green" onClick={handleSubmit} disabled={loading || features.length < 2} style={{ flex: 1, height: 54, fontSize: 16, justifyContent: 'center' }}>
             {loading ? <Loader2 className="spin" size={22} /> : <>Generate Architect Roadmap <ChevronRight size={18} /></>}
           </button>
        </div>
      </div>
    </div>
  );
}

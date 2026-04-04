import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store';
import { Terminal, Shield, Zap, RefreshCw, ArrowRight, Loader2, X } from 'lucide-react';

export default function GoalPage() {
  const navigate = useNavigate();
  const { userId, applyResponse, setSuccessMsg } = useStore();

  const [goal, setGoal] = useState('');
  const [loading, setLoad] = useState(false);
  const [error, setError] = useState('');
  const [refinementOptions, setRefinementOptions] = useState([]);

  const handleSubmit = async (overrideGoal = null) => {
    const finalGoal = overrideGoal || goal;
    if (!finalGoal.trim()) { setError('Enter a goal.'); return; }
    
    setLoad(true); 
    setError('');
    
    try {
      const res = await api.submitGoal(userId, finalGoal.trim());
      if (res.action === 'rejected') { 
        setError(res.message); 
        setLoad(false); 
        return; 
      }
      
      applyResponse(res);
      
      if (res.action === 'refine') {
        setRefinementOptions(res.options || []);
        setLoad(false);
      } else if (res.action === 'clarify') {
        setSuccessMsg(res.message);
        navigate('/clarify', { state: { questions: res.questions, projectId: res.project?.id, message: res.message } });
      } else if (res.action === 'setup') {
        setSuccessMsg(res.message);
        navigate('/setup', { state: { ...res } });
      } else if (res.action === 'milestones_generated') {
        setSuccessMsg(res.message);
        navigate('/confirm-plan');
      } else if (res.action === 'plan_ready') {
        setSuccessMsg(res.message);
        navigate('/dashboard');
      }
    } catch(e) { 
      setError(e.message); 
      setLoad(false);
    }
  };

  const selectRefinement = (opt) => {
    setGoal(opt);
    setRefinementOptions([]);
    handleSubmit(opt);
  };

  return (
    <div className="goal-pg" style={{ 
      background: '#010409', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      padding: '20px'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .terminal-box { animation: fadeIn 0.4s ease-out; }
        .input-terminal::placeholder { color: #484f58; opacity: 0.8; }
        .btn-green {
          background: #238636;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 6px;
          font-weight: 700;
          font-size: 14;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          alignItems: center;
          gap: 8px;
        }
        .btn-green:hover { background: #2ea043; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(46, 160, 67, 0.3); }
        .btn-green:disabled { background: #161b22; color: #484f58; cursor: not-allowed; }
        .chip-refine {
          background: transparent;
          border: 1px solid #30363d;
          color: #58a6ff;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .chip-refine:hover { border-color: #58a6ff; background: rgba(56, 139, 253, 0.1); }
      `}</style>

      <div className="terminal-box" style={{ width: '100%', maxWidth: 720 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#3fb950', fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.15em', marginBottom: 16 }}>
          <Terminal size={16} />
          <span>// INITIALIZE PROJECT</span>
        </div>

        <h1 style={{ fontSize: 56, fontWeight: 900, color: 'white', marginBottom: 16, letterSpacing: '-0.04em', lineHeight: 1 }}>
          What are you <br/> building?
        </h1>
        
        <p style={{ color: '#8b949e', fontSize: 16, marginBottom: 40, lineHeight: 1.6, maxWidth: 500 }}>
          State your project — what to build, what tech, what outcome, deadline. <br/>
          <span style={{ color: '#f85149', fontWeight: 600 }}>Vague goals are rejected.</span>
        </p>

        {/* Main Input Card */}
        <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 12, padding: '32px 40px', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 800, textTransform: 'uppercase', marginBottom: 24, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 8 }}>
              PROJECT GOAL
            </div>
            
            <textarea 
              className="input-terminal"
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="* Clear, structured, actionable banking communication&#10;* Without introducing errors or assumptions"
              rows={5}
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#e6edf3', fontFamily: 'SFMono-Regular, Consolas, monospace', fontSize: 18, resize: 'none', outline: 'none', lineHeight: 1.6 }}
              onKeyDown={e => e.ctrlKey && e.key === 'Enter' && handleSubmit()}
            />

            {/* Managed Intent Section */}
            {refinementOptions.length > 0 && (
              <div style={{ marginTop: 32, borderTop: '1px solid #30363d', paddingTop: 24 }}>
                <div style={{ fontSize: 11, color: '#3fb950', fontWeight: 700, marginBottom: 16, letterSpacing: '0.05em' }}>SUGGESTED MODELS (REFINE INTENT)</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {refinementOptions.map(opt => (
                    <button 
                      key={opt}
                      onClick={() => selectRefinement(opt)}
                      className="chip-refine"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 40, borderTop: '1px solid #30363d', paddingTop: 24 }}>
              <div style={{ fontSize: 12, color: '#484f58', fontFamily: 'monospace' }}>Ctrl+Enter to submit</div>
              <button className="btn-green" onClick={() => handleSubmit()} disabled={loading || !goal.trim()}>
                  {loading ? <Loader2 className="spin" size={18} /> : <>SUBMIT GOAL <ArrowRight size={18} /></>}
              </button>
            </div>
        </div>

        {/* Footer Features */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 40 }}>
            {[
              { icon: <X size={20} />, label: "No full solutions given" },
              { icon: <Shield size={20} />, label: "Strict QA every task" },
              { icon: <RefreshCw size={20} />, label: "Resume anytime" }
            ].map((f, i) => (
              <div key={i} style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#484f58' }}>
                {f.icon}
                <div style={{ fontSize: 11, fontWeight: 600, textAlign: 'center' }}>{f.label}</div>
              </div>
            ))}
        </div>

        {error && (
          <div style={{ marginTop: 24, background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.4)', color: '#f85149', padding: '12px 16px', borderRadius: 6, fontSize: 13 }}>
            ⚠ {error}
          </div>
        )}
      </div>
    </div>
  );
}

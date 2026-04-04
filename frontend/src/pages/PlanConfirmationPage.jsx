import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { api } from '../api/client';
import { Check, ArrowRight, Calendar, Target, Loader2, X, Plus, Clock, Brain, RefreshCw, Settings2, Trash2 } from 'lucide-react';

export default function PlanConfirmationPage() {
  const navigate = useNavigate();
  const { tempMilestones, project, setProject, applyResponse } = useStore();
  const [loading, setLoading] = useState(false);
  const [loadAction, setLoadAction] = useState('');
  const [error, setError] = useState('');
  const [newFeature, setNewFeature] = useState('');
  const [reasoning, setReasoning] = useState('');

  if (!tempMilestones || !project) {
    return (
      <div className="goal-pg" style={{ display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p style={{ color: '#8b949e' }}>No plan found to confirm. Please start from the goal page.</p>
        <button className="btn-p" onClick={() => navigate('/goal')}>Go to Goal Page</button>
      </div>
    );
  }

  const deliverables = Array.isArray(project.deliverables) ? project.deliverables : 
                       (typeof project.deliverables === 'string' ? JSON.parse(project.deliverables || '[]') : []);

  const handleAction = async (actionFn, actionName) => {
    setLoading(true);
    setLoadAction(actionName);
    setError('');
    try {
      const res = await actionFn();
      if (res.message) setReasoning(res.message);
      applyResponse(res);
    } catch (err) {
      setError(err.message || `Failed to ${actionName}`);
    }
    setLoading(false);
    setLoadAction('');
  };

  const adjustTime = (val) => handleAction(() => api.adjustPlan(project.id, 'time', val), 'updating timeline');
  const adjustSkill = (val) => handleAction(() => api.adjustPlan(project.id, 'difficulty', val), 'shifting difficulty');
  
  const addFeature = () => {
    if (!newFeature.trim()) return;
    const feats = [...deliverables];
    if (feats.length >= 8) { setError("Max features reached."); return; }
    handleAction(() => api.adjustPlan(project.id, 'add_feature', newFeature.trim()), 'adding feature');
    setNewFeature('');
  };

  const removeFeature = (val) => {
    handleAction(() => api.adjustPlan(project.id, 'remove_feature', val), 'removing feature');
  };

  const regenerate = () => handleAction(() => api.regeneratePlan(project.id), 'regenerating roadmap');

  const handleConfirm = async () => {
    setLoading(true);
    setLoadAction('confirming project');
    setError('');
    try {
      const res = await api.confirmProjectPlan(project.id, tempMilestones);
      applyResponse(res);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to confirm plan');
      setLoading(false);
      setLoadAction('');
    }
  };

  return (
    <div className="goal-pg" style={{ padding: '60px 20px', overflowY: 'auto', display: 'flex', justifyContent: 'center' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 40, width: '100%', maxWidth: 1200 }}>
        
        {/* LEFT: ROADMAP */}
        <div>
          <header style={{ marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(56, 139, 253, 0.1)', color: '#58a6ff', padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, marginBottom: 16 }}>
              <Target size={14} />
              <span>STEP 3: SYSTEM ROADMAP</span>
            </div>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>Execution Path Locked</h1>
            <p style={{ color: 'var(--tx-2)', fontSize: 16, lineHeight: 1.6 }}>
              AI has structured a deterministic path for: <span style={{ color: 'var(--tx-m)', fontWeight: 600 }}>"{project.raw_goal}"</span>
            </p>
          </header>

          {reasoning && (
            <div style={{ background: 'rgba(88, 166, 255, 0.1)', border: '1px solid rgba(88, 166, 255, 0.3)', padding: '16px', borderRadius: '8px', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#58a6ff', fontWeight: 700, fontSize: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Brain size={14} /> System Reasoning
              </div>
              <p style={{ color: '#c9d1d9', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
                {reasoning}
              </p>
            </div>
          )}

          {/* Setup reasoning banner */}
          <div style={{ background: 'var(--bg-o)', border: '1px solid var(--border)', borderLeft: '4px solid #2ea043', padding: '20px', borderRadius: '0 8px 8px 0', marginBottom: 32 }}>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--tx)' }}>
              Stack targeted: <span style={{ fontWeight: 700, color: '#3fb950' }}>
               {Array.isArray(project.tech_stack) ? project.tech_stack.join(' + ') : 
               (typeof project.tech_stack === 'string' ? (() => { try { return JSON.parse(project.tech_stack).join(' + ') } catch(e) { return project.tech_stack } })() : 'Optimized')}
              </span>.
              <br/>
              Calibrated for <span style={{ fontWeight: 600, color: 'var(--tx-m)' }}>{project.skill_level}</span> pacing across <span style={{ fontWeight: 600, color: 'var(--tx-m)' }}>{project.deadline_days} days</span>.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: loading && loadAction !== 'confirming project' ? 0.4 : 1, transition: 'opacity 0.2s' }}>
            {tempMilestones.map((m, i) => (
              <div key={i} className="card-outer" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex' }}>
                  <div style={{ width: 50, background: 'var(--bg-o)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: 'var(--tx-d)' }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, padding: '20px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700 }}>{m.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--tx-2)', fontSize: 12, background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 6 }}>
                        <Calendar size={14} />
                        <span>{m.duration_days} d</span>
                      </div>
                    </div>
                    <p style={{ color: 'var(--tx-2)', fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>{m.description}</p>
                    <div style={{ background: 'rgba(63, 185, 80, 0.05)', border: '1px solid rgba(63, 185, 80, 0.2)', borderRadius: 6, padding: '8px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#3fb950', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deliverable Check</div>
                      <div style={{ fontSize: 12, color: 'var(--tx-m)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Check size={14} color="#3fb950" />
                        {m.measurable_output}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: CONTROL PANEL */}
        <div>
          <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 12, padding: 24, position: 'sticky', top: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 24 }}>
              <Settings2 size={16} color="#8b949e"/> Adjustment Controls
            </div>

            {/* Time Controls */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={12} /> Time Box
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn-s" style={{ width: '100%', fontSize: 12, background: project.deadline_days === 3 ? 'rgba(56, 139, 253, 0.1)' : '', borderColor: project.deadline_days === 3 ? '#58a6ff' : '' }} 
                  onClick={() => adjustTime(3)} disabled={loading}
                >3 Days</button>
                <button 
                  className="btn-s" style={{ width: '100%', fontSize: 12, background: project.deadline_days === 7 ? 'rgba(56, 139, 253, 0.1)' : '', borderColor: project.deadline_days === 7 ? '#58a6ff' : '' }} 
                  onClick={() => adjustTime(7)} disabled={loading}
                >7 Days</button>
                <button 
                  className="btn-s" style={{ width: '100%', fontSize: 12, background: project.deadline_days === 14 ? 'rgba(56, 139, 253, 0.1)' : '', borderColor: project.deadline_days === 14 ? '#58a6ff' : '' }} 
                  onClick={() => adjustTime(14)} disabled={loading}
                >14 Days</button>
              </div>
            </div>

            {/* Difficulty Controls */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Brain size={12} /> Difficulty Pacing
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                 <button 
                   className="btn-s" style={{ width: '100%', fontSize: 12, background: project.skill_level === 'beginner' ? 'rgba(56, 139, 253, 0.1)' : '', borderColor: project.skill_level === 'beginner' ? '#58a6ff' : '' }} 
                   onClick={() => adjustSkill('beginner')} disabled={loading}
                 >Easier</button>
                 <button 
                   className="btn-s" style={{ width: '100%', fontSize: 12, background: project.skill_level === 'advanced' ? 'rgba(56, 139, 253, 0.1)' : '', borderColor: project.skill_level === 'advanced' ? '#58a6ff' : '' }} 
                   onClick={() => adjustSkill('advanced')} disabled={loading}
                 >Harder</button>
              </div>
            </div>

            {/* Features Controls */}
            <div style={{ marginBottom: 32, borderTop: '1px solid #30363d', paddingTop: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                Strict Features
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                {deliverables.length === 0 && <span style={{ fontSize: 12, color: '#484f58' }}>No specific features requested.</span>}
                {deliverables.map((f, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#010409', border: '1px solid #21262d', padding: '6px 10px', borderRadius: 6, fontSize: 12 }}>
                    <span style={{ color: 'var(--tx-m)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f}</span>
                    <button onClick={() => removeFeature(f)} disabled={loading} style={{ background: 'none', border: 'none', color: '#f85149', cursor: 'pointer', padding: 2, display: 'flex' }}>
                       <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <input 
                  className="input" 
                  value={newFeature} 
                  onChange={e => setNewFeature(e.target.value)} 
                  placeholder="e.g. Email Auth" 
                  style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} 
                  disabled={loading}
                  onKeyDown={e => e.key === 'Enter' && addFeature()}
                />
                <button className="btn-s" onClick={addFeature} disabled={loading || !newFeature.trim()} style={{ padding: '6px 12px' }}>
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Force Regenerate */}
            <button className="btn-s" onClick={regenerate} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginBottom: 32, gap: 8 }}>
              {loading && loadAction === 'regenerating roadmap' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} 
              Regenerate Pattern
            </button>


            {error && (
              <div style={{ background: 'rgba(248, 81, 73, 0.1)', border: '1px solid rgba(248, 81, 73, 0.4)', color: '#f85149', padding: '10px 12px', borderRadius: 6, marginBottom: 20, fontSize: 11 }}>
                {error}
              </div>
            )}

            <button 
              className="btn-green" 
              style={{ width: '100%', height: 48, fontSize: 14, justifyContent: 'center', opacity: loading ? 0.7 : 1 }} 
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading && loadAction === 'confirming project' ? (
                <> <Loader2 className="spin" size={16} /> Initializing IDE... </>
              ) : (
                <> Start Final Execution <ArrowRight size={16} /> </>
              )}
            </button>
            {loading && loadAction && loadAction !== 'confirming project' && (
              <div style={{ textAlign: 'center', color: '#58a6ff', fontSize: 11, marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Loader2 className="spin" size={12} /> {loadAction}...
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

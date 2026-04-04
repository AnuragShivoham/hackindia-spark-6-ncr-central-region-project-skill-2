import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store';
import { Spinner, StatusBadge, ProgressBar } from '../components/UI';
import { FolderGit2, Plus, Trash2 } from 'lucide-react';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { userId, applyResponse, setSuccessMsg } = useStore();
  const [projects, setProjects] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState('');
  const [resumingId, setResumingId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filter, setFilter] = useState('ai');

  const fetchProjects = async () => {
    try {
      setLoad(true);
      const data = await api.getUserProjects(userId);
      setProjects(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad(false);
    }
  };

  useEffect(() => {
    if (userId) fetchProjects();
  }, [userId]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await api.deleteProject(id);
      setDeleteConfirmId(null);
      await fetchProjects();
    } catch (err) {
      setError(err.message);
    }
    setDeletingId(null);
  };

  const handleResume = async (id) => {
    setResumingId(id);
    setError('');
    try {
      const res = await api.resumeProject(id);
      applyResponse(res);
      setSuccessMsg(`Resumed project: ${res.project.title}`);
      
      // Determine correct page based on action or status
      if (res.action === 'milestones_generated' || res.project.status === 'planning') {
        navigate('/confirm-plan');
      } else if (res.project.status === 'clarifying') {
        navigate('/setup');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
      setResumingId(null);
    }
  };

  const aiProjects = projects.filter(p => !p.is_course);
  const courseProjects = projects.filter(p => p.is_course);
  const displayProjects = filter === 'ai' ? aiProjects : courseProjects;

  return (
    <div className="goal-pg" style={{ alignItems: 'flex-start', paddingTop: 80 }}>
      <div style={{ width: '100%', maxWidth: 1000, margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div style={{ display: 'flex', gap: 20 }}>
            <button 
              onClick={() => setFilter('ai')} 
              style={{ background: 'transparent', border: 'none', color: filter === 'ai' ? 'var(--blue)' : 'var(--tx-d)', fontSize: 20, fontWeight: 800, cursor: 'pointer', paddingBottom: 4, borderBottom: filter === 'ai' ? '2px solid var(--blue)' : '2px solid transparent' }}
            >
              AI Projects
            </button>
            <button 
              onClick={() => setFilter('course')} 
              style={{ background: 'transparent', border: 'none', color: filter === 'course' ? 'var(--blue)' : 'var(--tx-d)', fontSize: 20, fontWeight: 800, cursor: 'pointer', paddingBottom: 4, borderBottom: filter === 'course' ? '2px solid var(--blue)' : '2px solid transparent' }}
            >
              Courses
            </button>
          </div>
          <button className="btn btn-p" onClick={() => navigate(filter === 'ai' ? '/goal' : '/marketplace')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> {filter === 'ai' ? 'New Project' : 'Browse Marketplace'}
          </button>
        </div>

        {error && <div className="err" style={{ marginBottom: 20 }}>⚠ {error}</div>}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Spinner /></div>
        ) : displayProjects.length === 0 ? (
          <div className="card fade-in" style={{ textAlign: 'center', padding: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-o)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderGit2 size={24} color="var(--tx-d)" />
            </div>
            <div style={{ color: 'var(--tx-2)', fontSize: 13 }}>You don't have any {filter === 'ai' ? 'AI projects' : 'courses'} yet.</div>
            <button className="btn btn-p" onClick={() => navigate(filter === 'ai' ? '/goal' : '/marketplace')}>
              {filter === 'ai' ? 'Create Your First Project' : 'Enroll in a Course'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {(Array.isArray(displayProjects) ? displayProjects : []).map(p => (
              <div 
                key={p.id} 
                className="card" 
                style={{ 
                  cursor: resumingId ? 'not-allowed' : 'pointer', 
                  transition: 'transform 0.2s, border-color 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: resumingId && resumingId !== p.id ? 0.5 : 1
                }}
                onClick={() => !resumingId && handleResume(p.id)}
                onMouseEnter={e => !resumingId && (e.currentTarget.style.borderColor = 'var(--blue)')}
                onMouseLeave={e => !resumingId && (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ flex: 1, paddingRight: 10 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)', marginBottom: 6, lineHeight: 1.3 }}>{p.title}</h3>
                    <div style={{ fontSize: 11, color: 'var(--tx-d)', fontFamily: 'var(--mono)' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                    <StatusBadge status={p.status} />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                      style={{ background: 'transparent', border: 'none', color: 'var(--tx-d)', cursor: 'pointer', padding: 4 }}
                      title="Delete Project"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--tx-2)' }}>
                  <span>Progress</span>
                  <span style={{ fontFamily: 'var(--mono)' }}>{p.completed_tasks}/{p.total_tasks} Tasks</span>
                </div>
                <ProgressBar pct={p.progress_pct || 0} />
                
                {resumingId === p.id && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,10,12,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                    <Spinner />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card fade-in" style={{ width: 400, maxWidth: '90%', padding: 24, textAlign: 'center' }}>
            <Trash2 size={32} color="var(--red)" style={{ margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx)', marginBottom: 8 }}>Delete Project?</div>
            <div style={{ fontSize: 13, color: 'var(--tx-2)', marginBottom: 24, lineHeight: 1.5 }}>
              This action is permanent. All files, tasks, milestones, and chat history will be completely erased.
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--tx)' }} onClick={() => setDeleteConfirmId(null)} disabled={deletingId}>
                Cancel
              </button>
              <button className="btn btn-p" style={{ flex: 1, background: 'var(--red)', color: 'white', border: 'none' }} onClick={(e) => handleDelete(e, deleteConfirmId)} disabled={deletingId}>
                {deletingId === deleteConfirmId ? <Spinner /> : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

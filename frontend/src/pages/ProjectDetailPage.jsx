import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store';
import { ArrowLeft, Play, Loader2, Clock, ChevronDown, ChevronRight, BookOpen, Target, Zap } from 'lucide-react';

const DIFF = { beginner: '#3fb950', intermediate: '#f0883e', advanced: '#f85149', easy: '#3fb950', medium: '#f0883e', hard: '#f85149' };

export default function ProjectDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { token } = useStore();
    const reset = useStore(s => s.reset);
    const [project, setProject] = useState(null);
    const [structure, setStructure] = useState(null); // { course, milestones, tasks }
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [expandedMs, setExpandedMs] = useState({});
    const [error, setError] = useState('');

    useEffect(() => {
        if (!token) { navigate('/login'); return; }
        (async () => {
            try {
                // 1. Get project from marketplace
                const res = await api.getMarketplace();
                const found = (res.projects || []).find(p => p.id === id);
                setProject(found || null);

                // 2. If official (course), fetch full structure
                if (found && found.source === 'official') {
                    try {
                        const courseData = await api.getCourse(found.id);
                        setStructure(courseData);
                        // Auto-expand first milestone
                        if (courseData.milestones?.length > 0) {
                            setExpandedMs({ [courseData.milestones[0].id]: true });
                        }
                    } catch (e) {
                        console.warn('[Course Structure]', e.message);
                    }
                }
            } catch (e) {
                console.error('[Detail]', e);
            }
            setLoading(false);
        })();
    }, [id, token]);

    const handleStart = async () => {
        setStarting(true);
        setError('');
        try {
            const res = await api.startMarketplaceProject(project.id);
            // Clear old project data and set new project ID
            reset();
            if (res.project_id || res.project?.id) {
                localStorage.setItem('ab_pid', res.project_id || res.project?.id);
            }
            navigate('/dashboard');
        } catch (e) {
            setError(e.message);
        }
        setStarting(false);
    };

    const parse = (v, d) => { try { return typeof v === 'string' ? JSON.parse(v) : (v || d); } catch { return d; } };

    if (loading) {
        return (
            <div style={st.loadingScreen}>
                <Loader2 size={20} className="spin" /> Loading project...
            </div>
        );
    }

    if (!project) {
        return (
            <div style={st.loadingScreen}>
                <p>Project not found</p>
                <button onClick={() => navigate('/marketplace')} style={st.backBtn}><ArrowLeft size={14} /> Back to Marketplace</button>
            </div>
        );
    }

    let techStack = [];
    try {
        techStack = Array.isArray(project.tech_stack) ? project.tech_stack : JSON.parse(project.tech_stack || '[]');
    } catch (e) {
        techStack = (project.tech_stack || '').split(',').map(s => s.trim()).filter(Boolean);
    }

    const milestones = structure?.milestones || [];
    const tasks = structure?.tasks || [];
    const totalTasks = tasks.length;
    const totalHours = Math.round(tasks.reduce((sum, t) => sum + (t.estimated_minutes || 30), 0) / 60);

    return (
        <div style={st.page}>
            <button onClick={() => navigate('/marketplace')} style={st.backBtn}>
                <ArrowLeft size={14} /> Back to Marketplace
            </button>

            <div style={st.layout}>
                {/* LEFT: Course Info */}
                <div style={st.mainCol}>
                    {/* Header */}
                    <div style={st.headerTop}>
                        <span style={{
                            ...st.badge,
                            background: project.badge === 'official' ? 'rgba(88,166,255,0.15)' : 'rgba(240,136,62,0.15)',
                            color: project.badge === 'official' ? '#58a6ff' : '#f0883e'
                        }}>
                            {project.badge === 'official' ? '🔵 Official' : '🟡 Community'}
                        </span>
                        <span style={{ color: DIFF[project.difficulty] || '#8b949e', fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>
                            {project.difficulty || 'intermediate'}
                        </span>
                    </div>

                    <h1 style={st.title}>{project.title}</h1>
                    <p style={st.description}>{project.description}</p>

                    {/* Learning Outcome */}
                    {structure?.course?.learning_outcome && (
                        <div style={st.outcomeBox}>
                            <Target size={16} color="#58a6ff" />
                            <div>
                                <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Learning Outcome</div>
                                <div style={{ fontSize: 13, color: '#e6edf3', lineHeight: 1.5 }}>{structure.course.learning_outcome}</div>
                            </div>
                        </div>
                    )}

                    {/* Tech Stack */}
                    {techStack.length > 0 && (
                        <div style={{ marginBottom: 24 }}>
                            <div style={st.sectionLabel}>TECH STACK</div>
                            <div style={st.tagRow}>
                                {techStack.map((t, i) => <span key={i} style={st.techTag}>{t}</span>)}
                            </div>
                        </div>
                    )}

                    {/* Course Structure (Milestones + Tasks) */}
                    {milestones.length > 0 ? (
                        <div style={{ marginBottom: 32 }}>
                            <div style={st.sectionLabel}>COURSE STRUCTURE</div>
                            {milestones.map((ms, mIdx) => {
                                const msTasks = tasks.filter(t => t.milestone_id === ms.id);
                                const expanded = expandedMs[ms.id];
                                return (
                                    <div key={ms.id} style={st.msCard}>
                                        <div style={st.msHeader} onClick={() => setExpandedMs(prev => ({ ...prev, [ms.id]: !prev[ms.id] }))}>
                                            {expanded ? <ChevronDown size={14} color="#8b949e" /> : <ChevronRight size={14} color="#8b949e" />}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>
                                                    {mIdx + 1}. {ms.title}
                                                </div>
                                                {ms.description && <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{ms.description}</div>}
                                            </div>
                                            <span style={st.taskCountBadge}>{msTasks.length} tasks</span>
                                        </div>

                                        {expanded && msTasks.length > 0 && (
                                            <div style={st.msBody}>
                                                {msTasks.map((t, tIdx) => {
                                                    const concepts = parse(t.concepts, []);
                                                    return (
                                                        <div key={t.id} style={st.taskItem}>
                                                            <div style={st.taskNum}>{tIdx + 1}</div>
                                                            <div style={{ flex: 1 }}>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9' }}>{t.title}</div>
                                                                {t.goal && <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{t.goal}</div>}
                                                                {concepts.length > 0 && (
                                                                    <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
                                                                        {concepts.map((c, i) => <span key={i} style={st.conceptTag}>{c}</span>)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                                                <span style={{ fontSize: 10, color: DIFF[t.difficulty] || '#8b949e', fontWeight: 700 }}>{t.difficulty?.toUpperCase()}</span>
                                                                <span style={{ fontSize: 10, color: '#484f58' }}>~{t.estimated_minutes || 30}m</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : project.source === 'community' && (
                        <div style={{ marginBottom: 32 }}>
                            <div style={st.sectionLabel}>SYSTEM GENERATED ROADMAP</div>
                            <div style={st.aiPromoBox}>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                    <Zap size={18} color="#f0883e" />
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#e6edf3', fontSize: 13 }}>Tailored Learning Path</div>
                                        <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.4 }}>Our AI will generate a unique 5-8 milestone roadmap specifically for this project description upon start.</div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <BookOpen size={18} color="#58a6ff" />
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#e6edf3', fontSize: 13 }}>On-Demand Hints & Tasks</div>
                                        <div style={{ fontSize: 12, color: '#8b949e', lineHeight: 1.4 }}>Real-time guidance and debugging support are provided for every generated task by your AMIT-BODHIT Mentor.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {error && <div style={st.errorBox}>{error}</div>}
                </div>

                {/* RIGHT: Sticky Sidebar */}
                <div style={st.sidebar}>
                    <div style={st.sidebarCard}>
                        <div style={st.statRow}>
                            <BookOpen size={16} color="#58a6ff" />
                            <div>
                                <div style={st.statLabel}>Milestones</div>
                                <div style={st.statVal}>{milestones.length}</div>
                            </div>
                        </div>
                        <div style={st.statRow}>
                            <Zap size={16} color="#f0883e" />
                            <div>
                                <div style={st.statLabel}>Tasks</div>
                                <div style={st.statVal}>{totalTasks}</div>
                            </div>
                        </div>
                        <div style={st.statRow}>
                            <Clock size={16} color="#8b949e" />
                            <div>
                                <div style={st.statLabel}>Estimated</div>
                                <div style={st.statVal}>{project.estimated_hours || totalHours}h</div>
                            </div>
                        </div>

                        <div style={st.divider} />

                        <button onClick={handleStart} disabled={starting} style={st.startBtn}>
                            {starting ? <Loader2 size={16} className="spin" /> : <Play size={16} />}
                            <span>Start Course</span>
                        </button>

                        <div style={{ fontSize: 11, color: '#484f58', textAlign: 'center', marginTop: 8 }}>
                            Your workspace will be created automatically
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const st = {
    page: { minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', padding: '24px 32px 60px', fontFamily: 'var(--sans)' },
    loadingScreen: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d1117', color: '#8b949e', gap: 12, flexDirection: 'column' },
    backBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 12, padding: '6px 0', marginBottom: 24 },

    layout: { display: 'flex', gap: 32, maxWidth: 1000, margin: '0 auto' },
    mainCol: { flex: 1, minWidth: 0 },
    sidebar: { width: 280, flexShrink: 0, position: 'sticky', top: 80, alignSelf: 'flex-start' },

    headerTop: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
    badge: { fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6 },
    title: { fontSize: 28, fontWeight: 800, color: '#e6edf3', margin: '0 0 12px 0', lineHeight: 1.3 },
    description: { fontSize: 14, color: '#8b949e', lineHeight: 1.7, marginBottom: 24 },

    outcomeBox: { display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(88,166,255,0.05)', border: '1px solid rgba(88,166,255,0.15)', borderRadius: 8, padding: 16, marginBottom: 24 },

    sectionLabel: { fontSize: 11, color: '#8b949e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 },
    tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
    techTag: { padding: '4px 8px', borderRadius: 4, background: '#161b22', border: '1px solid #21262d', color: '#7ee787', fontSize: 11, fontFamily: 'var(--mono)' },

    // Milestone
    msCard: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, marginBottom: 8, overflow: 'hidden' },
    msHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', cursor: 'pointer' },
    taskCountBadge: { fontSize: 11, color: '#8b949e', background: '#0d1117', padding: '2px 8px', borderRadius: 4 },
    msBody: { borderTop: '1px solid #21262d', padding: '12px 16px' },

    // Task
    taskItem: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: '1px solid #21262d' },
    taskNum: { width: 24, height: 24, borderRadius: '50%', background: 'rgba(88,166,255,0.1)', color: '#58a6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 },
    conceptTag: { fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'rgba(126,231,135,0.08)', color: '#7ee787', fontFamily: 'var(--mono)' },

    // Sidebar Card
    sidebarCard: { background: '#161b22', border: '1px solid #30363d', borderRadius: 10, padding: 20 },
    statRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' },
    statLabel: { fontSize: 11, color: '#8b949e' },
    statVal: { fontSize: 18, fontWeight: 800, color: '#e6edf3' },
    divider: { height: 1, background: '#21262d', margin: '12px 0' },
    startBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px', borderRadius: 8, background: 'linear-gradient(135deg, #238636, #2ea043)', color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer' },

    errorBox: { background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#ff7b72', padding: '10px 16px', borderRadius: 6, fontSize: 13 },
    aiPromoBox: { background: 'rgba(240,136,62,0.05)', border: '1px solid rgba(240,136,62,0.15)', borderRadius: 10, padding: 20 },
};

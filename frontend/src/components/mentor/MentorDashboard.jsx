import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { Loader2, AlertTriangle, ShieldCheck, Zap, Maximize2 } from 'lucide-react';
import { CodeBlock } from '../UI';

export default function MentorDashboard() {
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState(null);
    const [previewContext, setPreviewContext] = useState(null);
    const [joining, setJoining] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const loadQueue = async () => {
        try {
            const data = await api.getMentorQueue(); // Assumes added to client.js
            setQueue(data);
        } catch (e) {
            console.error('Queue error:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadQueue();
        const interval = setInterval(loadQueue, 5000); // Live poll
        return () => clearInterval(interval);
    }, []);

    const handlePreview = async (item) => {
        setPreview(item);
        setPreviewContext(null);
        try {
            const ctx = await api.getMentorSessionContext(item.projectId); // Assumes added to client.js
            setPreviewContext(ctx);
        } catch (e) {
            console.error(e);
        }
    };

    const handleJoin = async (projectId) => {
        if (joining) return;
        setJoining(true);
        setError('');
        try {
            await api.mentorJoinSession(projectId);
            navigate(`/mentor/${projectId}`);
        } catch (e) {
            setError(e.response?.data?.error || 'Failed to lock session for intervention.');
            setJoining(false);
        }
    };

    if (loading) return <div style={styles.center}><Loader2 className="spin" /> Loading Queue...</div>;

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <h2>Intervention Engine (Top Priority)</h2>
                <div style={{ fontSize: 13, color: '#8b949e' }}>Live Priority formula: Attempts + Time Stuck + Cheating Penalties</div>
            </div>

            {error && <div style={styles.errorBanner}>{error}</div>}

            <div style={styles.queueGrid}>
                {queue.length === 0 ? (
                    <div style={styles.emptyCard}>Queue cleared! All students are performing safely.</div>
                ) : (
                    queue.map((item, i) => (
                        <div key={item.projectId} style={{ ...styles.card, borderColor: i === 0 ? '#f85149' : '#30363d' }}>
                            <div style={styles.cardHeader}>
                                <div>
                                    <h4 style={{ margin: 0 }}>{item.studentName || 'Student'} <span style={styles.badge}>#{Math.round(item.priority)}</span></h4>
                                    <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>{item.currentTask}</div>
                                </div>
                                {item.helpRequested && <span style={styles.helpBadge}>MANUAL SOS</span>}
                            </div>
                            
                            <div style={styles.metrics}>
                                <div style={styles.metricBox}>
                                    <div style={styles.label}>ATTEMPTS</div>
                                    <div style={styles.val}>{item.attempts}</div>
                                </div>
                                <div style={styles.metricBox}>
                                    <div style={styles.label}>TIME STUCK</div>
                                    <div style={styles.val}>{item.timeStuck}m</div>
                                </div>
                                <div style={styles.metricBox}>
                                    <div style={styles.label}>CHEAT RATING</div>
                                    <div style={styles.val} className={item.cheatScore > 50 ? 'text-red' : ''}>{item.cheatScore}</div>
                                </div>
                            </div>

                            <button onClick={() => handlePreview(item)} style={styles.previewBtn}>
                                <Maximize2 size={14} /> Inspect Context
                            </button>
                        </div>
                    ))
                )}
            </div>

            {preview && (
                <div style={styles.modalOverlay}>
                    <div style={styles.previewModal}>
                        <div style={styles.modalHeader}>
                            <h3>Context: {preview.studentName}</h3>
                            <button onClick={() => setPreview(null)} style={styles.closeBtn}>✕</button>
                        </div>
                        <div style={styles.modalBody}>
                            {!previewContext ? (
                                <div style={styles.center}><Loader2 className="spin" size={24} /> Fetching live AST snapshot...</div>
                            ) : (
                                <>
                                    <div style={{ marginBottom: 16 }}>
                                        <strong>Current Source Snapshot:</strong>
                                        <CodeBlock code={previewContext.codeSnapshot || '// No changes found.'} language="javascript" />
                                    </div>
                                    {previewContext.recentFeedback.length > 0 && (
                                        <div>
                                            <strong>Last Warning/Feedback:</strong>
                                            <div style={styles.feedbackBox}>
                                                {previewContext.recentFeedback[0]}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div style={styles.modalFooter}>
                            <button onClick={() => setPreview(null)} style={styles.cancelBtn}>Dismiss</button>
                            <button 
                                onClick={() => handleJoin(preview.projectId)} 
                                disabled={joining || !previewContext} 
                                style={styles.joinBtn}
                            >
                                {joining ? 'Locking Database...' : 'Accept Intervention (Lock Session)'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    page: { maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: 'var(--sans)', color: '#c9d1d9' },
    header: { marginBottom: 32, borderBottom: '1px solid #30363d', paddingBottom: 16 },
    center: { display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', height: '30vh' },
    errorBanner: { background: '#842029', color: '#f8d7da', padding: 12, borderRadius: 6, marginBottom: 16, fontWeight: 600 },
    queueGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 },
    emptyCard: { background: '#161b22', padding: 32, borderRadius: 12, textAlign: 'center', color: '#8b949e', gridColumn: '1 / -1' },
    card: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 },
    cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    badge: { background: '#238636', color: '#fff', padding: '2px 6px', borderRadius: 4, fontSize: 10, verticalAlign: 'middle', marginLeft: 6 },
    helpBadge: { background: '#f85149', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 4 },
    metrics: { display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid #21262d', borderBottom: '1px solid #21262d' },
    metricBox: { flex: 1 },
    label: { fontSize: 10, color: '#8b949e', fontWeight: 600, marginBottom: 4 },
    val: { fontSize: 18, fontWeight: 700, color: '#e6edf3' },
    previewBtn: { background: '#1f2937', color: '#58a6ff', border: '1px solid #58a6ff44', padding: '8px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600 },
    
    // Modal
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(1,4,9,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
    previewModal: { width: '100%', maxWidth: 800, maxHeight: '85vh', background: '#0d1117', border: '1px solid #30363d', borderRadius: 12, display: 'flex', flexDirection: 'column' },
    modalHeader: { padding: '16px 24px', borderBottom: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    closeBtn: { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: 20 },
    modalBody: { flex: 1, overflowY: 'auto', padding: 24 },
    feedbackBox: { background: '#21262d', padding: 12, borderRadius: 6, fontSize: 13, fontFamily: 'var(--mono)', color: '#ff7b72' },
    modalFooter: { padding: '16px 24px', borderTop: '1px solid #30363d', display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#161b22' },
    cancelBtn: { background: 'none', border: '1px solid #30363d', color: '#8b949e', padding: '8px 24px', borderRadius: 6, cursor: 'pointer' },
    joinBtn: { background: '#a371f7', border: 'none', color: '#fff', padding: '8px 24px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }
};

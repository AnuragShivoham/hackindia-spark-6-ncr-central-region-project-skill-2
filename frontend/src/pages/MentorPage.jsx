import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { api } from '../api/client';
import { useStore } from '../store';
import { ArrowLeft, Loader2, Monitor, Lightbulb, MessageSquare, ShieldAlert, Maximize2, RefreshCw } from 'lucide-react';

export default function MentorPage() {
    const navigate = useNavigate();
    const { token, role } = useStore();

    // --- Core State ---
    const [queue, setQueue] = useState([]);
    const [queueLoading, setQueueLoading] = useState(true);
    const [error, setError] = useState('');

    // --- Session State ---
    const [selectedStudent, setSelectedStudent] = useState(null); // null = queue view, object = live session
    const [sessionContext, setSessionContext] = useState(null);
    const [joining, setJoining] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState([]);

    // --- Guard: Mentor only ---
    useEffect(() => {
        if (!token) { navigate('/login'); return; }
        if (role !== 'mentor') { navigate('/dashboard'); return; }
    }, [token, role, navigate]);

    // --- Load Queue ---
    const loadQueue = useCallback(async () => {
        try {
            const data = await api.getMentorQueue();
            setQueue(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('[MentorQueue]', e);
            setQueue([]);
        } finally {
            setQueueLoading(false);
        }
    }, []);

    useEffect(() => {
        loadQueue();
        const interval = setInterval(loadQueue, 8000); // Live poll every 8s
        return () => clearInterval(interval);
    }, [loadQueue]);

    // --- Join Session ---
    const handleJoinSession = async (item) => {
        setJoining(true);
        setError('');
        try {
            await api.mentorJoinSession(item.projectId);
            // Fetch context
            const ctx = await api.getMentorSessionContext(item.projectId);
            setSessionContext(ctx);
            setSelectedStudent(item);
            setChatMessages([{ role: 'system', content: `Connected to ${item.studentName}'s session. Task: ${item.currentTask}` }]);
        } catch (e) {
            const msg = e.response?.data?.error || e.message;
            if (msg === 'SESSION_ALREADY_LOCKED') {
                setError('Another mentor already locked this session.');
            } else {
                setError('Failed to join session: ' + msg);
            }
        } finally {
            setJoining(false);
        }
    };

    // --- Leave Session ---
    const handleLeaveSession = async () => {
        if (!selectedStudent) return;
        try {
            await api.mentorLeaveSession(selectedStudent.projectId);
        } catch (e) {
            console.error('[Leave]', e);
        }
        setSelectedStudent(null);
        setSessionContext(null);
        setChatMessages([]);
        loadQueue(); // Refresh queue
    };

    // --- Send Chat Hint ---
    const handleSendHint = () => {
        if (!chatInput.trim()) return;
        setChatMessages(prev => [...prev, { role: 'mentor', content: chatInput }]);
        // TODO: Send via WebSocket to student in real-time
        setChatInput('');
    };

    // --- Detect language ---
    const getLanguage = (filePath = '') => {
        const ext = filePath.split('.').pop()?.toLowerCase();
        if (['js', 'jsx', 'mjs'].includes(ext)) return 'javascript';
        if (['ts', 'tsx'].includes(ext)) return 'typescript';
        if (ext === 'py') return 'python';
        if (ext === 'html') return 'html';
        if (ext === 'css') return 'css';
        if (ext === 'json') return 'json';
        return 'javascript';
    };

    // ─── LOADING ──────────────────────────────────────────────────────────────
    if (queueLoading && !selectedStudent) {
        return (
            <div style={styles.loadingScreen}>
                <Loader2 size={20} className="spin" /> <span>Loading intervention queue...</span>
            </div>
        );
    }

    // ─── LIVE SESSION VIEW ────────────────────────────────────────────────────
    if (selectedStudent && sessionContext) {
        return (
            <div style={styles.sessionPage}>
                {/* Top Bar */}
                <div style={styles.sessionTopBar}>
                    <button onClick={handleLeaveSession} style={styles.leaveBtn}>
                        <ArrowLeft size={14} /> Leave Session
                    </button>
                    <div style={styles.separator} />
                    <span style={styles.observingLabel}>
                        Observing: <strong>{selectedStudent.studentName}</strong>
                    </span>
                    <span style={styles.taskLabel}>{selectedStudent.currentTask}</span>
                    <div style={styles.liveBadge}>
                        <div style={styles.liveDot} />
                        <span>LIVE FEED</span>
                    </div>
                </div>

                <div style={styles.sessionBody}>
                    {/* LEFT: Student Code (Read Only) */}
                    <div style={styles.codePane}>
                        <div style={styles.codePaneHeader}>
                            <span style={styles.fileName}>{selectedStudent.filePath || 'student_code.js'}</span>
                            <span style={styles.readOnlyTag}>Read Only</span>
                        </div>
                        <div style={styles.editorWrap}>
                            <Editor
                                height="100%"
                                language={getLanguage(selectedStudent.filePath)}
                                theme="vs-dark"
                                value={sessionContext.codeSnapshot || '// No code snapshot available'}
                                options={{ minimap: { enabled: false }, fontSize: 14, fontFamily: '"Fira Code", monospace', readOnly: true, padding: { top: 12 } }}
                            />
                        </div>
                    </div>

                    {/* RIGHT: Mentor Toolkit */}
                    <div style={styles.toolkitPane}>
                        {/* Summary Card */}
                        <div style={styles.toolkitSection}>
                            <h3 style={styles.sectionTitle}>SESSION CONTEXT</h3>
                            <div style={styles.contextCard}>
                                <div style={styles.contextRow}>
                                    <span style={styles.contextLabel}>Attempts</span>
                                    <span style={styles.contextVal}>{sessionContext.attempts || 0}</span>
                                </div>
                                <div style={styles.contextRow}>
                                    <span style={styles.contextLabel}>Scaffold Level</span>
                                    <span style={styles.contextVal}>{sessionContext.lastScaffoldLevel || 1}</span>
                                </div>
                                <div style={styles.contextRow}>
                                    <span style={styles.contextLabel}>Cheat Score</span>
                                    <span style={{ ...styles.contextVal, color: selectedStudent.cheatScore > 50 ? '#f85149' : '#3fb950' }}>
                                        {selectedStudent.cheatScore || 0}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Feedback */}
                        {sessionContext.recentFeedback?.length > 0 && (
                            <div style={styles.toolkitSection}>
                                <h3 style={styles.sectionTitle}>LAST FEEDBACK</h3>
                                <div style={styles.feedbackBox}>
                                    {sessionContext.recentFeedback[0]?.substring(0, 200)}
                                    {sessionContext.recentFeedback[0]?.length > 200 ? '...' : ''}
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div style={styles.toolkitSection}>
                            <h3 style={styles.sectionTitle}>QUICK ACTIONS</h3>
                            <button style={styles.actionBtn}>
                                <Lightbulb size={14} color="#f0883e" /> Send Syntax Hint
                            </button>
                            <button style={styles.actionBtn}>
                                <Monitor size={14} color="#58a6ff" /> Suggest Code Edit
                            </button>
                            <div style={styles.noteText}>Direct overwrite disabled to enforce student learning.</div>
                        </div>

                        {/* Live Chat */}
                        <div style={{ ...styles.toolkitSection, flex: 1, display: 'flex', flexDirection: 'column' }}>
                            <h3 style={styles.sectionTitle}>LIVE CHAT</h3>
                            <div style={styles.chatArea}>
                                {chatMessages.map((m, i) => (
                                    <div key={i} style={{ ...styles.chatMsg, alignSelf: m.role === 'mentor' ? 'flex-end' : 'flex-start' }}>
                                        <div style={styles.chatRole}>{m.role === 'mentor' ? 'You' : m.role === 'system' ? 'System' : 'Student'}</div>
                                        <div style={{ ...styles.chatBubble, background: m.role === 'mentor' ? 'rgba(88,166,255,0.1)' : m.role === 'system' ? 'rgba(139,148,158,0.1)' : 'rgba(63,185,80,0.1)' }}>
                                            {m.content}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={styles.chatInputRow}>
                                <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSendHint()}
                                    placeholder="Type a hint..."
                                    style={styles.chatInputField}
                                />
                                <button onClick={handleSendHint} style={styles.sendBtn}>Send</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ─── QUEUE VIEW (DEFAULT) ─────────────────────────────────────────────────
    return (
        <div style={styles.queuePage}>
            {/* Top Bar */}
            <div style={styles.queueTopBar}>
                <Monitor size={18} color="#58a6ff" />
                <span style={styles.panelTitle}>MENTOR CONTROL PANEL</span>
                <button onClick={loadQueue} style={styles.refreshBtn} title="Refresh Queue">
                    <RefreshCw size={14} />
                </button>
                <div style={styles.onlineBadge}>
                    <div style={styles.onlineDot} />
                    <span>ONLINE</span>
                </div>
            </div>

            {error && <div style={styles.errorBanner}><ShieldAlert size={14} /> {error}</div>}

            <div style={styles.queueBody}>
                {/* QUEUE LIST */}
                <div style={styles.queueListPanel}>
                    <h2 style={styles.queueTitle}>
                        Live Help Queue
                        <span style={styles.waitingBadge}>{queue.length} Waiting</span>
                    </h2>

                    {queue.length === 0 ? (
                        <div style={styles.emptyQueue}>
                            All clear! No students need intervention right now.
                        </div>
                    ) : (
                        <div style={styles.tableWrap}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={styles.tableHead}>
                                        <th style={styles.th}>Student</th>
                                        <th style={styles.th}>Task</th>
                                        <th style={styles.th}>Attempts</th>
                                        <th style={styles.th}>Time Stuck</th>
                                        <th style={styles.th}>Priority</th>
                                        <th style={{ ...styles.th, textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queue.map((item, i) => (
                                        <tr key={item.projectId} style={{ ...styles.tableRow, background: i === 0 ? 'rgba(248, 81, 73, 0.03)' : 'transparent' }}>
                                            <td style={styles.td}>
                                                <div style={styles.studentCell}>
                                                    <div style={styles.avatar}>{(item.studentName || 'S')[0].toUpperCase()}</div>
                                                    <span>{item.studentName || 'Student'}</span>
                                                    {item.helpRequested && <span style={styles.sosBadge}>SOS</span>}
                                                </div>
                                            </td>
                                            <td style={styles.td}>{item.currentTask}</td>
                                            <td style={styles.td}>
                                                <span style={styles.failBadge}>{item.attempts} Fails</span>
                                            </td>
                                            <td style={styles.tdMono}>{item.timeStuck}m</td>
                                            <td style={styles.td}>
                                                <span style={{ color: item.priority > 10 ? '#f85149' : '#f0883e', fontWeight: 700 }}>
                                                    #{Math.round(item.priority)}
                                                </span>
                                            </td>
                                            <td style={{ ...styles.td, textAlign: 'right' }}>
                                                <button
                                                    onClick={() => handleJoinSession(item)}
                                                    disabled={joining}
                                                    style={styles.joinBtn}
                                                >
                                                    {joining ? <Loader2 size={14} className="spin" /> : 'Join Session'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* PREVIEW PANEL */}
                <div style={styles.previewPanel}>
                    <h3 style={styles.previewTitle}>Quick Preview</h3>
                    {queue.length > 0 ? (
                        <>
                            <div style={styles.previewCard}>
                                <div style={styles.previewLabel}>TOP PRIORITY</div>
                                <div style={styles.previewStudentName}>{queue[0].studentName}</div>
                                <div style={styles.previewTaskName}>{queue[0].currentTask}</div>
                            </div>
                            <div style={styles.previewStats}>
                                <div style={styles.statBox}>
                                    <div style={styles.statLabel}>ATTEMPTS</div>
                                    <div style={styles.statVal}>{queue[0].attempts}</div>
                                </div>
                                <div style={styles.statBox}>
                                    <div style={styles.statLabel}>TIME STUCK</div>
                                    <div style={styles.statVal}>{queue[0].timeStuck}m</div>
                                </div>
                                <div style={styles.statBox}>
                                    <div style={styles.statLabel}>CHEAT SCORE</div>
                                    <div style={{ ...styles.statVal, color: queue[0].cheatScore > 50 ? '#f85149' : '#3fb950' }}>{queue[0].cheatScore}</div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleJoinSession(queue[0])}
                                disabled={joining}
                                style={styles.joinBtnLarge}
                            >
                                {joining ? <Loader2 size={16} className="spin" /> : <><Maximize2 size={14} /> Join Top Priority</>}
                            </button>
                        </>
                    ) : (
                        <div style={styles.previewEmpty}>Select a student from the queue to preview their session.</div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = {
    // Loading
    loadingScreen: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0d1117', color: '#8b949e', gap: 12, fontFamily: 'var(--sans)' },

    // Queue Page
    queuePage: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: 'var(--sans)' },
    queueTopBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: '#010409', borderBottom: '1px solid #21262d' },
    panelTitle: { fontWeight: 800, fontSize: 14, color: '#e6edf3', letterSpacing: '0.05em' },
    refreshBtn: { background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 4, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
    onlineBadge: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: '#161b22', padding: '6px 12px', borderRadius: 20 },
    onlineDot: { width: 8, height: 8, borderRadius: '50%', background: '#3fb950', boxShadow: '0 0 8px #3fb950' },
    errorBanner: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#842029', color: '#f8d7da', padding: '8px 16px', fontSize: 13, fontWeight: 600 },
    queueBody: { display: 'flex', flex: 1, padding: 24, gap: 24, minHeight: 0 },

    // Queue List
    queueListPanel: { flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    queueTitle: { margin: '0 0 24px', color: '#c9d1d9', fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 },
    waitingBadge: { background: 'rgba(248, 81, 73, 0.1)', color: '#ff7b72', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
    emptyQueue: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontSize: 14 },
    tableWrap: { background: '#0d1117', border: '1px solid #30363d', borderRadius: 8, overflow: 'auto', flex: 1 },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' },
    tableHead: { background: '#161b22', borderBottom: '1px solid #30363d', color: '#8b949e' },
    th: { padding: '12px 16px', fontWeight: 600 },
    tableRow: { borderBottom: '1px solid #21262d' },
    td: { padding: '14px 16px', color: '#c9d1d9' },
    tdMono: { padding: '14px 16px', color: '#d2a8ff', fontFamily: 'monospace' },
    studentCell: { display: 'flex', alignItems: 'center', gap: 10 },
    avatar: { width: 28, height: 28, borderRadius: '50%', background: '#58a6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0d1117', fontWeight: 800, fontSize: 12 },
    sosBadge: { background: '#f85149', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4 },
    failBadge: { background: 'rgba(248,81,73,0.1)', color: '#ff7b72', padding: '4px 8px', borderRadius: 4, fontWeight: 700 },
    joinBtn: { background: '#238636', color: 'white', border: 'none', borderRadius: 6, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(35, 134, 54, 0.3)' },

    // Preview Panel
    previewPanel: { width: 340, background: '#0d1117', border: '1px solid #30363d', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' },
    previewTitle: { margin: '0 0 20px', color: '#8b949e', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 },
    previewCard: { background: '#161b22', border: '1px solid #30363d', padding: 16, borderRadius: 8, marginBottom: 16 },
    previewLabel: { fontSize: 10, color: '#f0883e', fontWeight: 800, marginBottom: 8, letterSpacing: '0.1em' },
    previewStudentName: { fontSize: 16, fontWeight: 700, color: '#e6edf3', marginBottom: 4 },
    previewTaskName: { fontSize: 12, color: '#8b949e' },
    previewStats: { display: 'flex', gap: 12, marginBottom: 20 },
    statBox: { flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12, textAlign: 'center' },
    statLabel: { fontSize: 9, color: '#8b949e', fontWeight: 700, marginBottom: 4 },
    statVal: { fontSize: 20, fontWeight: 800, color: '#e6edf3' },
    joinBtnLarge: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px', background: '#238636', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 14 },
    previewEmpty: { color: '#484f58', fontSize: 13, textAlign: 'center', padding: 40 },

    // Session Page
    sessionPage: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0d1117', color: '#c9d1d9', fontFamily: 'var(--sans)' },
    sessionTopBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: '#010409', borderBottom: '1px solid #21262d' },
    leaveBtn: { background: 'transparent', border: '1px solid #30363d', color: '#8b949e', borderRadius: 4, padding: '6px 12px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
    separator: { width: 1, height: 20, background: '#30363d' },
    observingLabel: { fontSize: 14, color: '#e6edf3' },
    taskLabel: { fontSize: 12, color: '#8b949e', background: '#161b22', padding: '4px 10px', borderRadius: 4, fontFamily: 'var(--mono)' },
    liveBadge: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(248, 81, 73, 0.1)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(248, 81, 73, 0.2)' },
    liveDot: { width: 8, height: 8, borderRadius: '50%', background: '#ff7b72', animation: 'pulse 1.5s infinite' },

    sessionBody: { display: 'flex', flex: 1, minHeight: 0 },
    codePane: { flex: 1, borderRight: '1px solid #21262d', display: 'flex', flexDirection: 'column' },
    codePaneHeader: { padding: '8px 16px', background: '#161b22', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between' },
    fileName: { fontSize: 12, color: '#8b949e', fontFamily: 'var(--mono)' },
    readOnlyTag: { fontSize: 11, color: '#8b949e', background: '#0d1117', padding: '2px 8px', borderRadius: 4 },
    editorWrap: { flex: 1 },

    // Toolkit
    toolkitPane: { width: 380, background: '#0d1117', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    toolkitSection: { padding: '16px 20px', borderBottom: '1px solid #21262d' },
    sectionTitle: { margin: '0 0 12px', fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 },

    // Context Card
    contextCard: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 12 },
    contextRow: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #21262d' },
    contextLabel: { fontSize: 12, color: '#8b949e' },
    contextVal: { fontSize: 14, fontWeight: 700, color: '#e6edf3' },

    // Feedback
    feedbackBox: { background: 'rgba(248, 81, 73, 0.08)', border: '1px solid rgba(248, 81, 73, 0.2)', padding: 12, borderRadius: 8, fontSize: 12, color: '#ff7b72', fontFamily: 'var(--mono)', lineHeight: 1.5 },

    // Actions
    actionBtn: { display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', padding: '10px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 13, marginBottom: 8 },
    noteText: { fontSize: 10, color: '#484f58', marginTop: 4 },

    // Chat
    chatArea: { flex: 1, background: '#010409', border: '1px solid #30363d', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', minHeight: 120 },
    chatMsg: { display: 'flex', flexDirection: 'column', maxWidth: '90%' },
    chatRole: { fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#8b949e', marginBottom: 3 },
    chatBubble: { borderRadius: 8, padding: '8px 12px', fontSize: 12, lineHeight: 1.5, color: '#c9d1d9' },
    chatInputRow: { display: 'flex', gap: 8, marginTop: 12 },
    chatInputField: { flex: 1, background: '#161b22', border: '1px solid #30363d', borderRadius: 6, padding: '10px 12px', color: '#e6edf3', fontSize: 13, outline: 'none' },
    sendBtn: { background: '#58a6ff', color: '#0d1117', border: 'none', borderRadius: 6, padding: '0 16px', cursor: 'pointer', fontWeight: 700, fontSize: 13 },
};

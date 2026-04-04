import { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle, XCircle, AlertTriangle, Info, Shield, Zap, Eye, MessageSquare, Send } from 'lucide-react';

const MODE_CONFIG = {
    normal:     { color: '#3fb950', icon: Zap,    label: 'Normal Mode' },
    struggling: { color: '#f0883e', icon: Eye,    label: 'Struggling — Extra guidance active' },
    restricted: { color: '#f85149', icon: Shield, label: 'Restricted — Explain before proceeding' },
};

const FEEDBACK_ICONS = {
    success: { icon: CheckCircle, color: '#3fb950' },
    error:   { icon: XCircle,     color: '#f85149' },
    warn:    { icon: AlertTriangle, color: '#f0883e' },
    info:    { icon: Info,         color: '#58a6ff' },
};

export default function MentorPanel({ feedback = [], hint, level, passed, mentorMode = 'normal', courseCompleted, messages = [], onSendMessage, isPrimary }) {
    const [activeTab, setActiveTab] = useState('feedback'); // 'feedback' | 'chat'
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef(null);

    const mode = MODE_CONFIG[mentorMode] || MODE_CONFIG.normal;
    const ModeIcon = mode.icon;

    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, activeTab]);

    const handleSend = () => {
        if (!chatInput.trim()) return;
        onSendMessage(chatInput);
        setChatInput('');
    };

    if (courseCompleted) {
        return (
            <div style={styles.completedPanel}>
                <Zap size={48} style={{ color: '#f2cc60' }} />
                <h2 style={{ color: '#fff', margin: '16px 0 8px' }}>Course Completed!</h2>
                <p style={{ color: '#8b949e', textAlign: 'center', maxWidth: 300, fontSize: 14 }}>
                    Congratulations! You've successfully finished all tasks in this project.
                </p>
                <div style={styles.statsRow}>
                    <div style={styles.statBox}>
                        <CheckCircle size={16} color="#3fb950" />
                        <span>Ready for Next</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={styles.panel}>
            {/* Header / Tabs */}
            <div style={styles.tabContainer}>
                <button 
                    onClick={() => setActiveTab('feedback')} 
                    style={{ ...styles.tab, borderBottomColor: activeTab === 'feedback' ? '#58a6ff' : 'transparent', color: activeTab === 'feedback' ? '#c9d1d9' : '#8b949e' }}
                >
                    <Info size={14} /> Guided Feedback
                </button>
                <button 
                    onClick={() => setActiveTab('chat')} 
                    style={{ ...styles.tab, borderBottomColor: activeTab === 'chat' ? '#58a6ff' : 'transparent', color: activeTab === 'chat' ? '#c9d1d9' : '#8b949e' }}
                >
                    <MessageSquare size={14} /> Mentor Chat
                    {messages.length > 0 && <span style={styles.unreadDot} />}
                </button>
            </div>

            <div style={styles.content}>
                {activeTab === 'feedback' ? (
                    <div style={styles.feedbackList}>
                        {/* Mode Badge */}
                        <div style={{ ...styles.modeBadge, borderColor: mode.color }}>
                            <ModeIcon size={14} style={{ color: mode.color }} />
                            <span style={{ color: mode.color, fontSize: 11, fontWeight: 600 }}>{mode.label}</span>
                        </div>

                        {/* Task Completed Banner */}
                        {passed && (
                            <div style={styles.successBanner}>
                                <CheckCircle size={18} />
                                <span style={{ fontWeight: 700 }}>Task Completed! ✓</span>
                            </div>
                        )}

                        {/* Feedback Box */}
                        {feedback.length > 0 && (
                            <div style={styles.section}>
                                <h4 style={styles.sectionTitle}>Feedback</h4>
                                {feedback.map((item, i) => {
                                    const config = FEEDBACK_ICONS[item.type] || FEEDBACK_ICONS.info;
                                    const Icon = config.icon;
                                    return (
                                        <div key={i} style={{ ...styles.feedbackItem, borderLeftColor: config.color }}>
                                            <Icon size={14} style={{ color: config.color, flexShrink: 0, marginTop: 2 }} />
                                            <span style={{ fontSize: 13, color: '#c9d1d9', lineHeight: 1.5 }}>{item.message}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Hint Box */}
                        {hint && (
                            <div style={styles.section}>
                                <h4 style={styles.sectionTitle}>Hint (Level {level || '?'})</h4>
                                <div style={styles.hintBox}>
                                    <AlertCircle size={14} style={{ color: '#f0883e', flexShrink: 0, marginTop: 2 }} />
                                    <span style={{ fontSize: 13, color: '#e6edf3', lineHeight: 1.5 }}>{typeof hint === 'string' ? hint : hint?.hint || 'No hint available.'}</span>
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {feedback.length === 0 && !hint && !passed && (
                            <div style={styles.emptyState}>
                                <AlertCircle size={24} style={{ color: '#484f58' }} />
                                <p style={{ color: '#484f58', fontSize: 13 }}>Submit your code to receive feedback</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={styles.chatContainer}>
                        <div style={styles.messagesList}>
                            {messages.length === 0 && (
                                <div style={styles.emptyChat}>
                                    <MessageSquare size={32} style={{ color: '#21262d' }} />
                                    <p style={{ color: '#8b949e', fontSize: 13 }}>No messages yet. Ask your mentor for help!</p>
                                </div>
                            )}
                            {messages.map((msg, i) => (
                                <div key={i} style={{ ...styles.messageItem, alignSelf: msg.userId === 'me' ? 'flex-end' : 'flex-start' }}>
                                    <div style={{ ...styles.bubble, background: msg.userId === 'me' ? '#1f6feb' : '#21262d', color: '#fff' }}>
                                        {msg.text}
                                    </div>
                                    <span style={styles.messageTime}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                        <div style={styles.inputArea}>
                            <input 
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder="Message mentor..." 
                                style={styles.chatInput}
                                disabled={!isPrimary}
                            />
                            <button onClick={handleSend} style={styles.sendBtn} disabled={!isPrimary || !chatInput.trim()}>
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

const styles = {
    panel: { height: '100%', background: '#0d1117', display: 'flex', flexDirection: 'column' },
    tabContainer: { display: 'flex', gap: 2, padding: '0 12px', borderBottom: '1px solid #21262d', background: '#010409' },
    tab: { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '12px 16px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', transition: '0.2s' },
    unreadDot: { width: 6, height: 6, borderRadius: '50%', background: '#f2cc60' },
    
    content: { flex: 1, overflow: 'hidden' },
    feedbackList: { padding: 20, height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 },
    
    chatContainer: { height: '100%', display: 'flex', flexDirection: 'column' },
    messagesList: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
    emptyChat: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 },
    messageItem: { display: 'flex', flexDirection: 'column', maxWidth: '85%' },
    bubble: { padding: '8px 14px', borderRadius: '16px 16px 16px 4px', fontSize: 13, lineHeight: 1.5 },
    messageTime: { fontSize: 10, color: '#8b949e', marginTop: 4, marginLeft: 4 },
    
    inputArea: { padding: 12, borderTop: '1px solid #21262d', display: 'flex', gap: 8, background: '#010409' },
    chatInput: { flex: 1, background: '#0d1117', border: '1px solid #30363d', borderRadius: 20, padding: '8px 16px', color: '#c9d1d9', fontSize: 13 },
    sendBtn: { background: '#238636', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' },

    modeBadge: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: '#161b22', border: '1px solid', borderColor: '#3fb950' },
    successBanner: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 8, background: 'rgba(63, 185, 80, 0.15)', color: '#3fb950', fontSize: 14 },
    section: { display: 'flex', flexDirection: 'column', gap: 8 },
    sectionTitle: { fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 },
    feedbackItem: { display: 'flex', gap: 10, padding: '10px 12px', borderRadius: 6, background: '#161b22', borderLeft: '3px solid' },
    hintBox: { display: 'flex', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'rgba(240, 136, 62, 0.1)', border: '1px solid rgba(240, 136, 62, 0.2)' },
    emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 8, minHeight: 200 },
    completedPanel: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, background: '#0d1117', padding: 40 },
    statsRow: { display: 'flex', gap: 12, marginTop: 24 },
    statBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 20, background: '#161b22', border: '1px solid #238636', color: '#3fb950', fontSize: 12, fontWeight: 600 }
};

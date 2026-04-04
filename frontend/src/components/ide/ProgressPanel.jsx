import React from 'react';
import { 
    MapPin, Target, Zap, Shield, CheckCircle2, 
    Circle, Activity, ArrowRight, BrainCircuit,
    AlertTriangle, Flame, TrendingDown,
    XCircle, Info, Lock
} from 'lucide-react';

export default function ProgressPanel({ data, loading }) {
    if (loading) {
        return (
            <div style={{ padding: 20, color: '#8b949e', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={16} className="spin" /> Syncing Intelligence...
            </div>
        );
    }

    if (!data) return null;

    const { 
        currentFocus, timeline, skills, 
        errorMemory, behaviorMode, nextActionItems, 
        isStuck, stuckSuggestion 
    } = data;

    return (
        <div style={styles.container}>
            <style>{`
                @keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
                .blink { animation: blink 1.5s infinite; }
                .card-highlight { transition: all 0.2s; }
                .card-highlight:hover { border-color: #58a6ff60; background: #161b22; transform: translateY(-1px); }
            `}</style>

            {/* SECTION 1: CURRENT FOCUS (Control State) */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <MapPin size={14} color="#58a6ff" />
                    <span style={styles.sectionTitle}>CURRENT FOCUS</span>
                    {isStuck && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, color: '#f85149', fontSize: 9, fontWeight: 900 }} className="blink">
                            <AlertTriangle size={12} /> STUCK DETECTED
                        </div>
                    )}
                </div>
                <div style={{ ...styles.card, borderColor: isStuck ? '#f8514940' : '#30363d' }}>
                    <div style={styles.taskTitle}>{currentFocus.title}</div>
                    <div style={styles.missingList}>
                        {(currentFocus.missing || []).map((m, i) => (
                            <div key={i} style={styles.missingItem}>
                                <XCircle size={10} color="#f85149" />
                                <span>{m}</span>
                            </div>
                        ))}
                    </div>
                    {isStuck && stuckSuggestion && (
                        <div style={styles.stuckBox}>
                             <Info size={12} /> {stuckSuggestion}
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 2: NEXT ACTIONS (Atomic Steps) */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <Zap size={14} color="#f2cc60" />
                    <span style={styles.sectionTitle}>NEXT ACTIONS</span>
                </div>
                <div style={styles.nextCard}>
                    {(nextActionItems || []).map((step, i) => (
                        <div key={i} style={styles.nextStepItem}>
                            <div style={styles.stepNum}>{i + 1}</div>
                            <div style={styles.nextStepText}>{step}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION 3: TIMELINE (Unlock Roadmap) */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <Target size={14} color="#3fb950" />
                    <span style={styles.sectionTitle}>ROADMAP CONTROL</span>
                </div>
                <div style={styles.timeline}>
                    {timeline.map((m, i) => (
                        <div key={i} style={{ marginBottom: 12 }}>
                            <div style={styles.timelineItem}>
                                {m.status === 'completed' ? (
                                    <CheckCircle2 size={14} color="#3fb950" />
                                ) : m.status === 'locked' ? (
                                    <Lock size={14} color="#30363d" />
                                ) : (
                                    <Activity size={14} color="#f2cc60" />
                                )}
                                <span style={{ 
                                    ...styles.timelineText, 
                                    color: m.status === 'completed' ? '#e6edf3' : '#8b949e',
                                    fontWeight: m.status !== 'locked' ? 700 : 400
                                }}>
                                    {m.title}
                                </span>
                            </div>
                            {m.unlockConditions?.length > 0 && (
                                <div style={styles.conditionList}>
                                    {m.unlockConditions.map((c, ci) => (
                                        <div key={ci} style={styles.conditionItem}>
                                            <Circle size={8} color="#30363d" /> {c}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* SECTION 4: ERROR MEMORY (Pattern Awareness) */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <BrainCircuit size={14} color="#f85149" />
                    <span style={styles.sectionTitle}>ERROR MEMORY</span>
                </div>
                <div style={styles.errorGrid}>
                    {errorMemory.length > 0 ? errorMemory.map((err, i) => (
                        <div key={i} style={styles.errorItem}>
                            <XCircle size={10} color="#f8514980" /> {err}
                        </div>
                    )) : <div style={styles.emptyText}>No recurring patterns detected.</div>}
                </div>
            </div>

            {/* SECTION 5: BEHAVIORS (Intervention) */}
            <div style={styles.section}>
                <div style={styles.sectionHeader}>
                    <Shield size={14} color="#3fb950" />
                    <span style={styles.sectionTitle}>LEARNING DIRECTIVE</span>
                </div>
                <div style={{ ...styles.card, borderLeft: `4px solid #3fb950`, background: '#3fb95008' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#3fb950', marginBottom: 4 }}>
                        MODE: {behaviorMode.status.toUpperCase()}
                    </div>
                    <div style={styles.directiveText}>
                        <ArrowRight size={14} /> {behaviorMode.directive}
                    </div>
                </div>
            </div>

            {/* SECTION 6: SKILLS (Actionable Feed) */}
            <div style={{ ...styles.section, marginBottom: 40 }}>
                <div style={styles.sectionHeader}>
                    <Zap size={14} color="#a371f7" />
                    <span style={styles.sectionTitle}>SKILL ACTIONS</span>
                </div>
                <div style={styles.skillGrid}>
                    {skills.map((s, i) => (
                        <div key={i} className="card-highlight" style={styles.skillCard}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={styles.skillName}>{s.name}</span>
                                <span style={{ 
                                    fontSize: 9, fontWeight: 700,
                                    color: s.level === 'Strong' ? '#3fb950' : s.level === 'Medium' ? '#f2cc60' : '#f85149'
                                }}>{s.level}</span>
                            </div>
                            <div style={styles.skillAction}>{s.action}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: { padding: '16px 20px', overflowY: 'auto', flex: 1, background: '#0d1117', fontFamily: 'var(--sans)' },
    section: { marginBottom: 24 },
    sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { fontSize: 10, fontWeight: 800, color: '#8b949e', letterSpacing: '0.05em' },
    card: { background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 14 },
    taskTitle: { fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 8 },
    missingList: { display: 'flex', flexDirection: 'column', gap: 6 },
    missingItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#f85149cc' },
    stuckBox: { marginTop: 12, padding: '8px 12px', background: '#f8514910', border: '1px solid #f8514930', borderRadius: 6, fontSize: 11, color: '#f85149', display: 'flex', gap: 8, lineHeight: 1.4 },
    nextCard: { background: '#f2cc6008', border: '1px solid #f2cc6020', borderRadius: 8, padding: '14px 16px' },
    nextStepItem: { display: 'flex', gap: 12, marginBottom: 8 },
    stepNum: { width: 16, height: 16, borderRadius: 4, background: '#f2cc6020', color: '#f2cc60', fontSize: 9, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    nextStepText: { fontSize: 12, color: '#e6edf3', fontWeight: 500 },
    timeline: { paddingLeft: 4 },
    timelineItem: { display: 'flex', alignItems: 'center', gap: 12 },
    timelineText: { fontSize: 12 },
    conditionList: { paddingLeft: 26, marginTop: 4, borderLeft: '1px solid #30363d', marginLeft: 6 },
    conditionItem: { fontSize: 10, color: '#484f58', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
    errorGrid: { display: 'flex', flexDirection: 'column', gap: 6 },
    errorItem: { background: '#f8514908', border: '1px solid #f8514915', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#f85149cc', display: 'flex', alignItems: 'center', gap: 8 },
    directiveText: { fontSize: 12, color: '#e6edf3', fontWeight: 600, display: 'flex', gap: 8, marginTop: 4, lineHeight: 1.4 },
    skillGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
    skillCard: { background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: '10px 12px' },
    skillName: { fontSize: 11, fontWeight: 700, color: '#8b949e' },
    skillAction: { fontSize: 11, color: '#e6edf3', fontStyle: 'italic', marginTop: 2 },
    emptyText: { fontSize: 11, color: '#484f58', fontStyle: 'italic' }
};

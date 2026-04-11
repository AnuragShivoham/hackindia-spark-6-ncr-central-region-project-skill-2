import React from 'react';
import { 
    MapPin, Target, Zap, Shield, CheckCircle2, 
    Circle, Activity, ArrowRight, BrainCircuit,
    AlertTriangle, Flame, TrendingDown,
    XCircle, Info, Lock
} from 'lucide-react';

export default function ProgressPanel({ data, loading, onToggleSOS }) {
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
        isStuck, stuckSuggestion, mentor_hint 
    } = data;

    const [mentors, setMentors] = React.useState([]);
    const [selectedMentor, setSelectedMentor] = React.useState(null);
    const [loadingMentors, setLoadingMentors] = React.useState(false);

    React.useEffect(() => {
        const fetchMentors = async () => {
            try {
                setLoadingMentors(true);
                const res = await fetch('/api/v1/mentors', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('ab_token')}` }
                });
                const d = await res.json();
                setMentors(d);
            } catch(e) {} finally { setLoadingMentors(false); }
        };
        fetchMentors();
    }, []);

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

                    {mentor_hint && (
                        <div style={{
                            marginTop: 8,
                            padding: '10px 12px',
                            background: 'rgba(129,73,248,0.1)',
                            border: '1px solid rgba(129,73,248,0.3)',
                            borderRadius: 6,
                            color: '#e6edf3'
                        }}>
                             <div style={{ fontSize: 9, fontWeight: 900, color: '#8149f8', marginBottom: 4 }}>
                                 <Zap size={10} fill="#8149f8" /> HUMAN MENTOR GUIDANCE
                             </div>
                             <div style={{ fontSize: 13, lineHeight: 1.4 }}>{mentor_hint}</div>
                        </div>
                    )}
                    {mentors.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                            <div style={{ fontSize: 10, fontWeight: 900, color: '#8b949e', marginBottom: 6 }}>SELECT PREFERRED MENTOR (OPTIONAL)</div>
                            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                                <div 
                                    onClick={() => setSelectedMentor(null)}
                                    style={{ 
                                        flexShrink: 0, padding: '6px 10px', borderRadius: 6, border: '1px solid #30363d', 
                                        background: !selectedMentor ? '#21262d' : 'transparent', cursor: 'pointer',
                                        fontSize: 11, fontWeight: 700, color: !selectedMentor ? '#58a6ff' : '#8b949e'
                                    }}
                                >
                                    AUTO
                                </div>
                                {mentors.map(m => (
                                    <div 
                                        key={m.id}
                                        onClick={() => setSelectedMentor(m.id)}
                                        style={{ 
                                            flexShrink: 0, padding: '6px 10px', borderRadius: 6, border: selectedMentor === m.id ? '1px solid #58a6ff' : '1px solid #30363d', 
                                            background: selectedMentor === m.id ? 'rgba(88,166,255,0.1)' : 'transparent', cursor: 'pointer',
                                            fontSize: 11, fontWeight: 700, color: selectedMentor === m.id ? '#58a6ff' : '#e6edf3'
                                        }}
                                    >
                                        {m.name}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button 
                        onClick={() => onToggleSOS && onToggleSOS(selectedMentor)}
                        style={{
                            marginTop: 12,
                            background: isStuck ? '#f85149' : '#238636',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            padding: '10px',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            boxShadow: isStuck ? '0 4px 12px rgba(248,81,73,0.3)' : '0 4px 12px rgba(35,134,54,0.2)',
                            width: '100%',
                            transition: 'all 0.2s'
                        }}
                    >
                        <Flame size={16} className={isStuck ? 'blink' : ''} /> 
                        {isStuck ? 'REQUEST FOR MENTOR SOS' : 'REQUEST FOR MENTOR'}
                    </button>
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

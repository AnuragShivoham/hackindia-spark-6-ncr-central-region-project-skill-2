import { Play, Lightbulb, MessageCircle, Loader2 } from 'lucide-react';

export default function ActionBar({ onRunCode, onHint, onExplain, onPushPreview, loading, passed, courseCompleted, onBack, isPrimary = true, userRole = 'student' }) {
    if (courseCompleted) {
        return (
            <div style={styles.bar}>
                <button
                    onClick={onBack}
                    style={{ ...styles.btn, ...styles.runBtn, width: '100%', justifyContent: 'center', py: 12 }}
                >
                    <Play size={14} style={{ transform: 'rotate(180deg)' }} />
                    <span>Return to Marketplace</span>
                </button>
            </div>
        );
    }

    const disabled = loading || passed || !isPrimary;

    // Mentor View (Controller)
    if (userRole === 'mentor') {
        return (
            <div style={styles.bar}>
                <button
                    onClick={onPushPreview}
                    disabled={disabled}
                    style={{ ...styles.btn, background: '#8957e5', color: '#fff', opacity: disabled ? 0.5 : 1 }}
                >
                    <Lightbulb size={14} />
                    <span>Push Code Suggestion</span>
                </button>
                <div style={styles.flexSpacer} />
                <span style={{ fontSize: 11, color: '#8b949e', alignSelf: 'center', marginRight: 12 }}>
                    Mentors cannot submit task execution logs.
                </span>
            </div>
        );
    }

    // Student View (Executor)
    return (
        <div style={styles.bar}>
            <button
                onClick={onRunCode}
                disabled={disabled}
                style={{ ...styles.btn, ...styles.runBtn, opacity: disabled ? 0.5 : 1 }}
            >
                {loading ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
                <span>{loading ? 'Evaluating...' : passed ? 'Completed' : 'Run Code'}</span>
            </button>

            <button
                onClick={onHint}
                disabled={disabled}
                style={{ ...styles.btn, ...styles.hintBtn, opacity: disabled ? 0.5 : 1 }}
            >
                <Lightbulb size={14} />
                <span>Show Hint</span>
            </button>

            <button
                onClick={onExplain}
                disabled={disabled}
                style={{ ...styles.btn, ...styles.explainBtn, opacity: disabled ? 0.5 : 1 }}
            >
                <MessageCircle size={14} />
                <span>Explain My Approach</span>
            </button>
        </div>
    );
}

const styles = {
    bar: { display: 'flex', gap: 8, padding: '8px 16px', background: '#010409', borderTop: '1px solid #21262d', borderBottom: '1px solid #21262d' },
    btn: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'var(--sans)', transition: 'all 0.15s' },
    runBtn: { background: '#238636', color: '#fff' },
    hintBtn: { background: '#1f2937', color: '#f0883e', border: '1px solid #f0883e44' },
    explainBtn: { background: '#1f2937', color: '#58a6ff', border: '1px solid #58a6ff44' },
    flexSpacer: { flex: 1 }
};

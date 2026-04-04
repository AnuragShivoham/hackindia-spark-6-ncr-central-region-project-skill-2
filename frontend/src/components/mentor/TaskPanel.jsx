import { File, CheckCircle, XCircle, Clock, CheckSquare } from 'lucide-react';

export default function TaskPanel({ task, project }) {
    if (!task) return (
        <div style={styles.empty}>
            <Clock size={32} style={{ color: '#484f58' }} />
            <p>Loading task...</p>
        </div>
    );

    return (
        <div style={styles.panel}>
            <div style={styles.header}>
                <div style={styles.badge}>{task.status === 'completed' ? <CheckCircle size={14} /> : <XCircle size={14} />}</div>
                <h3 style={styles.title}>{task.title}</h3>
            </div>

            <p style={styles.description}>{task.description}</p>

            {task.expected && (
                <div style={styles.section}>
                    <h4 style={styles.sectionTitle}><CheckSquare size={12} style={{marginRight: 4}}/>Expected Output</h4>
                    <div style={styles.checklist}>
                        <div style={styles.checkItem}>
                            <span style={styles.checkText}>{task.expected}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    panel: { padding: 20, height: '100%', overflowY: 'auto', background: '#0d1117' },
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#484f58', gap: 8 },
    header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 },
    badge: { color: '#3fb950' },
    title: { fontSize: 16, fontWeight: 700, color: '#e6edf3', margin: 0 },
    description: { fontSize: 13, color: '#c9d1d9', lineHeight: 1.6, marginBottom: 16 },
    section: { marginBottom: 16, background: '#161b22', padding: 12, borderRadius: 8, border: '1px solid #30363d' },
    sectionTitle: { display: 'flex', alignItems: 'center', fontSize: 11, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 },
    checklist: { display: 'flex', flexDirection: 'column', gap: 8 },
    checkItem: { display: 'flex', alignItems: 'flex-start', gap: 8 },
    checkText: { fontSize: 13, color: '#e6edf3', lineHeight: 1.5, fontFamily: 'var(--mono)' }
};

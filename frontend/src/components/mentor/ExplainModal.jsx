import { useState } from 'react';
import { X, Send, AlertCircle } from 'lucide-react';

export default function ExplainModal({ onSubmit, onClose, loading }) {
    const [text, setText] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        const trimmed = text.trim();
        const words = trimmed.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const uniqueWords = new Set(words);
        
        if (trimmed.length < 15 || uniqueWords.size < 3) {
            setError('Please provide a more detailed explanation (min 15 chars, 3+ unique words).');
            return;
        }
        setError('');
        onSubmit(trimmed);
    };

    return (
        <div style={styles.overlay} onClick={onClose}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
                <div style={styles.header}>
                    <h3 style={styles.title}>Explain Your Approach</h3>
                    <button onClick={onClose} style={styles.closeBtn}><X size={16} /></button>
                </div>

                <p style={styles.hint}>Describe your thought process. What concept are you applying? Why did you choose this approach?</p>

                <textarea
                    value={text}
                    onChange={e => { setText(e.target.value); setError(''); }}
                    placeholder="I'm using the Express router because..."
                    style={styles.textarea}
                    rows={6}
                    autoFocus
                />

                <div style={styles.footer}>
                    <span style={styles.charCount}>{text.length} chars {text.length < 10 && '(min 10)'}</span>
                    
                    {error && (
                        <span style={styles.error}>
                            <AlertCircle size={12} /> {error}
                        </span>
                    )}

                    <button
                        onClick={handleSubmit}
                        disabled={loading || text.trim().length < 10}
                        style={{ ...styles.submitBtn, opacity: (loading || text.trim().length < 10) ? 0.5 : 1 }}
                    >
                        <Send size={12} /> Submit Explanation
                    </button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modal: { background: '#161b22', borderRadius: 12, border: '1px solid #21262d', width: 520, maxWidth: '90vw', padding: 0, overflow: 'hidden' },
    header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #21262d' },
    title: { fontSize: 15, fontWeight: 700, color: '#e6edf3', margin: 0 },
    closeBtn: { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer' },
    hint: { fontSize: 12, color: '#8b949e', padding: '12px 20px 0', margin: 0, lineHeight: 1.5 },
    textarea: { width: '100%', boxSizing: 'border-box', margin: 0, padding: '12px 20px', border: 'none', borderTop: '1px solid #21262d', borderBottom: '1px solid #21262d', background: '#0d1117', color: '#e6edf3', fontSize: 13, fontFamily: 'var(--mono)', resize: 'vertical', outline: 'none' },
    footer: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px' },
    charCount: { fontSize: 11, color: '#484f58', fontFamily: 'var(--mono)' },
    error: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f85149', flex: 1 },
    submitBtn: { marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6, border: 'none', background: '#238636', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }
};

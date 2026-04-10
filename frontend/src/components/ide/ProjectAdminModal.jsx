import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../../api/client';

export default function ProjectAdminModal({ project, onClose, onUpdate }) {
    const [difficulty, setDifficulty] = useState(project?.skill_level || 'beginner');
    const [deadline, setDeadline] = useState(project?.deadline_days || 7);
    const [features, setFeatures] = useState([]);
    const [newFeature, setNewFeature] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (project?.deliverables) {
            try {
                setFeatures(typeof project.deliverables === 'string' ? JSON.parse(project.deliverables) : project.deliverables);
            } catch (e) {
                setFeatures([]);
            }
        }
    }, [project]);

    const handleSaveCore = async () => {
        setLoading(true);
        try {
            if (difficulty !== project.skill_level) await api.adjustPlan(project.id, 'difficulty', difficulty);
            if (deadline !== project.deadline_days) await api.adjustPlan(project.id, 'time', deadline);
            onUpdate();
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    const handleAddFeature = async () => {
        if (!newFeature.trim()) return;
        setLoading(true);
        try {
            await api.adjustPlan(project.id, 'add_feature', newFeature);
            setFeatures(prev => [...prev, newFeature]);
            setNewFeature('');
            onUpdate();
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const handleRemoveFeature = async (f) => {
        setLoading(true);
        try {
            await api.adjustPlan(project.id, 'remove_feature', f);
            setFeatures(prev => prev.filter(feat => feat !== f));
            onUpdate();
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <div style={styles.header}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldCheck size={20} color="#58a6ff" />
                        <h2 style={{ margin: 0, fontSize: 16, color: '#e6edf3' }}>Project Administration</h2>
                    </div>
                    <button onClick={onClose} style={styles.closeBtn}><X size={18} /></button>
                </div>
                
                <div style={styles.body}>
                    {/* CORE SETTINGS */}
                    <div style={styles.section}>
                        <div style={styles.sectionTitle}>CORE SETTINGS</div>
                        <div style={styles.grid}>
                            <div>
                                <label style={styles.label}>Skill Level (Difficulty)</label>
                                <select 
                                    style={styles.input} 
                                    value={difficulty} 
                                    onChange={e => setDifficulty(e.target.value)}
                                >
                                    <option value="beginner">Beginner</option>
                                    <option value="intermediate">Intermediate</option>
                                    <option value="advanced">Advanced</option>
                                    <option value="expert">Expert</option>
                                </select>
                            </div>
                            <div>
                                <label style={styles.label}>Deadline (Days)</label>
                                <input 
                                    type="number" 
                                    style={styles.input} 
                                    value={deadline} 
                                    onChange={e => setDeadline(Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <button onClick={handleSaveCore} disabled={loading} style={styles.saveBtn}>
                            <Save size={14} /> Update Core Settings
                        </button>
                    </div>

                    {/* FEATURES MANAGEMENT */}
                    <div style={styles.section}>
                        <div style={styles.sectionTitle}>DELIVERABLES & FEATURES</div>
                        <div style={{ background: '#010409', border: '1px solid #30363d', borderRadius: 6, padding: 8, marginBottom: 12 }}>
                            {features.length === 0 ? <div style={{ fontSize: 12, color: '#8b949e', padding: 8 }}>No custom features defined.</div> : null}
                            {features.map((f, i) => (
                                <div key={i} style={styles.featureItem}>
                                    <div style={{ fontSize: 13, color: '#c9d1d9' }}>{f}</div>
                                    <button disabled={loading} onClick={() => handleRemoveFeature(f)} style={styles.iconBtn}><Trash2 size={14} color="#f85149" /></button>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input 
                                style={{ ...styles.input, flex: 1, marginBottom: 0 }} 
                                placeholder="E.g. OAuth2 Login, Stripe Payments, Websockets..." 
                                value={newFeature}
                                onChange={e => setNewFeature(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddFeature()}
                            />
                            <button disabled={loading} onClick={handleAddFeature} style={styles.addBtn}>
                                <Plus size={14} /> Add Feature
                            </button>
                        </div>
                        <div style={{ fontSize: 10, color: '#8b949e', marginTop: 6 }}>Adding or removing features will automatically recalibrate your Project Milestones.</div>
                    </div>

                    {/* EXTENSIONS MARKETPLACE */}
                    <div style={styles.section}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                            <Zap size={16} color="#f2cc60" />
                            <div style={styles.sectionTitle}>EXTENSIONS & INTEGRATIONS</div>
                        </div>
                        <div style={styles.featureItem}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>Model Context Protocol (MCP)</div>
                                <div style={{ fontSize: 11, color: '#8b949e' }}>Allow AI to autonomously fetch docs, query databases, and read GitHub.</div>
                            </div>
                            <span style={{ fontSize: 10, background: '#238636', color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>AVAILABLE IN EXTENSION HUB</span>
                        </div>
                        <div style={styles.featureItem}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#e6edf3' }}>Blackbox Workflow Agent</div>
                                <div style={{ fontSize: 11, color: '#8b949e' }}>Mass file-editing and autonomous terminal control.</div>
                            </div>
                            <span style={{ fontSize: 10, background: '#238636', color: 'white', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>AVAILABLE IN EXTENSION HUB</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
    },
    modal: {
        width: 600, background: '#0d1117', border: '1px solid #30363d', borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden'
    },
    header: {
        padding: '16px 20px', borderBottom: '1px solid #21262d', background: '#161b22',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
    },
    closeBtn: {
        background: 'transparent', border: 'none', color: '#8b949e', cursor: 'pointer', padding: 4
    },
    body: {
        padding: 20, maxHeight: '80vh', overflowY: 'auto'
    },
    section: {
        marginBottom: 24, background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: 16
    },
    sectionTitle: {
        fontSize: 11, fontWeight: 800, color: '#8b949e', letterSpacing: '0.05em', marginBottom: 12
    },
    grid: {
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16
    },
    label: {
        display: 'block', fontSize: 12, fontWeight: 600, color: '#c9d1d9', marginBottom: 6
    },
    input: {
        width: '100%', background: '#010409', border: '1px solid #30363d', color: '#e6edf3',
        padding: '8px 12px', borderRadius: 6, fontSize: 13, outline: 'none'
    },
    saveBtn: {
        background: '#21262d', color: '#e6edf3', border: '1px solid #30363d', padding: '8px 16px',
        borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
    },
    addBtn: {
        background: '#238636', color: 'white', border: '1px solid #2ea043', padding: '0 16px',
        borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
    },
    featureItem: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px',
        borderBottom: '1px solid #21262d', background: '#0d1117'
    },
    iconBtn: {
        background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }
};

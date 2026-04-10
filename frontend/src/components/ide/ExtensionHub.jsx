import React, { useState } from 'react';
import { 
    Puzzle, Monitor, Globe, BrainCircuit, 
    Settings, Coffee, Binary, BarChart3,
    Zap, ExternalLink, ShieldCheck, Power
} from 'lucide-react';

import { api } from '../../api/client';

export default function ExtensionHub({ currentStack, onToggleExtension }) {
    const [extensions, setExtensions] = useState([
        { 
            id: 'live-server', 
            name: 'Web Preview (Live Server)', 
            desc: 'Real-time rendering for HTML/CSS/React projects.',
            icon: <Monitor size={18} color="#58a6ff" />,
            enabled: true,
            type: 'core'
        },
        { 
            id: 'java-runtime', 
            name: 'Java Language Support', 
            desc: 'Advanced type checking and JVM execution logic.',
            icon: <Coffee size={18} color="#f2cc60" />,
            enabled: currentStack?.includes('java'),
            type: 'lang'
        },
        { 
            id: 'python-ds', 
            name: 'Data Science Intelligence', 
            desc: 'Support for Pandas, NumPy, and Matplotlib.',
            icon: <BarChart3 size={18} color="#3fb950" />,
            enabled: currentStack?.includes('python'),
            type: 'lang'
        },
        { 
            id: 'blackbox-agent', 
            name: 'Blackbox AI Agent', 
            desc: 'Autonomous multi-file editing and terminal control.',
            icon: <BrainCircuit size={18} color="#a371f7" />,
            enabled: true,
            type: 'agent'
        },
        { 
            id: 'mcp-server', 
            name: 'MCP Connector', 
            desc: 'Bridge to Model Context Protocol tool servers.',
            icon: <Zap size={18} color="#f2cc60" />,
            enabled: false,
            type: 'system'
        }
    ]);

    useEffect(() => {
        const fetchPublicExts = async () => {
            try {
                const publicExts = await api.getPublicExtensions();
                const mappedExts = publicExts.map(pe => ({
                    id: pe.id,
                    name: pe.name,
                    desc: pe.description,
                    icon: pe.type === 'agent' ? <BrainCircuit size={18} color="#a371f7" /> : 
                          pe.type === 'mcp' ? <Zap size={18} color="#f2cc60" /> : <Globe size={18} color="#3fb950" />,
                    enabled: false,
                    type: pe.type,
                    command: pe.command
                }));
                // Merge without duplicating existing mock IDs
                setExtensions(prev => {
                    const existingIds = new Set(prev.map(p => p.id));
                    const newExts = mappedExts.filter(m => !existingIds.has(m.id));
                    return [...prev, ...newExts];
                });
            } catch(e) { console.error('Failed to load public extensions', e); }
        };
        fetchPublicExts();
    }, []);

    const toggle = (id) => {
        setExtensions(prev => prev.map(ext => {
            if (ext.id === id) {
                const newState = !ext.enabled;
                onToggleExtension?.(id, newState);
                return { ...ext, enabled: newState };
            }
            return ext;
        }));
    };

    return (
        <div style={styles.container}>
            <div style={styles.header}>
                <Puzzle size={16} color="#8b949e" />
                <span style={styles.title}>EXTENSION HUB</span>
            </div>
            
            <div style={styles.grid}>
                {extensions.map(ext => (
                    <div key={ext.id} style={{
                        ...styles.card,
                        borderLeft: `4px solid ${ext.enabled ? (ext.color || '#3fb950') : '#30363d'}`
                    }}>
                        <div style={styles.cardMain}>
                            <div style={styles.iconBox}>{ext.icon}</div>
                            <div style={styles.info}>
                                <div style={styles.extName}>{ext.name}</div>
                                <div style={styles.extDesc}>{ext.desc}</div>
                            </div>
                        </div>
                        <div style={styles.actions}>
                            <div 
                                onClick={() => toggle(ext.id)}
                                style={{
                                    ...styles.statusBadge,
                                    background: ext.enabled ? '#3fb95020' : '#f8514920',
                                    color: ext.enabled ? '#3fb950' : '#f85149'
                                }}
                            >
                                <Power size={10} /> {ext.enabled ? 'ACTIVE' : 'DISABLED'}
                            </div>
                            <span style={styles.typeTag}>{ext.type.toUpperCase()}</span>
                        </div>
                        
                        {/* Interactive Extension Panels */}
                        {ext.enabled && ext.id === 'mcp-server' && (
                            <div style={{ marginTop: 12, padding: 10, background: '#0d1117', borderRadius: 6, border: '1px solid #30363d', fontSize: 11 }}>
                                <div style={{ color: '#e6edf3', marginBottom: 8, fontWeight: 700 }}>Connected MCP Servers</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e', marginBottom: 4 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950' }} />
                                    sqlite (Database schema & querying)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#8b949e', marginBottom: 12 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#3fb950' }} />
                                    brave-search (Web access)
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <input placeholder="npx @modelcontextprotocol..." style={{ flex: 1, background: '#010409', border: '1px solid #30363d', color: '#e6edf3', padding: '6px 8px', borderRadius: 4, fontSize: 10, outline: 'none' }} />
                                    <button style={{ background: '#238636', color: 'white', border: 'none', padding: '0 12px', borderRadius: 4, fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>ADD</button>
                                </div>
                                <div style={{ marginTop: 8, color: '#58a6ff', fontStyle: 'italic', fontSize: 10 }}>Tip: Ask the AI Mentor to use these tools natively in the chat!</div>
                            </div>
                        )}

                        {ext.enabled && ext.id === 'live-server' && (
                            <div style={{ marginTop: 12, padding: 8, background: '#0d1117', borderRadius: 6, border: '1px solid #30363d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, color: '#8b949e' }}>Preview is mapped to the RUN button.</span>
                                <button style={{ background: '#1f6feb', color: 'white', border: 'none', padding: '4px 10px', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>Docs</button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <div style={styles.footer}>
                <Settings size={12} /> Extension Marketplace Coming Soon
            </div>
        </div>
    );
}

const styles = {
    container: { padding: 16, background: '#0d1117', height: '100%', overflowY: 'auto' },
    header: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
    title: { fontSize: 11, fontWeight: 800, color: '#8b949e', letterSpacing: '0.05em' },
    grid: { display: 'flex', flexDirection: 'column', gap: 12 },
    card: { 
        background: '#161b22', 
        border: '1px solid #30363d', 
        borderRadius: 8, 
        padding: 12,
        transition: 'all 0.2s'
    },
    cardMain: { display: 'flex', gap: 12, marginBottom: 12 },
    iconBox: { width: 36, height: 36, borderRadius: 8, background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    info: { flex: 1 },
    extName: { fontSize: 13, fontWeight: 700, color: '#e6edf3', marginBottom: 2 },
    extDesc: { fontSize: 11, color: '#8b949e', lineHeight: 1.4 },
    actions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #30363d' },
    statusBadge: { display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 900, cursor: 'pointer' },
    typeTag: { fontSize: 9, fontWeight: 700, color: '#484f58' },
    footer: { marginTop: 24, fontSize: 10, color: '#484f58', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }
};

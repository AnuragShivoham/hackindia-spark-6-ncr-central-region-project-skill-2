import React, { useState, useEffect } from 'react';
import {
    ShieldAlert, Plus, Trash2, Power, PowerOff, Zap, Users, BarChart3,
    Settings, Save, ToggleLeft, ToggleRight, Puzzle, Globe, UserCog,
    AlertTriangle, CheckCircle, ChevronDown, ChevronRight, Shield
} from 'lucide-react';
import { api } from '../api/client';
import { useStore } from '../store';

const TABS = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'features', label: 'App Features', icon: <Settings size={16} /> },
    { id: 'extensions', label: 'Extensions', icon: <Puzzle size={16} /> },
    { id: 'users', label: 'User Management', icon: <Users size={16} /> },
];

const DEFAULT_FEATURES = {
    paste_protection: true,
    paste_protection_desc: 'Block code pasting in the editor to enforce typing practice',
    ai_mentor_enabled: true,
    ai_mentor_desc: 'AI-powered guidance chat in the IDE',
    live_preview: true,
    live_preview_desc: 'Real-time HTML preview panel',
    terminal_enabled: true,
    terminal_desc: 'Integrated terminal with WebSocket PTY',
    git_integration: true,
    git_integration_desc: 'Git clone, push, and version control from the IDE',
    local_sync: true,
    local_sync_desc: 'File System Access API to save files to local disk',
    marketplace_enabled: true,
    marketplace_desc: 'Community project marketplace for browsing and enrolling',
    course_builder: true,
    course_builder_desc: 'Mentor course creation and publishing system',
    behavior_tracking: true,
    behavior_tracking_desc: 'Monitor paste scores and typing patterns for cheating detection',
    mcp_tools: true,
    mcp_tools_desc: 'Model Context Protocol autonomous tool use via chat',
    zip_download: true,
    zip_download_desc: 'Download full workspace as a ZIP archive',
    max_hint_requests: 3,
    max_hint_requests_desc: 'Maximum hint requests per task',
    qa_pass_score: 70,
    qa_pass_score_desc: 'Minimum QA review score to pass a task (0-100)',
    max_sos_requests: 2,
    max_sos_requests_desc: 'Maximum student SOS requests per task',
    platform_name: 'AMIT-BODHIT',
    platform_tagline: 'AI Development Hub',
};

export default function AdminPage() {
    const { role } = useStore();
    const [activeTab, setActiveTab] = useState('overview');
    const [extensions, setExtensions] = useState([]);
    const [newExt, setNewExt] = useState({ name: '', type: 'tool', description: '', command: '' });
    const [settings, setSettings] = useState({ ...DEFAULT_FEATURES });
    const [stats, setStats] = useState({});
    const [users, setUsers] = useState([]);
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState('');

    const loadAll = async () => {
        try {
            const [exts, s, st, u] = await Promise.all([
                api.adminGetExtensions(),
                api.adminGetSettings(),
                api.adminGetStats(),
                api.adminGetUsers(),
            ]);
            setExtensions(exts);
            setSettings(prev => ({ ...prev, ...s }));
            setStats(st);
            setUsers(u);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { loadAll(); }, []);

    const handleSaveSettings = async () => {
        setSaving(true);
        try {
            await api.adminUpdateSettings(settings);
            setSaveMsg('Settings saved!');
            setTimeout(() => setSaveMsg(''), 3000);
        } catch (e) { alert(e.message); }
        setSaving(false);
    };

    const handleAddExt = async () => {
        if (!newExt.name) return;
        try {
            await api.adminAddExtension(newExt);
            setNewExt({ name: '', type: 'tool', description: '', command: '' });
            loadAll();
        } catch (e) { alert(e.message); }
    };

    const handleToggleExt = async (id, cur) => {
        await api.adminToggleExtension(id, !cur);
        loadAll();
    };

    const handleDeleteExt = async (id) => {
        if (!window.confirm('Remove this extension globally?')) return;
        await api.adminDeleteExtension(id);
        loadAll();
    };

    const handleRoleChange = async (userId, newRole) => {
        if (!window.confirm(`Change this user's role to "${newRole}"?`)) return;
        await api.adminUpdateUserRole(userId, newRole);
        loadAll();
    };

    const toggleFeature = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    const setFeatureVal = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

    if (role !== 'admin') {
        return <div style={{ padding: 60, color: '#f85149', textAlign: 'center', fontSize: 18 }}><AlertTriangle size={32} style={{ marginBottom: 12 }} /><br />ACCESS DENIED — Admin Only</div>;
    }

    return (
        <div style={{ display: 'flex', minHeight: 'calc(100vh - 50px)', background: '#010409' }}>
            {/* SIDEBAR */}
            <div style={{ width: 220, background: '#0d1117', borderRight: '1px solid #21262d', padding: '24px 0' }}>
                <div style={{ padding: '0 16px 20px', borderBottom: '1px solid #21262d', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ShieldAlert size={20} color="#f85149" />
                        <span style={{ fontWeight: 800, fontSize: 14, color: '#e6edf3' }}>ADMIN PANEL</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#8b949e', marginTop: 4 }}>Platform Control Center</div>
                </div>
                {TABS.map(tab => (
                    <div
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: 13, fontWeight: 600, margin: '2px 8px', borderRadius: 6,
                            background: activeTab === tab.id ? 'rgba(88,166,255,0.1)' : 'transparent',
                            color: activeTab === tab.id ? '#58a6ff' : '#8b949e',
                            borderLeft: activeTab === tab.id ? '3px solid #58a6ff' : '3px solid transparent',
                        }}
                    >
                        {tab.icon} {tab.label}
                    </div>
                ))}
            </div>

            {/* MAIN CONTENT */}
            <div style={{ flex: 1, padding: 32, overflowY: 'auto', maxHeight: 'calc(100vh - 50px)' }}>

                {/* ═══ OVERVIEW TAB ═══ */}
                {activeTab === 'overview' && (
                    <div>
                        <h2 style={S.pageTitle}>Platform Overview</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
                            <StatCard label="Total Users" value={stats.totalUsers || 0} color="#58a6ff" />
                            <StatCard label="Students" value={stats.students || 0} color="#3fb950" />
                            <StatCard label="Mentors" value={stats.mentors || 0} color="#f2cc60" />
                            <StatCard label="Admins" value={stats.admins || 0} color="#f85149" />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
                            <StatCard label="Total Projects" value={stats.totalProjects || 0} color="#a371f7" />
                            <StatCard label="Active Projects" value={stats.activeProjects || 0} color="#3fb950" />
                            <StatCard label="Courses" value={`${stats.activeCourses || 0}/${stats.totalCourses || 0}`} color="#58a6ff" />
                            <StatCard label="Extensions" value={stats.extensions || 0} color="#f2cc60" />
                        </div>
                        {(stats.communityPending || 0) > 0 && (
                            <div style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
                                <AlertTriangle size={20} color="#f85149" />
                                <span style={{ color: '#f85149', fontWeight: 600 }}>{stats.communityPending} community project(s) pending approval</span>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ APP FEATURES TAB ═══ */}
                {activeTab === 'features' && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h2 style={S.pageTitle}>App Features & Configuration</h2>
                            <button onClick={handleSaveSettings} disabled={saving} style={S.saveBtn}>
                                <Save size={14} /> {saving ? 'Saving...' : 'Save All Changes'}
                            </button>
                        </div>
                        {saveMsg && <div style={{ background: 'rgba(63,185,80,0.1)', border: '1px solid rgba(63,185,80,0.4)', color: '#3fb950', padding: '8px 16px', borderRadius: 6, marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><CheckCircle size={14} /> {saveMsg}</div>}

                        <SectionTitle>Branding</SectionTitle>
                        <div style={S.card}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                <div>
                                    <label style={S.label}>Platform Name</label>
                                    <input style={S.input} value={settings.platform_name || ''} onChange={e => setFeatureVal('platform_name', e.target.value)} />
                                </div>
                                <div>
                                    <label style={S.label}>Tagline</label>
                                    <input style={S.input} value={settings.platform_tagline || ''} onChange={e => setFeatureVal('platform_tagline', e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <SectionTitle>Core IDE Features</SectionTitle>
                        <div style={S.card}>
                            <FeatureToggle label="AI Mentor Chat" desc={settings.ai_mentor_desc} on={settings.ai_mentor_enabled} onToggle={() => toggleFeature('ai_mentor_enabled')} />
                            <FeatureToggle label="Live Preview" desc={settings.live_preview_desc} on={settings.live_preview} onToggle={() => toggleFeature('live_preview')} />
                            <FeatureToggle label="Integrated Terminal" desc={settings.terminal_desc} on={settings.terminal_enabled} onToggle={() => toggleFeature('terminal_enabled')} />
                            <FeatureToggle label="Git Integration" desc={settings.git_integration_desc} on={settings.git_integration} onToggle={() => toggleFeature('git_integration')} />
                            <FeatureToggle label="Local File Sync" desc={settings.local_sync_desc} on={settings.local_sync} onToggle={() => toggleFeature('local_sync')} />
                            <FeatureToggle label="ZIP Download" desc={settings.zip_download_desc} on={settings.zip_download} onToggle={() => toggleFeature('zip_download')} />
                            <FeatureToggle label="MCP Tools (Autonomous)" desc={settings.mcp_tools_desc} on={settings.mcp_tools} onToggle={() => toggleFeature('mcp_tools')} />
                        </div>

                        <SectionTitle>Learning & Security</SectionTitle>
                        <div style={S.card}>
                            <FeatureToggle label="Paste Protection" desc={settings.paste_protection_desc} on={settings.paste_protection} onToggle={() => toggleFeature('paste_protection')} />
                            <FeatureToggle label="Behavior Tracking" desc={settings.behavior_tracking_desc} on={settings.behavior_tracking} onToggle={() => toggleFeature('behavior_tracking')} />
                            <div style={S.featureRow}>
                                <div style={{ flex: 1 }}>
                                    <div style={S.featureLabel}>QA Pass Score</div>
                                    <div style={S.featureDesc}>{settings.qa_pass_score_desc}</div>
                                </div>
                                <input type="number" style={{ ...S.input, width: 80, textAlign: 'center' }} value={settings.qa_pass_score || 70} onChange={e => setFeatureVal('qa_pass_score', Number(e.target.value))} />
                            </div>
                            <div style={S.featureRow}>
                                <div style={{ flex: 1 }}>
                                    <div style={S.featureLabel}>Max Hint Requests</div>
                                    <div style={S.featureDesc}>{settings.max_hint_requests_desc}</div>
                                </div>
                                <input type="number" style={{ ...S.input, width: 80, textAlign: 'center' }} value={settings.max_hint_requests || 3} onChange={e => setFeatureVal('max_hint_requests', Number(e.target.value))} />
                            </div>
                            <div style={S.featureRow}>
                                <div style={{ flex: 1 }}>
                                    <div style={S.featureLabel}>Max SOS Requests</div>
                                    <div style={S.featureDesc}>{settings.max_sos_requests_desc}</div>
                                </div>
                                <input type="number" style={{ ...S.input, width: 80, textAlign: 'center' }} value={settings.max_sos_requests || 2} onChange={e => setFeatureVal('max_sos_requests', Number(e.target.value))} />
                            </div>
                        </div>

                        <SectionTitle>Platform Modules</SectionTitle>
                        <div style={S.card}>
                            <FeatureToggle label="Marketplace" desc={settings.marketplace_desc} on={settings.marketplace_enabled} onToggle={() => toggleFeature('marketplace_enabled')} />
                            <FeatureToggle label="Course Builder" desc={settings.course_builder_desc} on={settings.course_builder} onToggle={() => toggleFeature('course_builder')} />
                        </div>
                    </div>
                )}

                {/* ═══ EXTENSIONS TAB ═══ */}
                {activeTab === 'extensions' && (
                    <div>
                        <h2 style={S.pageTitle}>Global Extensions</h2>
                        <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 24 }}>Extensions added here appear in every user's Extension Hub across all projects.</p>
                        <div style={S.card}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#e6edf3', marginBottom: 16 }}>Register New Extension</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                                <input style={S.input} placeholder="Extension Name" value={newExt.name} onChange={e => setNewExt({ ...newExt, name: e.target.value })} />
                                <select style={S.input} value={newExt.type} onChange={e => setNewExt({ ...newExt, type: e.target.value })}>
                                    <option value="tool">Standard Tool</option>
                                    <option value="mcp">MCP Protocol Server</option>
                                    <option value="agent">Autonomous Agent</option>
                                </select>
                            </div>
                            <input style={{ ...S.input, marginBottom: 12 }} placeholder="Short description..." value={newExt.description} onChange={e => setNewExt({ ...newExt, description: e.target.value })} />
                            <input style={{ ...S.input, marginBottom: 12 }} placeholder="npx command (e.g., @modelcontextprotocol/server-postgres)" value={newExt.command} onChange={e => setNewExt({ ...newExt, command: e.target.value })} />
                            <button onClick={handleAddExt} style={S.greenBtn}><Plus size={14} /> Deploy to Platform</button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
                            {extensions.map(ex => (
                                <div key={ex.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...S.card }}>
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                            <span style={{ fontSize: 15, fontWeight: 700, color: '#e6edf3' }}>{ex.name}</span>
                                            <span style={S.badge(ex.type === 'mcp' ? '#f2cc60' : ex.type === 'agent' ? '#a371f7' : '#58a6ff')}>{ex.type.toUpperCase()}</span>
                                            <span style={S.badge(ex.is_active ? '#3fb950' : '#f85149')}>{ex.is_active ? 'ACTIVE' : 'OFF'}</span>
                                        </div>
                                        <div style={{ fontSize: 12, color: '#8b949e' }}>{ex.description}</div>
                                        {ex.command && <code style={{ fontSize: 11, color: '#58a6ff' }}>{ex.command}</code>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                        <button onClick={() => handleToggleExt(ex.id, ex.is_active)} style={S.ghostBtn}>{ex.is_active ? <><PowerOff size={14} /> Disable</> : <><Power size={14} /> Enable</>}</button>
                                        <button onClick={() => handleDeleteExt(ex.id)} style={S.dangerBtn}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                            {extensions.length === 0 && <div style={{ textAlign: 'center', color: '#484f58', padding: 32 }}>No extensions deployed yet.</div>}
                        </div>
                    </div>
                )}

                {/* ═══ USER MANAGEMENT TAB ═══ */}
                {activeTab === 'users' && (
                    <div>
                        <h2 style={S.pageTitle}>User Management</h2>
                        <p style={{ color: '#8b949e', fontSize: 13, marginBottom: 24 }}>Manage platform users, promote to mentor/admin, or revoke access.</p>
                        <div style={{ background: '#0d1117', borderRadius: 8, border: '1px solid #21262d', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid #21262d' }}>
                                        <th style={S.th}>Name</th>
                                        <th style={S.th}>Email</th>
                                        <th style={S.th}>Role</th>
                                        <th style={S.th}>Skill</th>
                                        <th style={S.th}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid #161b22' }}>
                                            <td style={S.td}>{u.name || '—'}</td>
                                            <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11 }}>{u.email}</td>
                                            <td style={S.td}>
                                                <span style={S.badge(u.role === 'admin' ? '#f85149' : u.role === 'mentor' ? '#f2cc60' : '#3fb950')}>{u.role.toUpperCase()}</span>
                                            </td>
                                            <td style={S.td}>{u.skill_level || '—'}</td>
                                            <td style={S.td}>
                                                <select
                                                    style={{ ...S.input, width: 'auto', padding: '4px 8px', fontSize: 11 }}
                                                    value={u.role}
                                                    onChange={e => handleRoleChange(u.id, e.target.value)}
                                                >
                                                    <option value="student">Student</option>
                                                    <option value="mentor">Mentor</option>
                                                    <option value="admin">Admin</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {users.length === 0 && <div style={{ textAlign: 'center', color: '#484f58', padding: 32 }}>No users found.</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Sub-components ──────────────────────────────────────────────
function StatCard({ label, value, color }) {
    return (
        <div style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 8, padding: 20, borderTop: `3px solid ${color}` }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#8b949e', marginTop: 4 }}>{label}</div>
        </div>
    );
}

function SectionTitle({ children }) {
    return <div style={{ fontSize: 12, fontWeight: 800, color: '#8b949e', letterSpacing: '0.05em', margin: '24px 0 12px', textTransform: 'uppercase' }}>{children}</div>;
}

function FeatureToggle({ label, desc, on, onToggle }) {
    return (
        <div style={S.featureRow}>
            <div style={{ flex: 1 }}>
                <div style={S.featureLabel}>{label}</div>
                <div style={S.featureDesc}>{desc}</div>
            </div>
            <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {on ? <ToggleRight size={28} color="#3fb950" /> : <ToggleLeft size={28} color="#484f58" />}
            </div>
        </div>
    );
}

// ─── Styles ──────────────────────────────────────────────────────
const S = {
    pageTitle: { margin: '0 0 8px', fontSize: 22, color: '#e6edf3', fontWeight: 800 },
    card: { background: '#161b22', border: '1px solid #21262d', borderRadius: 8, padding: 20, marginBottom: 12 },
    input: {
        width: '100%', background: '#010409', border: '1px solid #30363d', color: '#e6edf3',
        padding: '8px 12px', borderRadius: 6, fontSize: 13, outline: 'none'
    },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#c9d1d9', marginBottom: 6 },
    saveBtn: {
        background: '#238636', color: 'white', border: '1px solid #2ea043', padding: '8px 20px',
        borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
    },
    greenBtn: {
        background: '#238636', color: 'white', border: '1px solid #2ea043', padding: '8px 16px',
        borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
    },
    ghostBtn: {
        background: '#21262d', border: '1px solid #30363d', color: '#c9d1d9', cursor: 'pointer',
        padding: '6px 12px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12
    },
    dangerBtn: {
        background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.4)', color: '#f85149',
        cursor: 'pointer', padding: '6px 10px', borderRadius: 6, display: 'flex', alignItems: 'center'
    },
    featureRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 0', borderBottom: '1px solid #21262d'
    },
    featureLabel: { fontSize: 14, fontWeight: 600, color: '#e6edf3' },
    featureDesc: { fontSize: 11, color: '#8b949e', marginTop: 2 },
    badge: (color) => ({
        fontSize: 10, fontWeight: 800, color, background: `${color}18`, padding: '2px 8px',
        borderRadius: 12, border: `1px solid ${color}60`
    }),
    th: {
        textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 800, color: '#8b949e',
        background: '#161b22', letterSpacing: '0.05em'
    },
    td: { padding: '10px 16px', fontSize: 13, color: '#c9d1d9' },
};

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useStore } from '../store';
import { Search, Play, Loader2, Star, Clock, Filter } from 'lucide-react';

const DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced'];

const DIFF_COLORS = {
    beginner: '#3fb950',
    intermediate: '#f0883e',
    advanced: '#f85149'
};

export default function MarketplacePage() {
    const navigate = useNavigate();
    const { token } = useStore();
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [difficulty, setDifficulty] = useState('all');

    useEffect(() => {
        if (!token) { navigate('/login'); return; }
        loadProjects();
    }, [token]);

    const loadProjects = async (q, diff) => {
        setLoading(true);
        try {
            const res = await api.getMarketplace(q || search, diff || difficulty);
            setProjects(res.projects || []);
        } catch (e) {
            console.error('[Marketplace]', e);
        }
        setLoading(false);
    };

    const handleSearch = (q) => {
        setSearch(q);
        loadProjects(q, difficulty);
    };

    const handleDifficulty = (d) => {
        setDifficulty(d);
        loadProjects(search, d);
    };

    return (
        <div style={styles.page}>
            {/* Header */}
            <div style={styles.header}>
                <h1 style={styles.title}>Project Marketplace</h1>
                <p style={styles.subtitle}>Choose a project and start building. Learn by doing.</p>
            </div>

            {/* Search + Filter Bar */}
            <div style={styles.filterBar}>
                <div style={styles.searchWrap}>
                    <Search size={14} style={{ color: '#484f58' }} />
                    <input
                        type="text"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        placeholder="Search projects..."
                        style={styles.searchInput}
                    />
                </div>

                <div style={styles.difficultyBar}>
                    <Filter size={12} style={{ color: '#484f58' }} />
                    {DIFFICULTIES.map(d => (
                        <button
                            key={d}
                            onClick={() => handleDifficulty(d)}
                            style={{
                                ...styles.diffBtn,
                                background: difficulty === d ? '#21262d' : 'transparent',
                                color: difficulty === d ? '#e6edf3' : '#8b949e',
                                borderColor: difficulty === d ? '#30363d' : 'transparent'
                            }}
                        >
                            {d.charAt(0).toUpperCase() + d.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            {/* Project Grid */}
            {loading ? (
                <div style={styles.loadingWrap}>
                    <Loader2 size={24} className="spin" style={{ color: '#58a6ff' }} />
                </div>
            ) : projects.length === 0 ? (
                <div style={styles.emptyWrap}>
                    <p style={{ color: '#484f58', fontSize: 14 }}>No projects found. Check back later!</p>
                </div>
            ) : (
                <div style={styles.grid}>
                    {projects.map(p => {
                        let techStack = [];
                        try {
                            techStack = Array.isArray(p.tech_stack) ? p.tech_stack : JSON.parse(p.tech_stack || '[]');
                        } catch (e) {
                            // Fallback for simple comma-separated strings
                            techStack = (p.tech_stack || '').split(',').map(s => s.trim()).filter(Boolean);
                        }
                        return (
                            <div key={p.id} style={styles.card} onClick={() => navigate(`/marketplace/${p.id}`)}>
                                {/* Badge */}
                                <div style={styles.cardTop}>
                                    <span style={{
                                        ...styles.badgeTag,
                                        background: p.badge === 'official' ? 'rgba(88, 166, 255, 0.15)' : 'rgba(240, 136, 62, 0.15)',
                                        color: p.badge === 'official' ? '#58a6ff' : '#f0883e'
                                    }}>
                                        {p.badge === 'official' ? '🔵 Official' : '🟡 Community'}
                                    </span>
                                    <span style={{ ...styles.diffTag, color: DIFF_COLORS[p.difficulty] || '#8b949e' }}>
                                        {p.difficulty || 'intermediate'}
                                    </span>
                                </div>

                                <h3 style={styles.cardTitle}>{p.title}</h3>
                                <p style={styles.cardDesc}>{(p.description || '').substring(0, 100)}{p.description?.length > 100 ? '...' : ''}</p>

                                {/* Tech Stack Tags */}
                                {techStack.length > 0 && (
                                    <div style={styles.techRow}>
                                        {techStack.slice(0, 4).map((t, i) => (
                                            <span key={i} style={styles.techTag}>{t}</span>
                                        ))}
                                    </div>
                                )}

                                {/* Footer */}
                                <div style={styles.cardFooter}>
                                    {p.estimated_hours && (
                                        <span style={styles.metaItem}><Clock size={11} /> ~{p.estimated_hours}h</span>
                                    )}
                                    <button style={styles.startBtn}>
                                        <Play size={12} /> Start →
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

const styles = {
    page: { minHeight: '100vh', background: '#0d1117', color: '#c9d1d9', padding: '24px 32px', fontFamily: 'var(--sans)' },
    header: { marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 800, color: '#e6edf3', margin: 0 },
    subtitle: { fontSize: 13, color: '#8b949e', marginTop: 4 },
    filterBar: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
    searchWrap: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, background: '#161b22', border: '1px solid #21262d', flex: 1, minWidth: 200 },
    searchInput: { background: 'none', border: 'none', color: '#e6edf3', fontSize: 13, outline: 'none', flex: 1, fontFamily: 'var(--sans)' },
    difficultyBar: { display: 'flex', alignItems: 'center', gap: 4 },
    diffBtn: { padding: '6px 12px', borderRadius: 6, border: '1px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'transparent', fontFamily: 'var(--sans)' },
    loadingWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
    emptyWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
    grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
    card: { background: '#161b22', border: '1px solid #21262d', borderRadius: 12, padding: 20, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 10 },
    cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    badgeTag: { fontSize: 10, fontWeight: 600, padding: '3px 8px', borderRadius: 4 },
    diffTag: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' },
    cardTitle: { fontSize: 15, fontWeight: 700, color: '#e6edf3', margin: 0 },
    cardDesc: { fontSize: 12, color: '#8b949e', lineHeight: 1.5, margin: 0 },
    techRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
    techTag: { fontSize: 10, padding: '2px 6px', borderRadius: 3, background: '#0d1117', color: '#7ee787', fontFamily: 'var(--mono)' },
    cardFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 10, borderTop: '1px solid #21262d' },
    metaItem: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#484f58' },
    startBtn: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 14px', borderRadius: 6, background: '#238636', color: '#fff', border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer' }
};

const { Pool } = require('pg');
require('dotenv').config();

// Standard PostgreSQL Scale Matrix (Eliminates localized SQLite Row Contention under extreme load)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/amit_bodhit',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Generic Async Adapter Shell wrapping the monolithic DB
const db = {
    query: (text, params) => pool.query(text, params),
    
    // Polyfilling synchronous SQLite DB calls with standard syntax wrappers to ease transition
    prepare: (text) => ({
        get: async (...params) => {
            const res = await pool.query(text, params);
            return res.rows[0];
        },
        all: async (...params) => {
            const res = await pool.query(text, params);
            return res.rows;
        },
        run: async (...params) => {
            const res = await pool.query(text, params);
            return { changes: res.rowCount };
        }
    })
};

// 7. Initialize High Priority Indexes Native Scale Layer
const initIndexes = async () => {
    try {
        await pool.query('CREATE INDEX IF NOT EXISTS idx_project_user ON projects(user_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_progress_task ON course_progress(task_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_mentor_sessions_project ON mentor_sessions(project_id)');
        console.log('[PG] Scale Identifiers and Indexes established.');
    } catch (e) {
        console.warn('[PG] Not connected or Index Error:', e.message);
    }
};

initIndexes();

module.exports = db;

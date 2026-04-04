const db = require('../db/database');

/**
 * Project Memory Service
 * Manages structured context for the AI Mentor.
 */
class MemoryService {
    constructor() {
        this._ensureMemoryInit();
    }

    _ensureMemoryInit() {
        // Migration check for missing columns if needed in the future
    }

    getMemory(projectId) {
        const row = db.prepare('SELECT * FROM project_memory WHERE project_id = ?').get(projectId);
        if (!row) return null;
        
        return {
            ...row,
            concepts: JSON.parse(row.concepts_json || '[]'),
            failures: JSON.parse(row.failures_json || '{}'),
            reflections: JSON.parse(row.reflections_json || '[]')
        };
    }

    getSkillReason(concept, failures, attempts = 1) {
        const errorCount = failures[concept] || 0;
        if (errorCount === 0 && attempts === 1) return "First-time mastery with zero errors.";
        if (errorCount > 5) return `Struggled with syntax; ${errorCount} recursive failures detected.`;
        if (attempts > 3) return "Mastered after multiple logical iterations.";
        return "Consistent progress with minimal friction.";
    }

    updateLastAction(projectId, taskId, action, code = null, force = false) {
        // [PRECISION FIX] Only update on deterministic events unless forced
        if (!force && !action.includes('Mastered') && !action.includes('failed') && !action.includes('Action Type')) return;

        db.prepare(`
            INSERT INTO project_memory (project_id, task_id, last_action, last_code_snapshot, updated_at)
            VALUES (?, ?, ?, ?, datetime('now'))
            ON CONFLICT(project_id) DO UPDATE SET
                task_id = excluded.task_id,
                last_action = excluded.last_action,
                last_code_snapshot = COALESCE(excluded.last_code_snapshot, last_code_snapshot),
                updated_at = datetime('now')
        `).run(projectId, taskId, action, code);
    }

    markConceptLearned(projectId, concept) {
        const memory = this.getMemory(projectId);
        let concepts = memory ? memory.concepts : [];
        
        if (!concepts.includes(concept)) {
            concepts.push(concept);
            this._saveConcepts(projectId, concepts);
        }
    }

    recordFailure(projectId, errorType) {
        const memory = this.getMemory(projectId);
        let failures = memory ? memory.failures : {};
        
        failures[errorType] = (failures[errorType] || 0) + 1;
        
        db.prepare(`
            INSERT INTO project_memory (project_id, failures_json, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(project_id) DO UPDATE SET
                failures_json = excluded.failures_json,
                updated_at = datetime('now')
        `).run(projectId, JSON.stringify(failures));
    }

    addReflection(projectId, text) {
        const memory = this.getMemory(projectId);
        let reflections = memory?.reflections_json ? JSON.parse(memory.reflections_json) : [];
        
        reflections.push({ text, timestamp: new Date().toISOString() });
        
        db.prepare(`
            UPDATE project_memory SET reflections_json = ?, updated_at = datetime('now') WHERE project_id = ?
        `).run(JSON.stringify(reflections), projectId);
    }

    _saveConcepts(projectId, concepts) {
        db.prepare(`
            INSERT INTO project_memory (project_id, concepts_json, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(project_id) DO UPDATE SET
                concepts_json = excluded.concepts_json,
                updated_at = datetime('now')
        `).run(projectId, JSON.stringify(concepts));
    }

    getMemoryPrompt(projectId) {
        const memory = this.getMemory(projectId);
        if (!memory) return "";

        return `
STRUCTURED MEMORY:
- Last Action: ${memory.last_action || 'N/A'}
- Concepts Mastered: ${memory.concepts.join(', ') || 'N/A'}
- Recurring Failures: ${Object.entries(memory.failures).map(([k,v]) => `${k}(${v})`).join(', ') || 'None'}
`;
    }
}

module.exports = new MemoryService();

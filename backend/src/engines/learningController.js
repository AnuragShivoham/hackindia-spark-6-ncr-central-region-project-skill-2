const behaviorEngine = require('./behaviorEngine');
const scaffoldEngine = require('./scaffoldEngine');
const skillEngine = require('./skillEngine');
const db = require('../db/database');
const mentorEngine = require('./mentorEngine');
const crypto = require('crypto');

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

const learningController = {
  analyzeBehavior(userId, data) {
    const score = behaviorEngine.calculateScore(data);
    db.prepare(`
        INSERT INTO behavior_logs (id, user_id, task_id, paste_size, typing_speed, attempts, time_spent, cheat_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(crypto.randomUUID(), userId, data.taskId, data.pasteSize, data.typingSpeed, data.attempts, data.timeSpent, score);
    
    return { score, directives: this.controlHints(score) };
  },

  decideDifficulty(userId, taskId) {
    const logs = db.prepare('SELECT cheat_score FROM behavior_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 15').all(userId) || [];
    if (logs.length === 0) return 'intermediate'; 
    
    // Base capability on historical success matrices
    const progressLogs = db.prepare('SELECT attempts, status FROM course_progress WHERE project_id IN (SELECT id FROM projects WHERE user_id = ?)').all(userId) || [];
    const totalPassed = progressLogs.filter(p => p.status === 'passed').length;
    let successRate = progressLogs.length > 0 ? (totalPassed / progressLogs.length) * 100 : 50;

    const avgScore = logs.reduce((sum, log) => sum + log.cheat_score, 0) / logs.length;
    
    // Dynamic weighted skill model
    let skillScore = (successRate * 0.6) - (avgScore * 0.4); 
    if (skillScore > 40) return 'advanced';
    if (skillScore < 10) return 'beginner';
    return 'intermediate';
  },

  controlScaffold(userId, taskId, isCourse, projectId, progressData, behaviorData) {
    if (!isCourse) return null; 

    // Explicit Object Guards against undefined payload crashes from external API caller
    if (!progressData) progressData = { attempts: 0, last_scaffold_level: 1 };
    if (!behaviorData) behaviorData = { cheat_score: 0 };

    const config = skillEngine.getAdaptiveConfig(userId);

    let targetBase = config.avgSkill < 30 ? 3 : config.avgSkill < 70 ? 2 : 1; 
    let prevLevel = progressData.last_scaffold_level || 1;
    
    let newLevel = Math.round(lerp(prevLevel, targetBase, 0.3));

    // Soft Escape Hatch (Increment, no jumping)
    if (progressData.attempts >= 3 && behaviorData.cheat_score < 50) {
        newLevel = Math.min(newLevel + 1, 3);
    }

    // Soft Cheat Drop (Decrement silently, no aggressive hard drops)
    if (behaviorData.cheat_score > 60) {
        newLevel = Math.max(newLevel - 1, 1);
    }

    // Final Level Downgrade Prevention 
    newLevel = Math.max(prevLevel, newLevel);

    // OCC (Optimistic Concurrency Control): Project scoped & PrevLevel locked race condition patch
    const updResult = db.prepare(`
        UPDATE course_progress SET last_scaffold_level = ? 
        WHERE task_id = ? AND project_id = ? AND last_scaffold_level <= ?
    `).run(newLevel, taskId, projectId, prevLevel);

    if (updResult.changes === 0) {
        console.warn(`[Learning Controller Warning] Scaffold level not persisted or Race Condition averted for Task: ${taskId}`);
        
        // Data Integrity Fallback: Re-sync actual DB state to prevent silent desync continuation
        const latest = db.prepare(`
            SELECT last_scaffold_level FROM course_progress 
            WHERE task_id = ? AND project_id = ?
        `).get(taskId, projectId);
        
        newLevel = latest ? latest.last_scaffold_level : newLevel;
    }

    // Return explicit state to keep Frontend UI synchronized
    return {
        scaffold: scaffoldEngine.generateScaffold(taskId, newLevel),
        level: newLevel
    };
  },

  controlHints(cheatScore, attempts = 0) {
    if (cheatScore > 60) {
      return {
         action: 'restricted',
         maxHintLevel: 1,
         message: "Let's go step-by-step to ensure understanding. Explain your logic before proceeding."
      };
    }
    if (attempts > 3) {
      return {
         action: 'struggling',
         maxHintLevel: 2,
         message: "You've made several attempts. Let's break this down into smaller steps."
      };
    }
    if (cheatScore > 30) {
      return {
         action: 'suspicious',
         maxHintLevel: 2,
         message: "Make sure you understand the code block you just added."
      };
    }
    return { action: 'normal' };
  },

  async routeToMentor(role, input, options = { isCourse: false }) {
     const config = options.user_id ? skillEngine.getAdaptiveConfig(options.user_id) : { avgSkill: 50, difficulty: "medium" };
     
     let helpLevel = config.avgSkill < 30 ? "high" : config.avgSkill > 70 ? "low" : "medium";
     let mode = "guided";

     if (options.user_id && options.task_id) {
         const behavior = db.prepare('SELECT cheat_score FROM behavior_logs WHERE user_id = ? AND task_id = ? ORDER BY created_at DESC LIMIT 1').get(options.user_id, options.task_id);
         if (behavior && behavior.cheat_score > 60) mode = "strict";
     }

     return await mentorEngine.run({ 
         role, 
         input, 
         isCourse: options.isCourse,
         context: { mode, helpLevel, difficulty: config.difficulty }
     });
  },

  /**
   * Phase 9: Unified processSubmission handler
   * type: "code" | "hint" | "explain"
   */
  async processSubmission(userId, taskId, { type, code, explanation }) {
    const MAX_HINTS_PER_HOUR = 5;

    // Get active project context for the user
    const userRow = db.prepare('SELECT active_project_id FROM users WHERE id = ?').get(userId);
    const projectId = userRow?.active_project_id;
    if (!projectId) throw new Error('No active project found for user');

    // Get behavior + progress data for mentor mode
    const behavior = db.prepare('SELECT cheat_score FROM behavior_logs WHERE user_id = ? AND task_id = ? ORDER BY created_at DESC LIMIT 1').get(userId, taskId);
    const progress = db.prepare('SELECT attempts, status FROM course_progress WHERE project_id = ? AND task_id = ?').get(projectId, taskId);
    
    const cheatScore = behavior?.cheat_score || 0;
    const attempts = progress?.attempts || 0;
    
    const directives = this.controlHints(cheatScore, attempts);
    
    // Determine mentorMode from backend (frontend NEVER guesses)
    let mentorMode = 'normal';
    if (directives.action === 'restricted') mentorMode = 'restricted';
    else if (directives.action === 'struggling' || directives.action === 'suspicious') mentorMode = 'struggling';

    // ── TYPE: HINT ──────────────────────────────────────────────────
    if (type === 'hint') {
      // Anti-spam: count recent hint requests
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const recentHints = db.prepare(
        'SELECT COUNT(*) as cnt FROM hint_requests WHERE user_id = ? AND task_id = ? AND requested_at > ?'
      ).get(userId, taskId, oneHourAgo);

      if (recentHints && recentHints.cnt >= MAX_HINTS_PER_HOUR) {
        return {
          feedback: [{ type: 'warn', message: `Hint limit reached (${MAX_HINTS_PER_HOUR}/hour). Try solving it yourself first.` }],
          scaffold: null,
          level: directives.maxHintLevel || 3,
          passed: false,
          mentorMode
        };
      }

      // Record hint request
      db.prepare('INSERT INTO hint_requests (id, user_id, task_id) VALUES (?, ?, ?)').run(crypto.randomUUID(), userId, taskId);

      // Get leveled scaffold
      const scaffoldResult = scaffoldEngine.generateScaffold(taskId, directives.maxHintLevel || 3);
      
      return {
        feedback: [],
        scaffold: typeof scaffoldResult === 'string' ? scaffoldResult : scaffoldResult?.hint || 'Think about the core concept needed here.',
        level: directives.maxHintLevel || 3,
        passed: false,
        mentorMode
      };
    }

    // ── TYPE: EXPLAIN (CRITICAL CHECKPOINT) ────────────────────────
    if (type === 'explain') {
      if (!explanation || explanation.trim().length < 10) {
        return { action: 'retry', feedback: [{ type: 'error', message: 'Explanation too short. Write at least 10 characters explaining your approach.' }], passed: false, mentorMode };
      }

      const task = db.prepare('SELECT title, description, concepts_taught FROM course_tasks WHERE id = ?').get(taskId) 
                   || db.prepare('SELECT title, description, concepts_taught FROM tasks WHERE id = ?').get(taskId);
      
      const taskText = ((task?.title || '') + ' ' + (task?.description || '') + ' ' + (task?.concepts_taught || '')).toLowerCase();
      const explWords = explanation.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const relevantWords = explWords.filter(w => taskText.includes(w));
      const relevanceScore = explWords.length > 0 ? (relevantWords.length / explWords.length) * 100 : 0;

      if (relevanceScore < 10 && explWords.length > 3) {
        return { action: 'retry', feedback: [{ type: 'warn', message: 'Your explanation doesn\'t seem related to this task. Focus on the specific concepts involved.' }], passed: false, mentorMode };
      }

      // Semantic Check via LLM - Hybrid Validation (Requires strict length + structural elements + AI consent)
      if (explWords.length < 15) {
         return { action: 'retry', feedback: [{ type: 'error', message: 'Explanation lacks required critical depth. You must explain WHAT you did, WHY you did it, and HOW it works.' }], passed: false, mentorMode };
      }

      // Check if student received mentor intervention
      const cpCheck = db.prepare('SELECT interventions_count FROM course_progress WHERE project_id = ? AND task_id = ?').get(projectId, taskId);
      const isIntervened = cpCheck && cpCheck.interventions_count > 0;
      
      const systemPrompt = isIntervened 
        ? `A Mentor recently intervened in this task. EXPLANATION MUST MAP the logic. It must explicitly state what the code was BEFORE, what the code is AFTER, and the specific reasoning for the change. Reject ANY generic paraphrased descriptions strongly. Explanation: ${explanation}`
        : `Strictly verify this explanation answers WHAT, WHY, and HOW for the code implemented. Explanation: ${explanation}`;

      const mentorResult = await this.routeToMentor('qa', systemPrompt, { user_id: userId, isCourse: true });
      const resultText = typeof mentorResult === 'string' ? mentorResult : JSON.stringify(mentorResult);
      const passedQA = resultText.toLowerCase().includes('pass') || resultText.toLowerCase().includes('correct');

      if (passedQA) {
        // FINALLY Mark Complete (OCC Race Condition Patched)
        const res = db.prepare(`UPDATE course_progress SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE project_id = ? AND task_id = ? AND status = 'awaiting_explanation'`).run(projectId, taskId);
        
        if (res.changes === 0) {
            return { action: 'error', feedback: [{ type: 'error', message: 'Task already completed or invalid state transition.' }], passed: false, mentorMode };
        }
        
        return { action: 'next', feedback: [{ type: 'success', message: 'Excellent explanation. Task unlocked!' }], passed: true, mentorMode };
      } else {
        return { action: 'retry', feedback: [{ type: 'error', message: resultText }], passed: false, mentorMode };
      }
    }

    // ── TYPE: CODE (DETERMINISTIC VALIDATION ONLY) ──────────────────
    if (type === 'code') {
      if (!code || code.trim().length === 0) {
        return { action: 'retry', feedback: [{ type: 'error', message: 'No code submitted.' }], passed: false, mentorMode };
      }

      const WorkspaceService = require('../services/workspaceService');
      const courseService = require('../services/courseService');
      const wsPath = WorkspaceService.getProjectPath(projectId);
      
      const task = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(taskId)
                   || db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

      // Deterministic Static Check
      let validationResult = { passed: true };
      try {
        validationResult = courseService.validateStaticTask(task, wsPath);
      } catch (e) {
        validationResult = { passed: false, hint: e.message };
      }

      // Record Attempt & Awaiting Lock
      if (validationResult.passed) {
        db.prepare(`UPDATE course_progress SET status = 'awaiting_explanation', attempts = attempts + 1, updated_at = datetime('now') WHERE project_id = ? AND task_id = ?`).run(projectId, taskId);

        return { 
          action: 'explain', 
          feedback: [{ type: 'success', message: 'Code tests passed! Now explain your logical approach.' }], 
          passed: false, // Not complete yet, must explain
          mentorMode 
        };
      } else {
        // Failed - Increment Attempt and Calculate Consistency Score (Normalized)
        const crypto = require('crypto');
        const rawErrorMessage = validationResult.hint || 'Code failed validation constraints.';
        
        // Normalize Error: Strip dynamic stack traces, line numbers, timestamps, and large digits.
        const normalizedError = rawErrorMessage
            .replace(/:\d+:\d+/g, '')        // remove line:col
            .replace(/at .*/g, '')           // strip stack traces
            .replace(/\b\d{4,}\b/g, '')      // remove large dynamic numbers
            .toLowerCase()
            .trim()
            .slice(0, 120);

        const errorHash = crypto.createHash('md5').update(normalizedError).digest('hex');
        
        const cp = db.prepare('SELECT last_error_hash, failure_consistency FROM course_progress WHERE project_id = ? AND task_id = ?').get(projectId, taskId);
        let cons = 0;
        if (cp && cp.last_error_hash === errorHash) {
            cons = (cp.failure_consistency || 0) + 1;
        }

        db.prepare(`UPDATE course_progress SET attempts = attempts + 1, updated_at = datetime('now'), last_error_hash = ?, failure_consistency = ? WHERE project_id = ? AND task_id = ?`).run(errorHash, cons, projectId, taskId);

        // Targeted Scaffolding (Behavior + Skills over Linear)
        const config = skillEngine.getAdaptiveConfig(userId);
        let targetLevel = directives.maxHintLevel || 2;
        
        if (cheatScore > 60) targetLevel = Math.max(targetLevel - 1, 1); // Cheater restriction
        if (attempts >= 2 || config.avgSkill < 30) targetLevel = Math.min(targetLevel + 1, 4); // Adaptive support

        const dynamicHint = scaffoldEngine.generateScaffold(taskId, targetLevel);
        return { 
          action: 'guided', 
          mode: 'guided',
          feedback: [{ type: 'error', message: validationResult.hint || 'Code failed validation constraints.' }],
          scaffold: typeof dynamicHint === 'string' ? dynamicHint : dynamicHint?.hint,
          level: targetLevel,
          passed: false, 
          mentorMode 
        };
      }
    }
  }
};

module.exports = learningController;

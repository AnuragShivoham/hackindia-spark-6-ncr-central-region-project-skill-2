const behaviorEngine = require('./behaviorEngine');
const scaffoldEngine = require('./scaffoldEngine');
const skillEngine = require('./skillEngine');
const db = require('../db/database');
const mentorEngine = require('./mentorEngine');
const crypto = require('crypto');
const memoryService = require('../services/memoryService');
const TaskEngine = require('./taskEngine');

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

  /**
   * Compilation-stage Validator (preRunCheck)
   * Ensures the student's project structure is actually 'runnable' before triggering execution.
   */
  async preRunCheck(projectId) {
    const tracker = require('../services/progressTracker');
    const project = tracker.getProject(projectId);
    if (!project) return { success: false, reason: "Project context not found." };

    const WorkspaceService = require('../services/workspaceService');
    let files = [];
    try { files = WorkspaceService.listFiles(projectId); } catch(e) {}

    // 1. Manifest Presence
    const stack = (project.tech_stack || []).join(',').toLowerCase();
    const isNode = stack.includes('react') || stack.includes('express') || stack.includes('node');
    const isPython = stack.includes('python') || stack.includes('ml');

    if (isNode && !files.some(f => f.path.endsWith('package.json'))) {
      return { success: false, reason: "Missing 'package.json'. Node.js projects require a manifest to resolve dependencies." };
    }

    // 2. Entry Point Validation
    const commonEntries = isNode ? ['server.js', 'index.js', 'app.js', 'index.html'] : isPython ? ['app.py', 'train.py', 'main.py'] : [];
    const hasEntry = files.some(f => commonEntries.some(e => f.path.endsWith(e)));

    if (commonEntries.length > 0 && !hasEntry) {
        return { success: false, reason: `Logical entry point not found. Expected one of: ${commonEntries.join(', ')}` };
    }

    return { success: true };
  },

  /**
   * Adaptive Learning Feedback Logic
   * Converts a raw behavior score into a psychological state.
   */
  controlHints(cheatScore, attempts = 0) {
    const questions = [
        "What is the most challenging part of this implementation?",
        "How does your solution handle potential errors or edge cases?",
        "Explain the logic behind the data structure or algorithm you chose.",
        "If you had to optimize this further, what would you change?",
        "How do your changes interact with the existing system components?",
        "What design pattern (if any) did you apply here and why?",
        "Describe how you would test this specific piece of logic.",
        "What trade-offs did you make during this task?"
    ];
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

    if (cheatScore > 70) {
      return {
         action: 'restricted',
         label: 'Deep Understanding Required',
         color: '#f85149',
         maxHintLevel: 1, // Minimum help - explain first
         message: "Before we continue, I want to make sure you've mastered this approach. Please explain how your current code handles the core logic of this task.",
         question: randomQuestion
      };
    }
    
    if (cheatScore > 40 || attempts > 3) {
      return {
         action: 'suspicious',
         label: 'Active Learning Mode',
         color: '#f2cc60',
         maxHintLevel: 2, // Intermediate - Socratic help
         message: "You're making progress. Instead of giving the answer, I'll ask questions to help you find the logic yourself.",
         question: randomQuestion
      };
    }
    
    return { 
      action: 'normal',
      label: 'Learning Mode',
      color: '#3fb950',
      message: "Great work! I'm here if you need a specific hint or code review.",
      question: randomQuestion
    };
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

    // [MEMORY] Log the intent
    memoryService.updateLastAction(projectId, taskId, `Action Type: ${type}`);

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

    // ── TYPE: HINT (LADDER LOGIC) ───────────────────────────────────
    if (type === 'hint') {
      // 1. Anti-spam & Behavior Limits
      const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
      const recentCount = db.prepare('SELECT COUNT(*) as cnt FROM hint_requests WHERE user_id=? AND requested_at>?').get(userId, oneHourAgo);
      if (recentCount.cnt >= MAX_HINTS_PER_HOUR) {
        return { error: `Hint limit reached (${MAX_HINTS_PER_HOUR}/hr). Think deeper!`, passed: false };
      }

      // 2. Determine Next Ladder Level (L1 -> L4)
      const lastHint = db.prepare('SELECT level FROM hint_requests WHERE user_id=? AND task_id=? ORDER BY requested_at DESC LIMIT 1').get(userId, taskId);
      let nextLevel = (lastHint?.level || 0) + 1;
      if (nextLevel > 4) nextLevel = 4; // Caps at Full Solution

      // 3. Behavior Constraint (Restrict if cheating)
      if (directives.action === 'restricted' && nextLevel > 1) {
          return { error: "Behavior Restricted: You must explain your current logic before receiving more detailed hints.", passed: false };
      }

      // 4. Generate Hint via Task Engine
      const task = db.prepare('SELECT * FROM course_tasks WHERE id=?').get(taskId);
      const history = db.prepare('SELECT hint_text FROM hint_requests WHERE user_id=? AND task_id=?').all(userId, taskId).map(h => h.hint_text);
      
      const hintText = await TaskEngine.getHint(nextLevel, task, code || '', history);

      // 5. Record & Penalize
      db.prepare('INSERT INTO hint_requests (id, user_id, task_id, level, hint_text) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), userId, taskId, nextLevel, hintText);
      if (nextLevel >= 3) {
          db.prepare('UPDATE projects SET cheat_score = cheat_score + 5 WHERE id=?').run(projectId);
      }

      return {
        action: 'hint',
        hint: hintText,
        level: nextLevel,
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
        // [MEMORY] Record mastered concepts
        const taskConcepts = JSON.parse(task?.concepts_taught || '[]');
        taskConcepts.forEach(c => memoryService.markConceptLearned(projectId, c));
        memoryService.updateLastAction(projectId, taskId, `Mastered task & concepts: ${taskConcepts.join(', ')}`, null);

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

    // ── TYPE: CODE (AI VALIDATION ENGINE) ──────────────────────────
    if (type === 'code') {
      if (!code || code.trim().length === 0) {
        return { action: 'retry', feedback: [{ type: 'error', message: 'No code submitted.' }], passed: false, mentorMode };
      }

      const task = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(taskId)
                   || db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

      // 1. AI Behavioral & Logic Validation
      const project = tracker.getProject(projectId);
      const filePath = code.filePath || 'unknown'; // Frontend should provide this
      const val = await TaskEngine.validateTask(task, code, filePath, project);

      // 2. Record Result in QA History (for Error Memory)
      db.prepare(`
          INSERT INTO qa_reviews (id, task_id, passed, feedback, failed_checks)
          VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), taskId, val.success ? 1 : 0, val.feedback, JSON.stringify(val.failed_checks || []));

      if (val.success) {
        // [MEMORY] Lock state & move to explanation
        db.prepare(`UPDATE course_progress SET status = 'awaiting_explanation', attempts = attempts + 1, updated_at = datetime('now') WHERE project_id = ? AND task_id = ?`).run(projectId, taskId);
        memoryService.updateLastAction(projectId, taskId, `Validated logic for: ${task.title}`);

        return { 
          action: 'explain', 
          feedback: [{ type: 'success', message: val.feedback || 'Code validated! Now explain your logical approach.' }], 
          passed: false, 
          mentorMode 
        };
      } else {
        // 3. Handle Failure: Consistency & Pattern Detection
        const rawErrorMessage = val.failed_checks?.join(', ') || val.feedback || 'Logic requirements not met.';
        const errorHash = crypto.createHash('md5').update(rawErrorMessage.slice(0, 100)).digest('hex');
        
        memoryService.recordFailure(projectId, rawErrorMessage);
        
        const cp = db.prepare('SELECT failure_consistency FROM course_progress WHERE project_id = ? AND task_id = ?').get(projectId, taskId);
        const newCons = (cp?.failure_consistency || 0) + 1;

        db.prepare(`
            UPDATE course_progress SET attempts = attempts + 1, updated_at = datetime('now'), last_error_hash = ?, failure_consistency = ? 
            WHERE project_id = ? AND task_id = ?
        `).run(errorHash, newCons, projectId, taskId);

        // Targeted Scaffolding Logic
        let level = 1;
        if (newCons > 2) level = 2; // Provide slightly more help if repeating errors
        
        return { 
          action: 'retry', 
          feedback: [{ type: 'error', message: val.feedback }],
          failed_checks: val.failed_checks,
          isStuck: newCons > 2,
          passed: false, 
          mentorMode 
        };
      }
    }
  }
};

module.exports = learningController;

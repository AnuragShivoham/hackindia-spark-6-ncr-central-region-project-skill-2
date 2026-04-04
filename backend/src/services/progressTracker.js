const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

const j = v => JSON.stringify(v);
const p = v => { try { return JSON.parse(v); } catch { return v; } };
const now = () => new Date().toISOString();

function hydrateProject(row) {
  if (!row) return null;
  return { ...row, tech_stack: p(row.tech_stack), deliverables: p(row.deliverables), clarification_history: p(row.clarification_history) };
}
function hydrateTask(row) {
  if (!row) return null;
  return { ...row, commands: p(row.commands), folder_structure: p(row.folder_structure), concepts_taught: p(row.concepts_taught) };
}
function hydrateReview(row) {
  if (!row) return null;
  return { ...row, passed_checks: p(row.passed_checks), failed_checks: p(row.failed_checks), corrections: p(row.corrections) };
}

// USERS
function createUser(email, name, skillLevel) {
  const id = uuidv4();
  db.prepare('INSERT INTO users (id,email,name,skill_level) VALUES (?,?,?,?)').run(id, email, name, skillLevel || 'beginner');
  return db.prepare('SELECT * FROM users WHERE id=?').get(id);
}
function getUser(id)          { return db.prepare('SELECT * FROM users WHERE id=?').get(id); }
function getUserByEmail(email) { return db.prepare('SELECT * FROM users WHERE email=?').get(email); }
function setActiveProject(userId, projectId) { db.prepare('UPDATE users SET active_project_id=? WHERE id=?').run(projectId, userId); }

// PROJECTS
function createProject(userId, rawGoal) {
  const id = uuidv4();
  db.prepare('INSERT INTO projects (id,user_id,raw_goal) VALUES (?,?,?)').run(id, userId, rawGoal);
  return hydrateProject(db.prepare('SELECT * FROM projects WHERE id=?').get(id));
}
function getProject(id)       { return hydrateProject(db.prepare('SELECT * FROM projects WHERE id=?').get(id)); }
function getUserProjects(uid)  { return db.prepare('SELECT id,title,status,progress_pct,completed_tasks,total_tasks,created_at FROM projects WHERE user_id=? ORDER BY created_at DESC').all(uid); }

function activateProject(id, ex) {
  db.prepare(`UPDATE projects SET title=?,tech_stack=?,scope=?,deadline_days=?,skill_level=?,deliverables=?,status='active',updated_at=? WHERE id=?`)
    .run(ex.title, j(ex.tech_stack), ex.scope, ex.deadline_days, ex.skill_level, j(ex.deliverables), now(), id);
  return getProject(id);
}
function setClarification(id, history, round) {
  db.prepare('UPDATE projects SET clarification_history=?,clarification_round=?,updated_at=? WHERE id=?').run(j(history), round, now(), id);
}
function setCurrentPointers(projectId, milestoneId, taskId) {
  db.prepare('UPDATE projects SET current_milestone_id=?,current_task_id=?,updated_at=? WHERE id=?').run(milestoneId, taskId, now(), projectId);
}
function refreshProgress(projectId) {
  const mIds = db.prepare('SELECT id FROM milestones WHERE project_id=?').all(projectId).map(m => m.id);
  if (!mIds.length) return getProject(projectId);
  const ph = mIds.map(() => '?').join(',');
  const total     = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE milestone_id IN (${ph})`).get(...mIds)?.c || 0;
  const completed = db.prepare(`SELECT COUNT(*) as c FROM tasks WHERE milestone_id IN (${ph}) AND status='passed'`).get(...mIds)?.c || 0;
  const pct = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0;
  db.prepare('UPDATE projects SET total_tasks=?,completed_tasks=?,progress_pct=?,updated_at=? WHERE id=?').run(total, completed, pct, now(), projectId);
  return getProject(projectId);
}
function completeProject(id) {
  db.prepare("UPDATE projects SET status='completed',updated_at=? WHERE id=?").run(now(), id);
}

// MILESTONES
function createMilestone(projectId, m) {
  const id = uuidv4();
  db.prepare('INSERT INTO milestones (id,project_id,ord,title,description,duration_days,measurable_output) VALUES (?,?,?,?,?,?,?)')
    .run(id, projectId, m.order, m.title, m.description, m.duration_days, m.measurable_output);
  return db.prepare('SELECT * FROM milestones WHERE id=?').get(id);
}
function getMilestone(id)           { return db.prepare('SELECT * FROM milestones WHERE id=?').get(id); }
function getProjectMilestones(pid)  { return db.prepare('SELECT * FROM milestones WHERE project_id=? ORDER BY ord').all(pid); }
function unlockMilestone(id) {
  db.prepare("UPDATE milestones SET status='in_progress',started_at=? WHERE id=?").run(now(), id);
  return getMilestone(id);
}
function completeMilestone(id) {
  db.prepare("UPDATE milestones SET status='completed',completed_at=? WHERE id=?").run(now(), id);
  return getMilestone(id);
}
function getNextMilestone(projectId, currentOrd) {
  return db.prepare('SELECT * FROM milestones WHERE project_id=? AND ord=?').get(projectId, currentOrd + 1);
}

// TASKS
function createTask(milestoneId, t) {
  const id = uuidv4();
  db.prepare('INSERT INTO tasks (id,milestone_id,ord,day,title,description,estimated_hours,commands,folder_structure,starter_template,concepts_taught) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
    .run(id, milestoneId, t.order, t.day, t.title, t.description, t.estimated_hours,
         j(t.commands || []), j(t.folder_structure || {}), t.starter_template, j(t.concepts_taught || []));
  return hydrateTask(db.prepare('SELECT * FROM tasks WHERE id=?').get(id));
}
function getTask(id)              { return hydrateTask(db.prepare('SELECT * FROM tasks WHERE id=?').get(id)); }
function getMilestoneTasks(mid)   { return db.prepare('SELECT * FROM tasks WHERE milestone_id=? ORDER BY ord').all(mid).map(hydrateTask); }
function startTask(id) {
  db.prepare("UPDATE tasks SET status='in_progress',started_at=? WHERE id=?").run(now(), id);
  return getTask(id);
}
function submitTask(id, text) {
  db.prepare("UPDATE tasks SET status='submitted',submission_text=?,submitted_at=?,attempts=attempts+1 WHERE id=?").run(text, now(), id);
  return getTask(id);
}
function passTask(id) {
  db.prepare("UPDATE tasks SET status='passed',completed_at=? WHERE id=?").run(now(), id);
  return getTask(id);
}
function failTask(id) {
  db.prepare("UPDATE tasks SET status='failed' WHERE id=?").run(id);
  return getTask(id);
}
function getNextTask(milestoneId, currentOrd) {
  return hydrateTask(db.prepare('SELECT * FROM tasks WHERE milestone_id=? AND ord=?').get(milestoneId, currentOrd + 1));
}

// QA REVIEWS
function saveQAReview(taskId, r) {
  const id = uuidv4();
  db.prepare('INSERT INTO qa_reviews (id,task_id,attempt_number,verdict,score,passed_checks,failed_checks,corrections,feedback_text) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(id, taskId, r.attempt_number || 1, r.verdict, r.score || 0, j(r.passed_checks || []), j(r.failed_checks || []), j(r.corrections || []), r.feedback_text);
  return hydrateReview(db.prepare('SELECT * FROM qa_reviews WHERE id=?').get(id));
}

// AUTOMATIONS
function saveAutomations(projectId, milestoneId, suggestions) {
  return suggestions.map(s => {
    const id = uuidv4();
    db.prepare('INSERT INTO automation_suggestions (id,project_id,milestone_id,tool,description,script_snippet,benefit) VALUES (?,?,?,?,?,?,?)')
      .run(id, projectId, milestoneId, s.tool, s.description, s.script_snippet, s.benefit);
    return db.prepare('SELECT * FROM automation_suggestions WHERE id=?').get(id);
  });
}
function getProjectAutomations(pid) {
  return db.prepare('SELECT * FROM automation_suggestions WHERE project_id=? ORDER BY created_at').all(pid);
}

// CONVERSATION
function logTurn(projectId, role, content, contextType, taskId) {
  const id = uuidv4();
  db.prepare('INSERT INTO conversation_turns (id,project_id,task_id,role,content,context_type) VALUES (?,?,?,?,?,?)')
    .run(id, projectId, taskId || null, role, content, contextType || null);
}
function getConversation(projectId, userId, limit) {
  return db.prepare(`
    SELECT c.* FROM conversation_turns c
    JOIN projects p ON c.project_id = p.id
    WHERE c.project_id=? AND p.user_id=?
    ORDER BY c.created_at DESC LIMIT ?
  `).all(projectId, userId, limit || 100);
}
function getTaskConversation(taskId, limit) {
  return db.prepare('SELECT * FROM conversation_turns WHERE task_id=? ORDER BY created_at LIMIT ?').all(taskId, limit || 10);
}

// RESUME
function getResumeState(projectId) {
  const project = getProject(projectId);
  if (!project) return null;
  const milestone = project.current_milestone_id ? getMilestone(project.current_milestone_id) : null;
  const task      = project.current_task_id      ? getTask(project.current_task_id)            : null;
  return { project, milestone, task };
}

// DELETE
function deleteProject(projectId) {
  db.prepare(`DELETE FROM qa_reviews WHERE task_id IN (SELECT id FROM tasks WHERE milestone_id IN (SELECT id FROM milestones WHERE project_id=?))`).run(projectId);
  db.prepare('DELETE FROM automation_suggestions WHERE project_id=?').run(projectId);
  db.prepare('DELETE FROM conversation_turns WHERE project_id=?').run(projectId);
  db.prepare('DELETE FROM workspace_files WHERE project_id=?').run(projectId);
  db.prepare('DELETE FROM command_logs WHERE project_id=?').run(projectId);
  db.prepare('DELETE FROM progress_snapshots WHERE project_id=?').run(projectId);
  
  db.prepare(`DELETE FROM tasks WHERE milestone_id IN (SELECT id FROM milestones WHERE project_id=?)`).run(projectId);
  db.prepare('DELETE FROM milestones WHERE project_id=?').run(projectId);
  db.prepare('DELETE FROM projects WHERE id=?').run(projectId);
}

module.exports = {
  createUser, getUser, getUserByEmail, setActiveProject,
  createProject, getProject, getUserProjects, activateProject, setClarification,
  setCurrentPointers, refreshProgress, completeProject,
  createMilestone, getMilestone, getProjectMilestones, unlockMilestone, completeMilestone, getNextMilestone,
  createTask, getTask, getMilestoneTasks, startTask, submitTask, passTask, failTask, getNextTask,
  saveQAReview,
  saveAutomations, getProjectAutomations,
  logTurn, getConversation, getTaskConversation,
  getResumeState,
  deleteProject,
};

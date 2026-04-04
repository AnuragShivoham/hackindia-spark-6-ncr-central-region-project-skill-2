const express = require('express');
const router  = express.Router();
const config  = require('../config');
const tracker = require('../services/progressTracker');
const goalClarifier     = require('../engines/goalClarifier');
const milestoneGenerator = require('../engines/milestoneGenerator');
const taskPlanner       = require('../engines/taskPlanner');
const courseService     = require('../services/courseService');
const guidedExecution   = require('../engines/guidedExecution');
const qaCritic          = require('../engines/qaCritic');
const automationAdvisor = require('../engines/automationAdvisor');
const WorkspaceService  = require('../services/workspaceService');
const learningController = require('../engines/learningController');
const auth = require('../middleware/auth');
const db = require('../db/database');
const crypto = require('crypto');

const wrap = fn => (req, res, next) => fn(req, res, next).catch(e => {
  console.error('[Route Error]', e.message);
  res.status(500).json({ error: e.message });
});

// ── INTERNAL: activate project + generate plan ────────────────────────────────
// ── INTERNAL: generate milestones (Step 2) ──────────────────────────────────
async function generateMilestones(res, project, extracted) {
  // Save extracted details temporarily or transition to 'planning'
  // Map NEW schema to OLD DB fields
  const title = extracted.title || project.raw_goal;
  const stack = JSON.stringify(extracted.stack || extracted.tech_stack || []);
  const scope = extracted.scope || "";
  const days  = extracted.time || extracted.deadline_days || 7;
  const level = extracted.skill || extracted.skill_level || 'beginner';
  const feats = JSON.stringify(extracted.features || extracted.deliverables || []);

  db.prepare(`UPDATE projects SET title=?,tech_stack=?,scope=?,deadline_days=?,skill_level=?,deliverables=?,status='planning' WHERE id=?`)
    .run(title, stack, scope, days, level, feats, project.id);

  const planData = await milestoneGenerator.generateMilestones(extracted);
  const milestones = planData.milestones || planData;
  const reasoning = planData.reasoning || 'Milestones generated. Please review and confirm your plan.';
  
  res.json({
    action: 'milestones_generated',
    message: reasoning,
    project: tracker.getProject(project.id),
    milestones
  });
}

// ── INTERNAL: finalize activation (Step 3) ──────────────────────────────────
async function finalizeActivation(res, projectId, confirmedMilestones) {
  let project = tracker.getProject(projectId);
  if (!project) throw new Error('Project not found');

  // Insert milestones — normalize AI-generated objects (they have no 'order' field)
  const mObjs = confirmedMilestones.map((m, i) => tracker.createMilestone(project.id, { ...m, order: m.order ?? m.ord ?? (i + 1) }));

  // Activate & setup first task
  const first = mObjs[0];
  tracker.unlockMilestone(first.id);

  const ctx = { tech_stack: project.tech_stack, skill_level: project.skill_level, scope: project.scope };
  const tData = await taskPlanner.generateTasks(
    { order: first.ord, title: first.title, description: first.description, duration_days: first.duration_days, measurable_output: first.measurable_output },
    ctx
  );
  const tObjs = tData.map((t, i) => tracker.createTask(first.id, { ...t, order: t.order ?? t.ord ?? (i + 1), day: t.day ?? 1 }));

  tracker.setCurrentPointers(project.id, first.id, tObjs[0]?.id || null);
  db.prepare("UPDATE projects SET status='active' WHERE id=?").run(project.id);
  project = tracker.refreshProgress(project.id);

  tracker.logTurn(project.id, 'mentor', `Project initialized. Start with: ${first.title}`, 'task_guidance');

  res.json({
    action: 'plan_ready',
    message: `Project '${project.title}' is now active!`,
    project,
    milestones: tracker.getProjectMilestones(project.id),
    task: tObjs[0] || null,
  });
}


// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────
router.post('/users', wrap(async (req, res) => {
  const { email, name, skill_level = 'beginner' } = req.body;
  if (!email || !name) return res.status(400).json({ error: 'email and name required' });
  if (tracker.getUserByEmail(email)) return res.status(409).json({ error: 'Email already registered' });
  res.status(201).json(tracker.createUser(email, name, skill_level));
}));

router.get('/users/:id', wrap(async (req, res) => {
  const u = tracker.getUser(req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  res.json(u);
}));

// ─────────────────────────────────────────────────────────────────────────────
// GOAL SUBMISSION + CLARIFICATION
// ─────────────────────────────────────────────────────────────────────────────
router.post('/goals/submit', wrap(async (req, res) => {
  const { raw_goal } = req.body;
  const user_id = req.user.id;
  if (!raw_goal) return res.status(400).json({ error: 'raw_goal required' });
  if (!tracker.getUser(user_id)) return res.status(404).json({ error: 'User not found' });

  const result = await goalClarifier.clarifyGoal(raw_goal);

  if (result.status === 'rejected') {
    return res.json({ action: 'rejected', message: `Goal rejected: ${result.reason}` });
  }

  const project = tracker.createProject(user_id, raw_goal);
  tracker.logTurn(project.id, 'user', raw_goal, 'clarification');

  if (result.status === 'needs_refinement' || result.refinement_options) {
    return res.status(201).json({ 
      action: 'refine', 
      message: "This goal is broad. Select a specific model to proceed:", 
      project: tracker.getProject(project.id), 
      options: result.refinement_options || []
    });
  }

  if (result.status === 'needs_clarification' || result.questions) {
    db.prepare("UPDATE projects SET status='clarifying' WHERE id=?").run(project.id);
    return res.status(201).json({ 
      action: 'clarify', 
      message: result.confirmation_text || "Identifying discovery questions...", 
      project: tracker.getProject(project.id), 
      questions: result.questions || []
    });
  }

  if (result.status === 'needs_setup' || result.missing) {
    tracker.setClarification(project.id, [{ missing: result.missing, extracted: result.extracted }], 1);
    return res.status(201).json({ 
      action: 'setup', 
      message: result.confirmation_text || "Analyzing project requirements...", 
      project: tracker.getProject(project.id), 
      missing: result.missing,
      extracted: result.extracted
    });
  }

  if (result.status === 'clear') {
    return await generateMilestones(res, project, result.extracted || result);
  }

  await generateMilestones(res, project, result);
}));



router.post('/goals/clarify', wrap(async (req, res) => {
  const { project_id, answers } = req.body;
  if (!project_id || !answers) return res.status(400).json({ error: 'project_id and answers required' });

  const project = tracker.getProject(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  if (project.status !== 'clarifying') return res.status(400).json({ error: 'Project is not in clarifying state' });
  if (project.clarification_round >= config.MAX_CLARIFY_ROUNDS) {
    return res.status(400).json({ error: 'Max clarification rounds reached. Resubmit with a more specific goal.' });
  }

  const history = Array.isArray(project.clarification_history) ? project.clarification_history : [];
  history.push({ answers });
  tracker.setClarification(project_id, history, project.clarification_round + 1);
  tracker.logTurn(project_id, 'user', JSON.stringify(answers), 'clarification');

  const result = await goalClarifier.clarifyGoal(project.raw_goal, history);

  if (result.status === 'rejected') {
    return res.json({ action: 'rejected', message: `Rejected: ${result.reason}` });
  }
  if (result.status === 'needs_clarification' || result.questions) {
    history.push({ questions: result.questions });
    tracker.setClarification(project_id, history, project.clarification_round + 1);
    return res.json({ 
      action: 'clarify', 
      message: result.confirmation_text || "Refining project setup...", 
      project: tracker.getProject(project_id), 
      questions: result.questions
    });
  }

  if (result.status === 'needs_setup' || result.missing) {
    history.push({ missing: result.missing, extracted: result.extracted });
    tracker.setClarification(project_id, history, project.clarification_round + 1);
    return res.json({ 
      action: 'setup', 
      message: result.confirmation_text || "Refining project setup...", 
      project: tracker.getProject(project_id), 
      missing: result.missing,
      extracted: result.extracted
    });
  }

  if (result.status === 'clear') {
    return await generateMilestones(res, project, result.extracted || result);
  }

  await generateMilestones(res, tracker.getProject(project_id), result);
}));


router.post('/goals/confirm', wrap(async (req, res) => {
  const { project_id, milestones } = req.body;
  if (!project_id || !milestones) return res.status(400).json({ error: 'project_id and milestones required' });
  await finalizeActivation(res, project_id, milestones);
}));

router.post('/goals/adjust', wrap(async (req, res) => {
  const { project_id, type, value } = req.body;
  const project = tracker.getProject(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  
  const db = require('../db/database');
  if (type === 'time') {
    db.prepare(`UPDATE projects SET deadline_days=? WHERE id=?`).run(value, project.id);
  } else if (type === 'difficulty') {
    db.prepare(`UPDATE projects SET skill_level=? WHERE id=?`).run(value, project.id);
  } else if (type === 'add_feature') {
    let feats = project.deliverables || [];
    if (!feats.includes(value)) feats.push(value);
    db.prepare(`UPDATE projects SET deliverables=? WHERE id=?`).run(JSON.stringify(feats), project.id);
  } else if (type === 'remove_feature') {
    let feats = project.deliverables || [];
    feats = feats.filter(f => f !== value);
    db.prepare(`UPDATE projects SET deliverables=? WHERE id=?`).run(JSON.stringify(feats), project.id);
  }

  const updatedProject = tracker.getProject(project_id);
  const extracted = {
    title: updatedProject.title,
    stack: updatedProject.tech_stack,
    scope: updatedProject.scope,
    time: updatedProject.deadline_days,
    skill: updatedProject.skill_level,
    features: updatedProject.deliverables
  };

  const planData = await milestoneGenerator.generateMilestones(extracted);
  const milestones = planData.milestones || planData;
  res.json({ action: 'milestones_generated', message: planData.reasoning || 'Plan adjusted successfully.', project: updatedProject, milestones });
}));

router.post('/goals/regenerate', wrap(async (req, res) => {
  const { project_id } = req.body;
  const project = tracker.getProject(project_id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  const extracted = {
    title: project.title,
    stack: project.tech_stack,
    scope: project.scope,
    time: project.deadline_days,
    skill: project.skill_level,
    features: project.deliverables
  };

  const planData = await milestoneGenerator.generateMilestones(extracted);
  const milestones = planData.milestones || planData;
  res.json({ action: 'milestones_generated', message: planData.reasoning || 'Plan regenerated successfully.', project, milestones });
}));


// ─────────────────────────────────────────────────────────────────────────────
// COURSE ENGINE ROUTES (V2)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/courses', wrap(async (req, res) => {
  const courses = courseService.getActiveCourses();
  res.json(courses);
}));

router.get('/courses/:id', wrap(async (req, res) => {
  const structure = courseService.getCourseFullStructure(req.params.id);
  if (!structure || !structure.course || !structure.course.is_active) {
    return res.status(404).json({ error: 'Course inactive or not found' });
  }
  res.json(structure);
}));

router.post('/marketplace/:id/start', wrap(async (req, res) => {
  const marketplaceId = req.params.id;
  const db = require('../db/database');
  
  // 1. Check if it's an Official Course
  const courseInfo = courseService.getCourse(marketplaceId);
  if (courseInfo && courseInfo.is_active) {
    const { v4: uuidv4 } = require('uuid');
    const projId = uuidv4();
    db.prepare(`
      INSERT INTO projects (id, user_id, title, raw_goal, course_id, is_course, course_version, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
    `).run(projId, req.user.id, courseInfo.title, `Course: ${courseInfo.title}`, courseInfo.id, 1, courseInfo.version);
    
    // Physical setup
    WorkspaceService.createProjectWorkspace(projId);
    WorkspaceService.initializeProjectStructure(projId, 'nodejs');
    tracker.setActiveProject(req.user.id, projId);
    return res.json({ success: true, project_id: projId });
  }

  // 2. Check if it's a Community Project Idea
  const communityProj = db.prepare('SELECT * FROM community_projects WHERE id = ? AND status = ?').get(marketplaceId, 'approved');
  if (communityProj) {
    const p = tracker.createProject(req.user.id, communityProj.description);
    db.prepare('UPDATE projects SET title = ?, tech_stack = ?, skill_level = ?, deliverables = ?, status = ? WHERE id = ?')
      .run(communityProj.title, communityProj.tech_stack, communityProj.difficulty, communityProj.final_outcome, 'planning', p.id);
    
    // Auto-generate milestones immediately
    const extracted = {
      title: communityProj.title,
      stack: JSON.parse(communityProj.tech_stack || '[]'),
      scope: communityProj.description,
      time: communityProj.estimated_hours / 8, // hours to days
      skill: communityProj.difficulty,
      features: [communityProj.final_outcome]
    };
    
    const planData = await milestoneGenerator.generateMilestones(extracted);
    const milestones = planData.milestones || planData;
    
    // Finalize and Activate automatically
    await finalizeActivation(res, p.id, milestones);
    return; // finalizeActivation sends the response
  }

  res.status(404).json({ error: 'Project not found in marketplace' });
}));

router.post('/courses/tasks/:id/submit', wrap(async (req, res) => {
  const courseTaskId = req.params.id;
  const { projectId } = req.body; // Need to know which session to check

  const project = tracker.getProject(projectId);
  if (!project || project.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  if (!project.is_course) return res.status(400).json({ error: 'Not a course project' });

  // Get source-of-truth task rule
  const db = require('../db/database');
  const courseTask = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(courseTaskId);
  if (!courseTask) return res.status(404).json({ error: 'Task missing' });

  const WorkspaceService = require('../services/workspaceService');
  const workspacePath = WorkspaceService.getWorkspacePath(projectId);

  // BYPASS QA CRITIC -> Static Sandbox Eval
  const result = courseService.validateStaticTask(courseTask, workspacePath);

  // User table = progress only (Upsert into course_progress)
  // Ensure attempt counts increment safely
  db.prepare(`
    INSERT INTO course_progress (id, project_id, task_id, status, attempts, completed_at)
    VALUES (?, ?, ?, ?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET 
      attempts = attempts + 1,
      status = excluded.status,
      completed_at = excluded.completed_at
  `).run(
    require('uuid').v4(), 
    projectId, 
    courseTaskId, 
    result.passed ? 'passed' : 'failed', 
    result.passed ? new Date().toISOString() : null
  );

  res.json({
    verdict: result.passed ? 'pass' : 'fail',
    feedback: result.passed ? 'Excellent work! Everything looks correct.' : result.hint,
    corrections: [] // No AI suggestions mapped
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// BEHAVIOR & SCAFFOLDING (V2 ENGINE)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/courses/behavior/log', auth, wrap(async (req, res) => {
  const learningController = require('../engines/learningController');
  const { taskId, pasteSize, typingSpeed, attempts, timeSpent } = req.body;
  if (!taskId) return res.status(400).json({ error: 'Missing course task context' });
  
  const result = learningController.analyzeBehavior(req.user.id, { taskId, pasteSize, typingSpeed, attempts, timeSpent });
  res.json(result); 
}));

router.get('/courses/tasks/:id/scaffold', auth, wrap(async (req, res) => {
  const learningController = require('../engines/learningController');
  const courseTaskId = req.params.id;
  const db = require('../db/database');
  
  // 1. (BEST) Derive Active Project explicitly from immutable User session state (No timestamp guesswork)
  const userRow = db.prepare('SELECT active_project_id FROM users WHERE id = ?').get(req.user.id);
  
  if (!userRow || !userRow.active_project_id) {
     return res.status(403).json({ error: 'Access denied: No active course project found for user' });
  }
  const projectId = userRow.active_project_id;
  
  let progressData = { attempts: 0, last_scaffold_level: 1 };
  const pRow = db.prepare('SELECT attempts, last_scaffold_level FROM course_progress WHERE task_id = ? AND project_id = ?').get(courseTaskId, projectId);
  if (pRow) progressData = pRow;
  
  const behaviorData = db.prepare('SELECT cheat_score FROM behavior_logs WHERE user_id = ? AND task_id = ? ORDER BY created_at DESC LIMIT 1').get(req.user.id, courseTaskId) || { cheat_score: 0 };
  
  const payload = learningController.controlScaffold(req.user.id, courseTaskId, true, projectId, progressData, behaviorData);
  res.json(payload);
}));

// ─────────────────────────────────────────────────────────────────────────────
// PROJECTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/projects/latest', wrap(async (req, res) => {
  const userId = req.user.id;
  const user = tracker.getUser(userId);
  let latestId = user.active_project_id;
  
  if (!latestId) {
    const projects = tracker.getUserProjects(userId);
    if (!projects || projects.length === 0) return res.json({ project: null });
    latestId = projects[0].id;
  }
  
  const state = tracker.getResumeState(latestId);
  if (!state || !state.project || state.project.user_id !== userId) return res.json({ project: null });

  const { project } = state;
  if (project.status === 'planning') {
    const extracted = {
        title: project.title,
        stack: project.tech_stack,
        scope: project.scope,
        time: project.deadline_days,
        skill: project.skill_level,
        features: project.deliverables
    };
    const planData = await milestoneGenerator.generateMilestones(extracted);
    const milestones = planData.milestones || planData;
    return res.json({
        action: 'milestones_generated',
        message: 'Resuming your project plan...',
        project,
        milestones
    });
  }

  res.json({
    action: 'task_guidance',
    project: state.project,
    task: state.task,
    milestones: tracker.getProjectMilestones(latestId),
    conversation: tracker.getConversation(latestId, userId, 100),
  });
}));

router.get('/projects/:id', wrap(async (req, res) => {
  if (req.params.id === 'latest') return; 
  const p = tracker.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  
  const projectOwner = db.prepare('SELECT role FROM users WHERE id = ?').get(p.user_id);
  const isOwner = p.user_id === req.user.id;
  const isMentorOwner = projectOwner?.role === 'mentor';
  const isReqMentor = req.user.role === 'mentor';
  
  if (!isOwner && !isMentorOwner && !isReqMentor) {
      return res.status(403).json({ error: 'Access denied' });
  }
  res.json(p);
}));

router.get('/users/:id/projects', wrap(async (req, res) => {
  if (req.params.id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  res.json(tracker.getUserProjects(req.params.id));
}));

router.get('/projects/:id/resume', wrap(async (req, res) => {
  const state = tracker.getResumeState(req.params.id);
  if (!state) return res.status(404).json({ error: 'Project not found' });
  
  const { project } = state;
  let { milestone, task } = state;
  const projectOwner = db.prepare('SELECT role FROM users WHERE id = ?').get(project.user_id);
  const isOwner = project.user_id === req.user.id;
  const isMentorOwner = projectOwner?.role === 'mentor';
  const isReqMentor = req.user.role === 'mentor';
  
  if (!isOwner && !isMentorOwner && !isReqMentor) {
    return res.status(403).json({ error: 'Access denied' });
  }

  tracker.setActiveProject(req.user.id, project.id);

  // PLANNING STATE: Regenerate plan if not confirmed
  if (project.status === 'planning') {
    const extracted = {
        title: project.title,
        stack: project.tech_stack,
        scope: project.scope,
        time: project.deadline_days,
        skill: project.skill_level,
        features: project.deliverables
    };
    const planData = await milestoneGenerator.generateMilestones(extracted);
    const milestones = planData.milestones || planData;
    return res.json({
        action: 'milestones_generated',
        message: 'Resuming your project plan...',
        project,
        milestones
    });
  }

  // COURSE PROJECT: Fetch from course_milestones + course_tasks
  if (project.is_course && project.course_id) {
    const courseMilestones = db.prepare('SELECT * FROM course_milestones WHERE course_id = ? ORDER BY position ASC').all(project.course_id);
    const courseTasks = db.prepare('SELECT * FROM course_tasks WHERE course_id = ? ORDER BY position ASC').all(project.course_id);
    const progressList = db.prepare('SELECT * FROM course_progress WHERE project_id = ?').all(project.id);
    
    // Format milestones like V1 format
    const milestones = courseMilestones.map((cm, i) => {
      const mTasks = courseTasks.filter(t => t.milestone_id === cm.id);
      const mProgress = mTasks.map(t => progressList.find(p => p.task_id === t.id));
      const allDone = mTasks.length > 0 && mTasks.every(t => {
        const prog = progressList.find(p => p.task_id === t.id);
        return prog && prog.status === 'completed';
      });
      const anyStarted = mTasks.some(t => {
        const prog = progressList.find(p => p.task_id === t.id);
        return prog && ['in_progress', 'completed'].includes(prog.status);
      });
      
      return {
        id: cm.id,
        project_id: project.id,
        ord: cm.position || (i + 1),
        title: cm.title,
        description: cm.description || '',
        duration_days: cm.duration_days || 7,
        measurable_output: '',
        status: allDone ? 'completed' : (i === 0 || anyStarted) ? 'in_progress' : 'locked'
      };
    });

    // Format tasks like V1 format + find current task
    let currentTask = null;
    const formattedTasks = courseTasks.map(ct => {
      const prog = progressList.find(p => p.task_id === ct.id);
      const status = prog?.status || 'pending';
      
      const t = {
        id: ct.id,
        milestone_id: ct.milestone_id,
        ord: ct.position || 1,
        day: 1,
        title: ct.title,
        description: ct.description || ct.goal || '',
        estimated_hours: (ct.estimated_minutes || 30) / 60,
        commands: JSON.parse(ct.commands || '[]'),
        folder_structure: JSON.parse(ct.folder_structure || '{}'),
        starter_template: ct.starter_template || '',
        concepts_taught: JSON.parse(ct.concepts || '[]'),
        status: status === 'completed' ? 'passed' : status,
        attempts: prog?.attempts || 0
      };

      // First non-completed task = current task
      if (!currentTask && status !== 'completed') {
        currentTask = t;
      }
      return t;
    });

    // Compute progress
    const totalTasks = formattedTasks.length;
    const completedTasks = formattedTasks.filter(t => t.status === 'passed').length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 1000) / 10 : 0;

    // Enrich project with progress
    project.total_tasks = totalTasks;
    project.completed_tasks = completedTasks;
    project.progress_pct = progressPct;
    project.title = project.title || project.raw_goal;

    return res.json({
      action: 'task_guidance',
      message: `Resuming '${project.title}' — ${progressPct}% (${completedTasks}/${totalTasks} tasks)\nCurrent: ${currentTask?.title || 'All done'}`,
      project,
      task: currentTask,
      milestones,
      conversation: tracker.getConversation(project.id, req.user.id, 100),
    });
  }

  // V1 LEGACY PROJECT
  res.json({
    action: 'task_guidance',
    message: `Resuming '${project.title}' — ${project.progress_pct}% (${project.completed_tasks}/${project.total_tasks} tasks)\nCurrent: ${milestone?.title || 'N/A'} › ${task?.title || 'All done'}`,
    project,
    task,
    milestones: tracker.getProjectMilestones(project.id),
    conversation: tracker.getConversation(project.id, req.user.id, 100),
  });
}));

router.delete('/projects/:id', wrap(async (req, res) => {
  const p = tracker.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  if (p.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });

  tracker.deleteProject(p.id);
  try {
    WorkspaceService.deleteProjectWorkspace(p.id);
  } catch (e) {
    console.error('[Delete Error] Workspace cleanup failed:', e.message);
  }
  res.json({ success: true });
}));

router.get('/projects/:id/milestones', wrap(async (req, res) => {
  const p = tracker.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  
  const projectOwner = db.prepare('SELECT role FROM users WHERE id = ?').get(p.user_id);
  const isOwner = p.user_id === req.user.id;
  const isMentorOwner = projectOwner?.role === 'mentor';
  const isReqMentor = req.user.role === 'mentor';
  
  if (!isOwner && !isMentorOwner && !isReqMentor) return res.status(403).json({ error: 'Access denied' });

  if (p.is_course && p.course_id) {
    const courseMilestones = db.prepare('SELECT * FROM course_milestones WHERE course_id = ? ORDER BY position ASC').all(p.course_id);
    const courseTasks = db.prepare('SELECT * FROM course_tasks WHERE course_id = ? ORDER BY position ASC').all(p.course_id);
    const progressList = db.prepare('SELECT * FROM course_progress WHERE project_id = ?').all(p.id);
    
    const milestones = courseMilestones.map((cm, i) => {
      const mTasks = courseTasks.filter(t => t.milestone_id === cm.id);
      const allDone = mTasks.length > 0 && mTasks.every(t => {
        const prog = progressList.find(p => p.task_id === t.id);
        return prog && prog.status === 'completed';
      });
      const anyStarted = mTasks.some(t => {
        const prog = progressList.find(p => p.task_id === t.id);
        return prog && ['in_progress', 'completed'].includes(prog.status);
      });
      
      return {
        id: cm.id,
        project_id: p.id,
        ord: cm.position || (i + 1),
        title: cm.title,
        description: cm.description || '',
        duration_days: cm.duration_days || 7,
        status: allDone ? 'completed' : (i === 0 || anyStarted) ? 'in_progress' : 'locked'
      };
    });
    return res.json(milestones);
  }

  res.json(tracker.getProjectMilestones(req.params.id));
}));

router.get('/projects/:id/conversation', wrap(async (req, res) => {
  const p = tracker.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  
  const projectOwner = db.prepare('SELECT role FROM users WHERE id = ?').get(p.user_id);
  const isOwner = p.user_id === req.user.id;
  const isMentorOwner = projectOwner?.role === 'mentor';
  const isReqMentor = req.user.role === 'mentor';
  
  if (!isOwner && !isMentorOwner && !isReqMentor) return res.status(403).json({ error: 'Access denied' });
  res.json(tracker.getConversation(req.params.id, req.user.id, 100));
}));

router.get('/projects/:id/automations', wrap(async (req, res) => {
  const p = tracker.getProject(req.params.id);
  if (!p) return res.status(404).json({ error: 'Project not found' });
  if (p.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
  res.json(tracker.getProjectAutomations(req.params.id));
}));

// ─────────────────────────────────────────────────────────────────────────────
// TASKS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/milestones/:id/tasks', wrap(async (req, res) => {
  // Check if this is a V2 Course Milestone
  const cm = db.prepare('SELECT * FROM course_milestones WHERE id = ?').get(req.params.id);
  if (cm) {
    const userRow = db.prepare('SELECT active_project_id FROM users WHERE id = ?').get(req.user.id);
    const projectId = userRow?.active_project_id;
    const courseTasks = db.prepare('SELECT * FROM course_tasks WHERE milestone_id = ? ORDER BY position ASC').all(req.params.id);
    const progressList = projectId ? db.prepare('SELECT * FROM course_progress WHERE project_id = ?').all(projectId) : [];

    const tasks = courseTasks.map(ct => {
      const prog = progressList.find(p => p.task_id === ct.id);
      return {
        id: ct.id,
        milestone_id: ct.milestone_id,
        ord: ct.position || 1,
        title: ct.title,
        description: ct.description || ct.goal || '',
        estimated_hours: (ct.estimated_minutes || 30) / 60,
        concepts_taught: JSON.parse(ct.concepts || '[]'),
        status: prog?.status === 'completed' ? 'passed' : (prog?.status || 'pending'),
        attempts: prog?.attempts || 0
      };
    });
    return res.json(tasks);
  }
  
  res.json(tracker.getMilestoneTasks(req.params.id));
}));

router.get('/tasks/:id', wrap(async (req, res) => {
  const ct = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(req.params.id);
  if (ct) {
    const userRow = db.prepare('SELECT active_project_id FROM users WHERE id = ?').get(req.user.id);
    const projectId = userRow?.active_project_id;
    const prog = projectId ? db.prepare('SELECT * FROM course_progress WHERE project_id = ? AND task_id = ?').get(projectId, ct.id) : null;
    
    return res.json({
      id: ct.id,
      milestone_id: ct.milestone_id,
      ord: ct.position || 1,
      title: ct.title,
      description: ct.description || ct.goal || '',
      estimated_hours: (ct.estimated_minutes || 30) / 60,
      commands: JSON.parse(ct.commands || '[]'),
      folder_structure: JSON.parse(ct.folder_structure || '{}'),
      starter_template: ct.starter_template || '',
      concepts_taught: JSON.parse(ct.concepts || '[]'),
      status: prog?.status === 'completed' ? 'passed' : (prog?.status || 'pending'),
      attempts: prog?.attempts || 0
    });
  }

  const t = tracker.getTask(req.params.id);
  if (!t) return res.status(404).json({ error: 'Task not found' });
  res.json(t);
}));

router.post('/tasks/:id/start', wrap(async (req, res) => {
  const taskId = req.params.id;
  const courseTask = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(taskId);
  
  if (courseTask) {
      // Prioritize req.body.projectId (from dashboard), fallback to active_project_id (last active)
      let projectId = req.body.projectId;
      if (!projectId) {
          const userRow = db.prepare('SELECT active_project_id FROM users WHERE id = ?').get(req.user.id);
          projectId = userRow?.active_project_id;
      }
      
      if (!projectId) return res.status(400).json({ error: 'Missing projectId' });

      // [MEMORY] Sync current task and last action
      const memoryService = require('../services/memoryService');
      memoryService.updateLastAction(projectId, courseTask.id, `Starting task: ${courseTask.title}`);

      // [PHASE 11] Progression Lock
      const incompletePrev = db.prepare(`
          SELECT ct.title FROM course_tasks ct
          LEFT JOIN course_progress cp ON cp.task_id = ct.id AND cp.project_id = ?
          WHERE ct.course_id = ? AND ct.position < ? AND (cp.status IS NULL OR cp.status != 'completed')
          LIMIT 1
      `).get(projectId, courseTask.course_id, courseTask.position);

      if (incompletePrev) {
          return res.status(403).json({ 
              error: 'Progression Lock', 
              message: `Wait up! You haven't mastered "${incompletePrev.title}" yet. Focus on that first to ensure a solid foundation.`,
              unlock_required: incompletePrev.title
          });
      }

      if (prog && !['pending', 'failed'].includes(prog.status)) {
          return res.status(400).json({ error: `Cannot start task with status: ${prog.status}` });
      }

      if (prog) {
          db.prepare("UPDATE course_progress SET status = ?, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run('in_progress', prog.id);
      } else {
          db.prepare(`
              INSERT INTO course_progress (id, project_id, task_id, status, attempts, started_at, updated_at)
              VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `).run(crypto.randomUUID(), projectId, courseTask.id, 'in_progress', 1);
      }

      const updatedTask = {
          ...courseTask,
          commands: JSON.parse(courseTask.commands || '[]'),
          concepts_taught: JSON.parse(courseTask.concepts || '[]'),
          folder_structure: JSON.parse(courseTask.folder_structure || '{}'),
          status: 'in_progress',
          attempts: prog ? prog.attempts : 1,
          estimated_hours: (courseTask.estimated_minutes || 30) / 60
      };
      
      const cmds = updatedTask.commands.map(c => `  $ ${c}`).join('\n');
      return res.json({ 
          action: 'task_guidance', 
          message: `Task started: ${updatedTask.title}\nEst: ${updatedTask.estimated_hours}h\n\nRun:\n${cmds}`, 
          task: updatedTask 
      });
  }

  // V1 Legacy Fallback
  const task = tracker.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!['pending','failed','submitted'].includes(task.status)) return res.status(400).json({ error: `Cannot start task with status: ${task.status}` });
  const updated = tracker.startTask(task.id);
  const cmds = (updated.commands || []).map(c => `  $ ${c}`).join('\n');
  res.json({ action: 'task_guidance', message: `Task started: ${updated.title}\nEst: ${updated.estimated_hours}h\n\nRun:\n${cmds}`, task: updated });
}));

router.post('/tasks/:id/hint', wrap(async (req, res) => {
  const taskId = req.params.id;
  const courseTask = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(taskId);
  
  if (courseTask) {
    const result = await learningController.processSubmission(req.user.id, taskId, { type: 'hint' });
    return res.json({ action: 'task_guidance', message: result.scaffold, task: courseTask });
  }

  const task = tracker.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  const hint = await guidedExecution.getHint(task, task.attempts || 1);
  const ms = tracker.getMilestone(task.milestone_id);
  if (ms) tracker.logTurn(ms.project_id, 'mentor', hint, 'task_guidance', task.id);
  res.json({ action: 'task_guidance', message: hint, task });
}));

router.post('/tasks/:id/ask', wrap(async (req, res) => {
  const { question, activeFileContent, activeFilePath, image, context } = req.body;
  const taskId = req.params.id;
  if (!question && !image) return res.status(400).json({ error: 'question or image required' });

  const courseTask = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(taskId);
  if (courseTask) {
    const userRow = db.prepare('SELECT active_project_id FROM users WHERE id = ?').get(req.user.id);
    const projectId = userRow?.active_project_id;
    if (!projectId) return res.status(403).json({ error: 'No active project' });

    const p = tracker.getProject(projectId);
    const milestones = tracker.getProjectMilestones(p.id); // Or course milestones?
    const history = tracker.getTaskConversation(taskId, 10).map(t => ({ role: t.role, content: t.content }));
    const treeNodes = []; // Could populate via WorkspaceService
    
    // Pass behavioral mode (normal/suspicious/restricted)
    const guidance = await guidedExecution.getGuidance(courseTask, question || 'Help me with this task.', history, activeFileContent, activeFilePath, p, milestones, treeNodes, image, context?.mode);
    tracker.logTurn(p.id, 'user', question, 'task_guidance', taskId);
    tracker.logTurn(p.id, 'mentor', guidance, 'task_guidance', taskId);
    return res.json({ action: 'task_guidance', message: guidance, task: courseTask });
  }

  const task = tracker.getTask(taskId);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  
  const ms = tracker.getMilestone(task.milestone_id);
  const project = ms ? tracker.getProject(ms.project_id) : null;
  const milestones = project ? tracker.getProjectMilestones(project.id) : [];
  const history = tracker.getTaskConversation(task.id, 10).map(t => ({ role: t.role, content: t.content }));
  let treeNodes = [];
  try { if (project) treeNodes = WorkspaceService.listFiles(project.id); } catch(e) {}
  
  const guidance = await guidedExecution.getGuidance(task, question || 'Analyze this screenshot and help me fix the error.', history, activeFileContent, activeFilePath, project, milestones, treeNodes, image, context?.mode);
  
  if (project) {
    tracker.logTurn(project.id, 'user',   question, 'task_guidance', task.id);
    tracker.logTurn(project.id, 'mentor', guidance, 'task_guidance', task.id);
  }
  res.json({ action: 'task_guidance', message: guidance, task });
}));

router.get('/projects/:id/progress', wrap(async (req, res) => {
  const projectId = req.params.id;
  const memoryService = require('../services/memoryService');
  
  const project = tracker.getProject(projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const milestones = tracker.getProjectMilestones(projectId);
  const memory = memoryService.getMemory(projectId);
  const currentTaskId = project.current_task_id;
  
  // 1. Current Focus: Deep Analysis
  let currentFocus = { title: "Initializing...", status: "pending", missing: [] };
  if (currentTaskId) {
    const taskData = db.prepare(`
        SELECT ct.title, cp.status, cp.attempts 
        FROM course_tasks ct
        JOIN course_progress cp ON cp.task_id = ct.id
        WHERE cp.project_id = ? AND ct.id = ?
    `).get(projectId, currentTaskId);
    
    if (taskData) {
      // Analyze history to find "missing pieces" from latest review
      const latestReview = db.prepare(`
        SELECT failed_checks FROM qa_reviews 
        WHERE task_id = ? ORDER BY created_at DESC LIMIT 1
      `).get(currentTaskId);
      
      const missing = latestReview ? JSON.parse(latestReview.failed_checks || '[]') : ["Implementation details pending"];

      currentFocus = {
        title: taskData.title,
        status: taskData.status,
        attempts: taskData.attempts,
        missing: missing.slice(0, 3) 
      };
    }
  }

  // 2. Timeline with Unlock Conditions
  const timeline = milestones.map(m => {
    const isCompleted = m.status === 'completed';
    const conditions = !isCompleted ? db.prepare(`
        SELECT title FROM course_tasks ct
        JOIN course_progress cp ON cp.task_id = ct.id
        WHERE ct.milestone_id = ? AND cp.project_id = ? AND cp.status != 'completed'
    `).all(m.id, projectId).map(c => c.title) : [];

    return {
      id: m.id,
      title: m.title,
      status: m.status,
      unlockConditions: conditions.slice(0, 2)
    };
  });

  // 3. Skill Map with Action Triggers
  const failures = memory ? memory.failures : {};
  const skills = (memory ? memory.concepts : []).map(c => {
    const errorCount = failures[c] || 0;
    const reason = memoryService.getSkillReason(c, failures);
    
    let level = 'Strong';
    let action = 'Mastered';
    if (errorCount > 2) { level = 'Medium'; action = 'Strengthen implementation pattern'; }
    if (errorCount > 5) { level = 'Weak'; action = 'Redo logic without hints next time'; }
    
    return { name: c, level, reason, action };
  });

  // 4. Error Memory (Pattern Awareness)
  const allRecentFailures = db.prepare(`
    SELECT failed_checks FROM qa_reviews q
    JOIN course_progress cp ON q.task_id = cp.task_id
    WHERE cp.project_id = ? ORDER BY q.created_at DESC LIMIT 10
  `).all(projectId);
  
  const patternCounts = {};
  allRecentFailures.forEach(f => {
    const checks = JSON.parse(f.failed_checks || '[]');
    checks.forEach(check => patternCounts[check] = (patternCounts[check] || 0) + 1);
  });
  
  const errorMemory = Object.entries(patternCounts)
    .filter(([_, count]) => count >= 2)
    .sort((a,b) => b[1] - a[1])
    .map(([name, count]) => `${name} (${count} times)`)
    .slice(0, 2);

  // 5. Behavior Directives (Active Intervention)
  let behaviorMode = 'Active Learning';
  let directive = 'Keep following current flow';
  
  const cheat_score = project.cheat_score || 0;
  if (cheat_score > 60) {
    behaviorMode = 'Restricted (High Paste)';
    directive = 'Implement next 2 functions manually without external code';
  } else if (cheat_score > 30) {
    behaviorMode = 'Guided Enhancement';
    directive = 'Refine logic independently before requesting review';
  }

  // 6. Atomic Next Actions
  let atomicNext = ["Open your primary file", "Focus on current technical goal"];
  if (currentTaskId) {
    atomicNext = [
      `Complete ${currentFocus.title}`,
      `Verify ${currentFocus.missing[0] || 'logic'}`,
      "Run local tests"
    ];
  }

  // 7. Stuck Detection Suggestion
  const progRow = db.prepare('SELECT failure_consistency FROM course_progress WHERE project_id = ? AND task_id = ?').get(projectId, currentTaskId);
  const isStuck = (progRow?.failure_consistency || 0) > 2;
  const stuckSuggestion = isStuck 
    ? `Break task into smaller pieces: first implement ${currentFocus.missing[0] || 'skeleton'}`
    : null;

  res.json({
    currentFocus,
    timeline,
    skills,
    errorMemory,
    behaviorMode: { status: behaviorMode, directive },
    nextActionItems: atomicNext,
    isStuck,
    stuckSuggestion
  });
}));

router.get('/projects/:id/memory', wrap(async (req, res) => {
  const memoryService = require('../services/memoryService');
  const memory = memoryService.getMemory(req.params.id);
  res.json(memory || { project_id: req.params.id, concepts: [], failures: {}, last_action: 'None' });
}));

router.post('/projects/:id/ask', wrap(async (req, res) => {
  const { question, activeFileContent, activeFilePath, image } = req.body;
  if (!question && !image) return res.status(400).json({ error: 'question or image required' });
  const project = tracker.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const milestones = tracker.getProjectMilestones(project.id);
  const history = tracker.getConversation(project.id, req.user.id, 10).map(t => ({ role: t.role, content: t.content })).reverse();
  
  let treeNodes = [];
  try { treeNodes = WorkspaceService.listFiles(project.id); } catch(e) {}

  const guidance = await guidedExecution.getGuidance(null, question || 'Analyze this screenshot and help me fix the error.', history, activeFileContent, activeFilePath, project, milestones, treeNodes, image);
  
  tracker.logTurn(project.id, 'user',   question, 'general_guidance');
  tracker.logTurn(project.id, 'mentor', guidance, 'general_guidance');
  
  res.json({ action: 'general_guidance', message: guidance });
}));

router.post('/projects/:id/execute/run', wrap(async (req, res) => {
  const executionService = require('../services/executionService');
  const project = tracker.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const check = await learningController.preRunCheck(project.id);
  if (!check.success) return res.json({ action: 'block', reason: check.reason });

  const pType = executionService.getProjectType(project);
  const command = executionService.getCommand(pType);

  res.json({ action: 'run', command, projectType: pType });
}));

router.get('/projects/:id/execute/test', wrap(async (req, res) => {
  const executionService = require('../services/executionService');
  const project = tracker.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const pType = executionService.getProjectType(project);
  const instructions = executionService.getTestingInstructions(pType, project.current_task_id);
  res.json(instructions);
}));

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 9: UNIFIED LEARNING + MARKETPLACE
// ─────────────────────────────────────────────────────────────────────────────

// GET /projects/active — single source of truth (uses active_project_id)
router.get('/projects/active', wrap(async (req, res) => {
  const user = db.prepare('SELECT active_project_id FROM users WHERE id = ?').get(req.user.id);
  if (!user || !user.active_project_id) {
    return res.json({ project: null });
  }
  const project = tracker.getProject(user.active_project_id);
  if (!project) return res.json({ project: null });
  
  let currentTaskId = project.current_task_id;

  if (project.is_course) {
    const courseService = require('../services/courseService');
    const structure = courseService.getCourseFullStructure(project.course_id, project.course_version || 1);
    const progressList = db.prepare('SELECT * FROM course_progress WHERE project_id = ?').all(project.id);
    
    if (structure && structure.milestones) {
        for (const m of structure.milestones) {
            const mTasks = structure.tasks.filter(t => t.milestone_id === m.id);
            const pending = mTasks.find(t => {
                const prog = progressList.find(p => p.task_id === t.id);
                return !prog || prog.status !== 'completed';
            });
            if (pending) {
                currentTaskId = pending.id;
                break;
            }
        }
    }
  } else if (!currentTaskId) {
    const milestones = tracker.getProjectMilestones(project.id);
    for (const m of milestones) {
        const tasks = tracker.getMilestoneTasks(m.id);
        const pending = tasks.find(t => t.status !== 'completed');
        if (pending) { currentTaskId = pending.id; break; }
    }
  }

  res.json({
    projectId: project.id,
    is_course: !!project.is_course,
    current_task_id: currentTaskId,
    mode: 'self' // DEFAULT
  });
}));

// GET /tasks/current - modular task loader
router.get('/tasks/current', wrap(async (req, res) => {
    const projectId = req.query.projectId;
    const taskId = req.query.taskId;
    
    if (!projectId || !taskId) return res.status(400).json({ error: 'Missing projectId or taskId' });

    const p = tracker.getProject(projectId);
    if (!p) return res.status(404).json({ error: 'Project not found' });

    let task = null;
    let progressStatus = 'pending';
    if (p.is_course) {
        task = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(taskId);
        const prog = db.prepare('SELECT status FROM course_progress WHERE project_id = ? AND task_id = ?').get(projectId, taskId);
        if (prog) progressStatus = prog.status;
    } else {
        task = tracker.getTask(taskId);
        if (task) progressStatus = task.status || 'pending';
    }

    if (!task) return res.status(404).json({ error: 'Task not found' });

    res.json({
        taskId: task.id,
        title: task.title,
        description: task.description,
        expected: task.expected_output || task.measurable_output,
        hints: task.hints ? (Array.isArray(task.hints) ? task.hints : JSON.parse(task.hints)) : [],
        starter_template: task.starter_template || '',
        progress_status: progressStatus
    });
}));

// POST /learning/process — unified endpoint (code/hint/explain)
router.post('/learning/process', wrap(async (req, res) => {
  const { type = 'code', code, explanation, taskId } = req.body;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });
  
  const validTypes = ['code', 'hint', 'explain'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `Invalid type. Must be: ${validTypes.join(', ')}` });
  }

  const result = await learningController.processSubmission(req.user.id, taskId, { type, code, explanation });
  res.json(result);
}));

// GET /marketplace — browse approved projects only
router.get('/marketplace', wrap(async (req, res) => {
  const { q, difficulty } = req.query;
  
  // Official projects (from courses table)
  let officialQuery = "SELECT id, title, description, tech_stack, difficulty, 'official' as source FROM courses WHERE is_active = 1";
  const officialProjects = db.prepare(officialQuery).all() || [];
  
  // Community projects (approved only — CRITICAL SECURITY)
  let communityQuery = `SELECT id, title, description, tech_stack, difficulty, estimated_hours, 'community' as source FROM community_projects WHERE status = 'approved'`;
  const communityProjects = db.prepare(communityQuery).all() || [];

  let allProjects = [
    ...officialProjects.map(p => ({ ...p, badge: 'official' })),
    ...communityProjects.map(p => ({ ...p, badge: 'community' }))
  ];

  // Filter by search query
  if (q) {
    const query = q.toLowerCase();
    allProjects = allProjects.filter(p => 
      p.title.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
    );
  }

  // Filter by difficulty
  if (difficulty && difficulty !== 'all') {
    allProjects = allProjects.filter(p => p.difficulty === difficulty);
  }

  res.json({ projects: allProjects });
}));

// POST /projects/community/submit — submit project idea for review
router.post('/projects/community/submit', wrap(async (req, res) => {
  const { title, description, tech_stack, difficulty, final_outcome, estimated_hours } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ error: 'title and description are required' });
  }
  if (title.length < 5 || description.length < 20) {
    return res.status(400).json({ error: 'Title must be 5+ chars, description 20+ chars' });
  }

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO community_projects (id, user_id, title, description, tech_stack, difficulty, final_outcome, estimated_hours)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, title, description, JSON.stringify(tech_stack || []), difficulty || 'intermediate', final_outcome || '', estimated_hours || 10);

  res.json({ success: true, id, message: 'Project submitted for review. It will appear in the marketplace after approval.' });
}));

// ─────────────────────────────────────────────────────────────────────────────
// TASK SUBMISSION + QA
// ─────────────────────────────────────────────────────────────────────────────
router.post('/tasks/submit', wrap(async (req, res) => {
  const { task_id, submission_text } = req.body;
  if (!task_id || !submission_text) return res.status(400).json({ error: 'task_id and submission_text required' });

  let task = tracker.getTask(task_id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (!['in_progress','failed','submitted'].includes(task.status)) {
    return res.status(400).json({ error: `Cannot submit task with status: ${task.status}` });
  }

  task = tracker.submitTask(task_id, submission_text);
  const milestone = tracker.getMilestone(task.milestone_id);
  const project   = tracker.getProject(milestone.project_id);

  let treeNodes = [];
  try { if (project) treeNodes = WorkspaceService.listFiles(project.id); } catch(e) {}

  const qaResult = await qaCritic.reviewSubmission(task, submission_text, task.attempts, treeNodes);
  const review   = tracker.saveQAReview(task_id, qaResult);

  tracker.logTurn(project.id, 'user',   submission_text,       'qa_feedback', task_id);
  tracker.logTurn(project.id, 'mentor', qaResult.feedback_text,'qa_feedback', task_id);

  const passed = ['pass','partial'].includes(qaResult.verdict) && (qaResult.score || 0) >= config.QA_PASS_SCORE;

  if (!passed) {
    tracker.failTask(task_id);
    return res.json({ action: 'qa_result', message: qaResult.feedback_text, qa_review: review, task: tracker.getTask(task_id) });
  }

  // PASSED
  tracker.passTask(task_id);
  tracker.refreshProgress(project.id);

  const allTasks  = tracker.getMilestoneTasks(milestone.id);
  const allPassed = allTasks.every(t => t.status === 'passed');

  if (allPassed) {
    tracker.completeMilestone(milestone.id);

    // Automation suggestions
    let automations = [];
    try {
      const suggestions = await automationAdvisor.getAutomationSuggestions(
        { tech_stack: project.tech_stack, scope: project.scope },
        milestone,
        allTasks.map(t => t.title)
      );
      automations = tracker.saveAutomations(project.id, milestone.id, suggestions);
    } catch (e) { console.warn('[Automation skipped]', e.message); }

    const nextMs = tracker.getNextMilestone(project.id, milestone.ord);
    if (!nextMs) {
      tracker.completeProject(project.id);
      return res.json({ action: 'project_complete', message: `Project '${project.title}' completed. All milestones passed.`, project: tracker.getProject(project.id), qa_review: review, automations });
    }

    // Unlock next milestone + generate its tasks
    tracker.unlockMilestone(nextMs.id);
    const ctx = { tech_stack: project.tech_stack, skill_level: project.skill_level, scope: project.scope };
    const newTData = await taskPlanner.generateTasks(
      { order: nextMs.ord, title: nextMs.title, description: nextMs.description, duration_days: nextMs.duration_days, measurable_output: nextMs.measurable_output },
      ctx
    );
    const newTasks = newTData.map(t => tracker.createTask(nextMs.id, t));
    tracker.setCurrentPointers(project.id, nextMs.id, newTasks[0]?.id || null);
    tracker.refreshProgress(project.id);

    return res.json({
      action: 'milestone_complete',
      message: `Milestone '${milestone.title}' complete. Next: ${nextMs.title}`,
      project: tracker.getProject(project.id),
      qa_review: review,
      next_task: newTasks[0] || null,
      milestones: tracker.getProjectMilestones(project.id),
      automations,
    });
  }

  // Next task in same milestone
  const nextTask = tracker.getNextTask(milestone.id, task.ord);
  if (nextTask) tracker.setCurrentPointers(project.id, milestone.id, nextTask.id);

  res.json({
    action: 'task_guidance',
    message: qaResult.feedback_text,
    project: tracker.refreshProgress(project.id),
    qa_review: review,
    next_task: nextTask || null,
  });
}));

// ================= INTERVENTION ENGINE =================

// GET /mentor/queue (Priority Sorted Intervention Queue)
router.get('/mentor/queue', wrap(async (req, res) => {
    const userRole = req.user?.role || db.prepare("SELECT role FROM users WHERE id = ?").get(req.user?.id || 'TEST_USER')?.role;
    if (userRole !== 'mentor') return res.status(403).json({ error: 'Mentors only.' });

    // Grab all active stuck sessions
    const pendingTasks = db.prepare(`
        SELECT cp.*, u.name as studentName, u.id as studentId, ct.title as taskTitle, ct.file_path, 
               (julianday('now') - julianday(cp.started_at)) * 24 * 60 as timeStuckMinutes,
               (SELECT SUM(cheat_score) FROM behavior_logs WHERE task_id = cp.task_id AND user_id = cp.user_id) as totalCheatScore
        FROM course_progress cp
        JOIN users u ON cp.user_id = u.id
        JOIN course_tasks ct ON cp.task_id = ct.id
        WHERE cp.status IN ('pending', 'awaiting_explanation')
        AND (cp.attempts >= 2 OR cp.help_requested > 0)
        AND cp.active_mentor_id IS NULL
    `).all();

    const queue = pendingTasks.map(pt => {
        const timeStuck = Math.max(pt.timeStuckMinutes || 0, 0);
        const cheatScore = pt.totalCheatScore || 0;
        const failureConsistency = pt.failure_consistency || 0;
        
        // Priority Score with anti-gaming checks
        const priority = (pt.attempts * 1.5) + (timeStuck / 120) + (cheatScore * 0.7) + (failureConsistency * 2);
        
        return {
            projectId: pt.project_id,
            taskId: pt.task_id,
            studentName: pt.studentName,
            studentId: pt.studentId,
            currentTask: pt.taskTitle,
            filePath: pt.file_path,
            attempts: pt.attempts,
            timeStuck: Math.round(timeStuck),
            cheatScore,
            priority,
            helpRequested: pt.help_requested > 0
        };
    }).sort((a, b) => b.priority - a.priority);

    res.json(queue);
}));

// GET /session/context/:projectId (Context Preview before joining)
const workspaceService = require('../services/workspaceService');
router.get('/session/context/:projectId', wrap(async (req, res) => {
    const { projectId } = req.params;
    
    // Quick snapshot DB details
    const p = db.prepare('SELECT cp.*, ct.file_path FROM course_progress cp JOIN course_tasks ct ON cp.task_id = ct.id WHERE cp.project_id = ?').get(projectId);
    if (!p) return res.status(404).json({ error: 'Context not found.' });

    // Context Sanitization + Truncation limits exposure
    let codeSnapshot = '';
    try {
        if (p.file_path) {
            codeSnapshot = workspaceService.readFile(projectId, p.file_path);
            if (codeSnapshot.length > 50000) {
                codeSnapshot = codeSnapshot.substring(0, 50000) + '\n\n// TRUNCATED: File size exceeded bounds.';
            }
            codeSnapshot = codeSnapshot.replace(/(password|secret|bearer\s+|token\s*=).*?/gi, '$1 ***REDACTED***'); // Minimal sanitation
        }
    } catch(e) { /* ignore */ }

    // Last Feedback Limits
    const chat = db.prepare('SELECT content FROM chat_history WHERE project_id = ? ORDER BY created_at DESC LIMIT 3').all();
    
    // Abstracted Summary logic
    let summaryLayer = { "issue": "Unknown", "pattern": "Stuck Trial Phase", "attempts": p.attempts };
    if (chat.length > 0) {
         summaryLayer.issue = chat[0].content.substring(0, 60);
         if (p.failure_consistency > 2) summaryLayer.pattern = "Repeating the same syntactic error.";
    }

    res.json({
        projectId,
        codeSnapshot,
        recentFeedback: chat.map(c => c.content),
        summary: summaryLayer,
        attempts: p.attempts,
        lastScaffoldLevel: p.last_scaffold_level
    });
}));

// POST /mentor/join (Lock the session)
router.post('/mentor/join', wrap(async (req, res) => {
    const { projectId } = req.body;
    const userId = req.user?.id || 'TEST_USER';
    
    // OCC Update Race Condition Defense
    const r = db.prepare(`UPDATE course_progress SET active_mentor_id = ?, interventions_count = interventions_count + 1 WHERE project_id = ? AND active_mentor_id IS NULL`).run(userId, projectId);
    
    if (r.changes === 0) {
        return res.status(400).json({ error: 'SESSION_ALREADY_LOCKED' }); // UI catches this natively
    }
    
    // Post-Live Success Outcome Tracking Start: Log interaction ID? (We use interventions_count)
    res.json({ success: true, message: 'Session locked.' });
}));

// POST /task/help (Student flags themselves manually)
router.post('/task/help', wrap(async (req, res) => {
    const { projectId } = req.body;
    
    // Check cooldown to prevent queue flooding
    const p = db.prepare('SELECT help_requested, last_help_request FROM course_progress WHERE project_id = ?').get(projectId);
    if (!p) return res.status(404).json({ error: 'Progress not found' });
    
    if (p.help_requested >= 2) {
        return res.status(400).json({ error: 'You have reached the maximum SOS requests (2) for this task.' });
    }
    
    if (p.last_help_request) {
        const diffMs = Date.now() - new Date(p.last_help_request).getTime();
        if (diffMs < 5 * 60 * 1000) {
            return res.status(429).json({ error: 'Please wait 5 minutes before spamming SOS again.' });
        }
    }

    db.prepare(`UPDATE course_progress SET help_requested = help_requested + 1, last_help_request = datetime('now') WHERE project_id = ?`).run(projectId);
    res.json({ success: true, message: 'Help requested! A mentor has been pinged.' });
}));

// POST /mentor/leave (Unlock the session, drop to guided)
router.post('/mentor/leave', wrap(async (req, res) => {
    const { projectId } = req.body;
    const userId = req.user?.id || 'TEST_USER';
    
    // Clear lock only if owned
    const r = db.prepare(`UPDATE course_progress SET active_mentor_id = NULL, help_requested = 0 WHERE project_id = ? AND active_mentor_id = ?`).run(projectId, userId);
    
    if (r.changes === 0) {
        return res.status(400).json({ error: 'You do not own this session lock.' });
    }

    // Post-Live Learning Block: Force Explanation AGAIN
    db.prepare('INSERT INTO chat_history (project_id, user_id, content, created_at) VALUES (?, ?, ?, ?)').run(
        projectId, userId, 'MENTOR DEPARTED. You must now hit "Run Code" and definitively EXPLAIN what was just implemented to unlock the task.', Date.now()
    );

    res.json({ success: true, message: 'Session unlocked. Dropping to guided mode. Explanation enforced.' });
}));

// ================= COURSE BUILDER (MENTOR) =================

const mentorOnly = (req, res, next) => {
  const role = req.user?.role || db.prepare('SELECT role FROM users WHERE id = ?').get(req.user?.id)?.role;
  if (role !== 'mentor') return res.status(403).json({ error: 'Mentor access required.' });
  next();
};

// POST /builder/course — create a new course draft
router.post('/builder/course', mentorOnly, wrap(async (req, res) => {
  const { title, description, tech_stack, difficulty, estimated_hours, learning_outcome } = req.body;
  if (!title || title.length < 3) return res.status(400).json({ error: 'Title must be at least 3 characters.' });
  if (!description || description.length < 20) return res.status(400).json({ error: 'Description must be at least 20 characters.' });

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO courses (id, title, description, tech_stack, difficulty, estimated_hours, learning_outcome, creator_id, status, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 0)
  `).run(id, title, description, JSON.stringify(tech_stack || []), difficulty || 'beginner', estimated_hours || 10, learning_outcome || '', req.user.id);

  res.json({ success: true, course_id: id });
}));

// PUT /builder/course/:id — update course metadata
router.put('/builder/course/:id', mentorOnly, wrap(async (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND creator_id = ?').get(req.params.id, req.user.id);
  if (!course) return res.status(404).json({ error: 'Course not found or not yours.' });
  if (course.status === 'published') return res.status(400).json({ error: 'Cannot edit a published course. Create a new version.' });

  const { title, description, tech_stack, difficulty, estimated_hours, learning_outcome } = req.body;
  db.prepare(`
    UPDATE courses SET title = ?, description = ?, tech_stack = ?, difficulty = ?, estimated_hours = ?, learning_outcome = ?
    WHERE id = ?
  `).run(title || course.title, description || course.description, JSON.stringify(tech_stack || JSON.parse(course.tech_stack || '[]')),
    difficulty || course.difficulty, estimated_hours || course.estimated_hours, learning_outcome || course.learning_outcome, course.id);

  res.json({ success: true });
}));

// GET /builder/course/:id — get full course structure (for editing)
router.get('/builder/course/:id', mentorOnly, wrap(async (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND creator_id = ?').get(req.params.id, req.user.id);
  if (!course) return res.status(404).json({ error: 'Course not found or not yours.' });

  const milestones = db.prepare('SELECT * FROM course_milestones WHERE course_id = ? ORDER BY position ASC').all(course.id);
  const tasks = db.prepare('SELECT * FROM course_tasks WHERE course_id = ? ORDER BY position ASC').all(course.id);

  res.json({ course, milestones, tasks });
}));

// GET /builder/courses — list mentor's courses
router.get('/builder/courses', mentorOnly, wrap(async (req, res) => {
  const courses = db.prepare('SELECT * FROM courses WHERE creator_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(courses);
}));

// POST /builder/course/:id/milestone — add milestone
router.post('/builder/course/:id/milestone', mentorOnly, wrap(async (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND creator_id = ?').get(req.params.id, req.user.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const { title, description, duration_days } = req.body;
  if (!title || title.length < 2) return res.status(400).json({ error: 'Milestone title required.' });

  const maxPos = db.prepare('SELECT MAX(position) as mx FROM course_milestones WHERE course_id = ?').get(course.id);
  const position = (maxPos?.mx || 0) + 1;

  const id = crypto.randomUUID();
  db.prepare('INSERT INTO course_milestones (id, course_id, title, description, duration_days, position) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, course.id, title, description || '', duration_days || 7, position
  );
  res.json({ success: true, milestone_id: id, position });
}));

// PUT /builder/milestone/:id — update milestone
router.put('/builder/milestone/:id', mentorOnly, wrap(async (req, res) => {
  const ms = db.prepare('SELECT cm.*, c.creator_id FROM course_milestones cm JOIN courses c ON cm.course_id = c.id WHERE cm.id = ?').get(req.params.id);
  if (!ms || ms.creator_id !== req.user.id) return res.status(404).json({ error: 'Not found.' });

  const { title, description, duration_days } = req.body;
  db.prepare('UPDATE course_milestones SET title = ?, description = ?, duration_days = ? WHERE id = ?').run(
    title || ms.title, description || ms.description, duration_days || ms.duration_days, ms.id
  );
  res.json({ success: true });
}));

// DELETE /builder/milestone/:id
router.delete('/builder/milestone/:id', mentorOnly, wrap(async (req, res) => {
  const ms = db.prepare('SELECT cm.*, c.creator_id FROM course_milestones cm JOIN courses c ON cm.course_id = c.id WHERE cm.id = ?').get(req.params.id);
  if (!ms || ms.creator_id !== req.user.id) return res.status(404).json({ error: 'Not found.' });

  db.prepare('DELETE FROM course_tasks WHERE milestone_id = ?').run(ms.id);
  db.prepare('DELETE FROM course_milestones WHERE id = ?').run(ms.id);
  res.json({ success: true });
}));

// POST /builder/milestone/:id/task — add task (STRICT SCHEMA)
router.post('/builder/milestone/:id/task', mentorOnly, wrap(async (req, res) => {
  const ms = db.prepare('SELECT cm.*, c.creator_id, c.id as cid FROM course_milestones cm JOIN courses c ON cm.course_id = c.id WHERE cm.id = ?').get(req.params.id);
  if (!ms || ms.creator_id !== req.user.id) return res.status(404).json({ error: 'Not found.' });

  const { title, goal, description, concepts, steps, starter_template, validation_type, validation_rules, hints, difficulty, file_path, commands, folder_structure, estimated_minutes } = req.body;

  // SCHEMA ENFORCEMENT
  if (!title || title.length < 3) return res.status(400).json({ error: 'Task title required (3+ chars).' });
  if (!goal || goal.length < 5) return res.status(400).json({ error: 'Task goal required (5+ chars).' });
  if (!steps || !Array.isArray(steps) || steps.length === 0) return res.status(400).json({ error: 'At least 1 step required.' });
  if (!validation_type || !['static', 'regex', 'custom', 'file_exists', 'contains'].includes(validation_type)) {
    return res.status(400).json({ error: 'validation_type required: static | regex | custom | file_exists | contains' });
  }

  const maxPos = db.prepare('SELECT MAX(position) as mx FROM course_tasks WHERE milestone_id = ?').get(ms.id);
  const position = (maxPos?.mx || 0) + 1;

  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO course_tasks (id, course_id, milestone_id, title, goal, description, concepts, steps, starter_template, validation_type, validation_rules, hints, difficulty, file_path, commands, folder_structure, estimated_minutes, position)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, ms.cid, ms.id, title, goal, description || '',
    JSON.stringify(concepts || []),
    JSON.stringify(steps),
    starter_template || '',
    validation_type,
    JSON.stringify(validation_rules || {}),
    JSON.stringify(hints || []),
    difficulty || 'easy',
    file_path || '',
    JSON.stringify(commands || []),
    JSON.stringify(folder_structure || {}),
    estimated_minutes || 30,
    position
  );
  res.json({ success: true, task_id: id, position });
}));

// PUT /builder/task/:id — update task
router.put('/builder/task/:id', mentorOnly, wrap(async (req, res) => {
  const t = db.prepare('SELECT ct.*, c.creator_id FROM course_tasks ct JOIN courses c ON ct.course_id = c.id WHERE ct.id = ?').get(req.params.id);
  if (!t || t.creator_id !== req.user.id) return res.status(404).json({ error: 'Not found.' });

  const { title, goal, description, concepts, steps, starter_template, validation_type, validation_rules, hints, difficulty, file_path, commands, folder_structure, estimated_minutes } = req.body;
  db.prepare(`
    UPDATE course_tasks SET title = ?, goal = ?, description = ?, concepts = ?, steps = ?, starter_template = ?,
    validation_type = ?, validation_rules = ?, hints = ?, difficulty = ?, file_path = ?, commands = ?,
    folder_structure = ?, estimated_minutes = ? WHERE id = ?
  `).run(
    title || t.title, goal || t.goal, description || t.description,
    JSON.stringify(concepts || JSON.parse(t.concepts || '[]')),
    JSON.stringify(steps || JSON.parse(t.steps || '[]')),
    starter_template !== undefined ? starter_template : t.starter_template,
    validation_type || t.validation_type,
    JSON.stringify(validation_rules || JSON.parse(t.validation_rules || '{}')),
    JSON.stringify(hints || JSON.parse(t.hints || '[]')),
    difficulty || t.difficulty,
    file_path !== undefined ? file_path : t.file_path,
    JSON.stringify(commands || JSON.parse(t.commands || '[]')),
    JSON.stringify(folder_structure || JSON.parse(t.folder_structure || '{}')),
    estimated_minutes || t.estimated_minutes,
    t.id
  );
  res.json({ success: true });
}));

// DELETE /builder/task/:id
router.delete('/builder/task/:id', mentorOnly, wrap(async (req, res) => {
  const t = db.prepare('SELECT ct.*, c.creator_id FROM course_tasks ct JOIN courses c ON ct.course_id = c.id WHERE ct.id = ?').get(req.params.id);
  if (!t || t.creator_id !== req.user.id) return res.status(404).json({ error: 'Not found.' });

  db.prepare('DELETE FROM course_tasks WHERE id = ?').run(t.id);
  res.json({ success: true });
}));

// POST /builder/course/:id/publish — publish to marketplace
router.post('/builder/course/:id/publish', mentorOnly, wrap(async (req, res) => {
  const course = db.prepare('SELECT * FROM courses WHERE id = ? AND creator_id = ?').get(req.params.id, req.user.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  // VALIDATION: Must have milestones + tasks
  const milestones = db.prepare('SELECT * FROM course_milestones WHERE course_id = ?').all(course.id);
  if (milestones.length === 0) return res.status(400).json({ error: 'Add at least 1 milestone before publishing.' });

  const tasks = db.prepare('SELECT * FROM course_tasks WHERE course_id = ?').all(course.id);
  if (tasks.length === 0) return res.status(400).json({ error: 'Add at least 1 task before publishing.' });

  // Check every task has validation
  const invalidTasks = tasks.filter(t => !t.validation_type);
  if (invalidTasks.length > 0) return res.status(400).json({ error: `${invalidTasks.length} task(s) missing validation rules. All tasks must have validation.` });

  db.prepare('UPDATE courses SET status = ?, is_active = 1 WHERE id = ?').run('published', course.id);
  res.json({ success: true, message: 'Course published to marketplace!' });
}));

router.post('/debug/log', (req, res) => {
  console.log('[BROWSER-LOG]', JSON.stringify(req.body, null, 2));
  res.json({ ok: true });
});

module.exports = router;





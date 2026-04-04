const BASE = '/api/v1';
async function req(method, path, body) {
  const token = localStorage.getItem('ab_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  console.log(`[API] ${method} ${path}`, body || '');
  const r = await fetch(`${BASE}${path}`, opts);
  
  let d = {};
  const contentType = r.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      d = await r.json();
    } catch (e) {
      console.error('[API] Failed to parse JSON:', e);
    }
  } else {
    // Non-JSON response (e.g., error page)
    const text = await r.text();
    if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
  }

  if (!r.ok) {
    if (r.status === 401) {
      localStorage.removeItem('ab_token');
      window.location.href = '/login';
    }
    console.error(`[API ERROR] ${method} ${path} -> ${r.status}`, d);
    throw new Error(d.error || `HTTP ${r.status}`);
  }
  return d;
}
const get = p => req('GET', p);
const post = (p, b) => req('POST', p, b);
export const api = {
  createUser: (email, name, skill_level) => post('/users', { email, name, skill_level }),
  getUser: (id) => get(`/users/${id}`),
  submitGoal: (uid, rg) => post('/goals/submit', { user_id: uid, raw_goal: rg }),
  clarifyGoal: (pid, ans) => post('/goals/clarify', { project_id: pid, answers: ans }),
  confirmProjectPlan: (pid, milestones) => post('/goals/confirm', { project_id: pid, milestones }),
  adjustPlan: (pid, type, value) => post('/goals/adjust', { project_id: pid, type, value }),
  regeneratePlan: (pid) => post('/goals/regenerate', { project_id: pid }),
  getProject: (id) => get(`/projects/${id}`),

  getLatestProject: () => get('/projects/latest'),
  debugLog: (data) => post('/debug/log', data),
  getUserProjects: (uid) => get(`/users/${uid}/projects`),
  resumeProject: (id) => get(`/projects/${id}/resume`),
  deleteProject: (id) => req('DELETE', `/projects/${id}`),
  getMilestones: (pid) => get(`/projects/${pid}/milestones`),
  getConversation: (pid) => get(`/projects/${pid}/conversation`),
  getAutomations: (pid) => get(`/projects/${pid}/automations`),
  getMilestoneTasks: (mid) => get(`/milestones/${mid}/tasks`),
  getTask: (id) => get(`/tasks/${id}`),
  startTask: (id, projectId) => post(`/tasks/${id}/start`, { projectId }),
  getHint: (id) => post(`/tasks/${id}/hint`),
  askQuestion: (id, q, content, path, image) => post(`/tasks/${id}/ask`, { question: q, activeFileContent: content, activeFilePath: path, image }),
  askProjectQuestion: (id, q, content, path, image) => post(`/projects/${id}/ask`, { question: q, activeFileContent: content, activeFilePath: path, image }),
  submitTask: (tid, txt) => post('/tasks/submit', { task_id: tid, submission_text: txt }),
  getFsTree: (projectId) => get(`/fs/tree?projectId=${projectId}`),
  getFile: (path, projectId) => get(`/fs/file?path=${encodeURIComponent(path)}&projectId=${projectId}`),
  saveFile: (path, contents, projectId) => post('/fs/file', { path, content: contents, projectId }),
  uploadFile: (path, content, encoding, projectId) => post('/fs/upload', { path, content, encoding, projectId }),
  createFile: (path, projectId) => post('/fs/touch', { path, projectId }),
  createFolder: (path, projectId) => post('/fs/mkdir', { path, projectId }),
  deleteFile: (path, projectId) => req('DELETE', `/fs/file?path=${encodeURIComponent(path)}&projectId=${projectId}`),
  renameFile: (oldPath, newPath, projectId) => req('PUT', '/fs/rename', { oldPath, newPath, projectId }),
  gitClone: (url, targetDir, projectId) => post('/fs/git-clone', { url, targetDir, projectId }),
  gitPush: (message, projectId) => post('/fs/git-push', { message, projectId }),
  authorizeDeletion: (projectId, path) => post('/fs/authorize-deletion', { projectId, path }),

  // Phase 9: Mentor + Marketplace
  getActiveProject: () => get('/projects/active'),
  getCurrentTask: (projectId, taskId) => get(`/tasks/current?projectId=${projectId}&taskId=${taskId}`),
  learningProcess: (payload) => post('/learning/process', payload),

  // Mentor Intervention Engine
  getMentorQueue: () => get('/mentor/queue'),
  getMentorSessionContext: (projectId) => get(`/session/context/${projectId}`),
  mentorJoinSession: (projectId) => post('/mentor/join', { projectId }),
  mentorLeaveSession: (projectId) => post('/mentor/leave', { projectId }),
  requestHelp: (projectId) => post('/task/help', { projectId }),
  
  getMarketplace: (q, difficulty) => get(`/marketplace?q=${encodeURIComponent(q || '')}&difficulty=${difficulty || 'all'}`),
  submitCommunityProject: (data) => post('/projects/community/submit', data),

  // Auth
  sendOtp: (email) => post('/auth/send-otp', { email }),
  verifyOtp: (email, otp, name, role) => post('/auth/verify-otp', { email, otp, name, role }),
  loginGoogle: (credential, role) => post('/auth/google', { credential, role }),
  updateRole: (role) => req('PUT', '/auth/role', { role }),
  getMe: () => get('/auth/me'),

  // V2 Course API
  getCourses: () => get('/courses'),
  getCourse: (id) => get(`/courses/${id}`),
  startCourse: (id) => post(`/courses/${id}/start`),
  submitCourseTask: (id, projectId) => post(`/courses/tasks/${id}/submit`, { projectId }),
  logBehavior: (data) => post('/courses/behavior/log', data),
  getScaffold: (taskId, projectId) => get(`/courses/tasks/${taskId}/scaffold?projectId=${projectId}`),

  // Course Builder (Mentor)
  builderCreateCourse: (data) => post('/builder/course', data),
  builderUpdateCourse: (id, data) => req('PUT', `/builder/course/${id}`, data),
  builderGetCourse: (id) => get(`/builder/course/${id}`),
  builderListCourses: () => get('/builder/courses'),
  builderAddMilestone: (courseId, data) => post(`/builder/course/${courseId}/milestone`, data),
  builderUpdateMilestone: (id, data) => req('PUT', `/builder/milestone/${id}`, data),
  builderDeleteMilestone: (id) => req('DELETE', `/builder/milestone/${id}`),
  builderAddTask: (milestoneId, data) => post(`/builder/milestone/${milestoneId}/task`, data),
  builderUpdateTask: (id, data) => req('PUT', `/builder/task/${id}`, data),
  builderDeleteTask: (id) => req('DELETE', `/builder/task/${id}`),
  builderPublishCourse: (id) => post(`/builder/course/${id}/publish`),
};

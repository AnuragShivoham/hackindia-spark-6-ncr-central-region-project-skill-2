const db = require('../db/database');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function getActiveCourses() {
  return db.prepare('SELECT * FROM courses WHERE is_active = 1').all();
}

function getCourse(id) {
  return db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
}

function getCourseFullStructure(courseId, version = 1) {
  const course = getCourse(courseId);
  if (!course) return null;
  
  const milestones = db.prepare('SELECT * FROM course_milestones WHERE course_id = ? ORDER BY position ASC').all(courseId);
  
  // Rule: Master tasks are filtered by version to ensure project immutability
  const tasks = db.prepare(`
    SELECT t.* FROM course_tasks t
    JOIN course_milestones m ON t.milestone_id = m.id
    WHERE m.course_id = ? AND t.version = ?
    ORDER BY m.position ASC, t.position ASC
  `).all(courseId, version);
  
  return { course, milestones, tasks };
}

// -------------------------------------------------------------
// SECURE VALIDATION ENGINE (Sandboxed Pathing & Strict Regex)
// -------------------------------------------------------------
function validateStaticTask(task, workspacePath) {
  // Map V2 course_tasks fields to V1 logic
  const expectedOutput = task.file_path || task.expected_output;
  if (!expectedOutput) return { passed: true };

  const safePath = path.resolve(workspacePath, expectedOutput);
  if (!safePath.startsWith(workspacePath)) {
    throw new Error("SECURITY FAULT: Invalid path traversal detected.");
  }

  // Parse hints securely
  let parsedHints = [];
  try { 
    parsedHints = typeof task.hints === 'string' ? JSON.parse(task.hints || "[]") : (task.hints || []);
  } catch(e) { 
    parsedHints = [task.hints]; 
  }
  
  const getHint = () => {
    const raw = parsedHints[0] || "Review your syntax.";
    return (typeof raw === 'string' ? raw : JSON.stringify(raw)).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  };

  if (task.validation_type === 'file_exists') {
    if (fs.existsSync(safePath)) return { passed: true };
    return { passed: false, hint: `File missing: Make sure you created '${expectedOutput}'.` };
  }

  if (task.validation_type === 'string_match' || task.validation_type === 'regex' || task.validation_type === 'contains') {
    if (!fs.existsSync(safePath)) {
      return { passed: false, hint: `File missing: ${expectedOutput}` };
    }
    
    let content = fs.readFileSync(safePath, 'utf8');
    content = content.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Strip comments
    
    // Extract pattern from task.validation_pattern (V1) or task.validation_rules (V2)
    let pattern = task.validation_pattern;
    if (!pattern && task.validation_rules) {
      try {
        const rules = typeof task.validation_rules === 'string' ? JSON.parse(task.validation_rules) : task.validation_rules;
        pattern = rules.regex || rules.pattern || rules.contains;
      } catch(e) {}
    }

    if (!pattern) return { passed: true };

    if (task.validation_type === 'contains' && !pattern.includes('/') && !pattern.includes('\\')) {
      if (content.toLowerCase().includes(pattern.toLowerCase())) return { passed: true };
    } else {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(content)) return { passed: true };
      } catch(e) {
        console.error("[CourseValidator] Invalid RegExp Pattern:", pattern);
      }
    }
    
    return { passed: false, hint: getHint() };
  }

  return { passed: true };
}

module.exports = {
  getActiveCourses,
  getCourse,
  getCourseFullStructure,
  validateStaticTask
};

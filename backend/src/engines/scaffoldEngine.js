function generateScaffold(taskId, hintLevel) {
  const db = require('../db/database');
  const task = db.prepare('SELECT * FROM course_tasks WHERE id = ?').get(taskId);
  if (!task) return null;

  // Level 0: Only task description
  if (hintLevel === 0) return { content: task.description, type: 'instruction' };
  
  // Level 1: Direction Hint
  let hints = [];
  try { hints = JSON.parse(task.hints || "[]"); } catch(e) { hints = [task.hints]; }
  if (hintLevel === 1) return { content: hints[0] || 'Start by locating the target file.', type: 'direction' };
  
  // Level 2: Structural Hint
  if (hintLevel === 2) return { content: `// TODO: Construct ${task.expected_output}`, type: 'structure' };

  // Level 3: Guided Breakdown
  if (hintLevel === 3) {
    const breakdown = `Step 1: Create file ${task.expected_output}\nStep 2: Define variables & imports\nStep 3: Implement exact logic requested`;
    return { content: breakdown, type: 'guided' };
  }

  // Level 4: Structured Gaps
  if (hintLevel >= 4) {
    const template = `// Step 1: Initialize required variables\n// TODO: Add variables here\n\n// Step 2: Write core logic constraint\n// TODO: Add logic here`;
    return { content: template, type: 'partial_code' };
  }

  return { content: task.description, type: 'instruction' };
}

module.exports = { generateScaffold };

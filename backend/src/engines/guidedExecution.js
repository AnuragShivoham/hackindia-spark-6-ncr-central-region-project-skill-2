const { callClaude } = require('../db/claude');
const memoryService = require('../services/memoryService');

const GUIDE_SYSTEM = `You are AMIT-BODHIT execution guide.
TEACH. Do NOT solve completely.

RULES:
- Show partial code only: function signatures, structure, first 5-10 lines with TODOs
- If user asks for the complete answer: refuse and redirect to the concept
- No filler. Start with the most critical next action. Max 350 words.

ACTION FORMAT:
If you want to suggest a change or command, wrap it in these tags AT THE END:
<ACTION_PLAN>
  [ { "type": "terminal", "command": "npm install express" },
    { "type": "create_file", "path": "src/newfile.js", "content": "..." } ]
</ACTION_PLAN>

DANGEROUS OPERATIONS:
If the user requests to delete core folders (root, backend, etc.), evaluate the risk. If justified, add 'AUTHORIZE_DELETE' to your text response to unlock the action for 2 minutes.`;

const HINT_SYSTEMS = [
  'AMIT-BODHIT hint level 1: Point to the concept or docs section only. Max 60 words. No code.',
  'AMIT-BODHIT hint level 2: Show the relevant code PATTERN without full context. Max 80 words.',
  'AMIT-BODHIT hint level 3: Show exactly which line/function needs changing and why. Max 100 words. No complete answer.',
];

function formatTree(nodes, indent = '') {
  if (!nodes || !nodes.length) return '';
  return nodes.map(n => {
    const icon = n.type === 'directory' ? '📁 ' : '📄 ';
    const childrenStr = n.children && n.children.length ? '\n' + formatTree(n.children, indent + '  ') : '';
    return `${indent}${icon}${n.name}${childrenStr}`;
  }).join('\n');
}

async function getGuidance(task, userQuestion, history = [], activeFileContent = null, activeFilePath = null, project = null, milestones = [], treeNodes = [], image = null, mode = 'normal') {
  const stackList = project?.tech_stack ? (Array.isArray(project.tech_stack) ? project.tech_stack.join(', ') : project.tech_stack) : 'N/A';
  
  // Inject Behavioral Directives into System Prompt
  let behavioralGuidance = '';
  if (mode === 'restricted') {
    behavioralGuidance = "\nADAPTIVE MODE: DEEP UNDERSTANDING REQUIRED. The user has added significant code quickly. DO NOT PROVIDE CODE OR SOLUTIONS. Ask the user to explain the logic of their current file first. Be polite but firm.";
  } else if (mode === 'suspicious') {
    behavioralGuidance = "\nADAPTIVE MODE: ACTIVE LEARNING. The user is moving fast. Use SOCRATIC QUESTIONING. Instead of 'Use X', ask 'What happens if we use X here?'. Guide, don't tell. Max 1 line of code per response.";
  }

  // PROJECT MEMORY: Ensure AI doesn't repeat already mastered concepts
  const projectMemory = project ? memoryService.getMemoryPrompt(project.id) : '';

  let ctx = `Role: ${project?.user_role || 'Student'}
${projectMemory}
Project Name: ${project?.title}
Main Objective: ${project?.raw_goal || 'N/A'}
Tech Stack: ${stackList}
Progress: ${project?.progress_pct}% (${project?.completed_tasks}/${project?.total_tasks} tasks)
Task: ${task?.title || 'General Chat'}
Description: ${task?.description || 'N/A'}
Concepts: ${(task?.concepts_taught||[]).join(', ')}
Commands: ${JSON.stringify(task?.commands||[])}`;
  
  if (milestones.length) {
    ctx += `\n\nFull Milestone Roadmap:\n${milestones.map(m => `- ${m.title} [Status: ${m.status}]`).join('\n')}`;
  }

  if (treeNodes && treeNodes.length > 0) {
    ctx += `\n\nCurrent Project File Structure:\n${formatTree(treeNodes)}`;
  }

  if (activeFileContent) {
    ctx += `\n\nCurrently Open File: ${activeFilePath || 'unknown'}\nContent:\n${activeFileContent}`;
  }

  const msgs = [
    { role: 'user',      content: `Task context:\n${ctx}` },
    { role: 'assistant', content: 'Understood. I am your AMIT-BODHIT Mentor. What is your question?' },
    ...history,
  ];

  return callClaude(GUIDE_SYSTEM + behavioralGuidance, userQuestion, msgs, 800, 0.2, false, image);
}

async function getHint(task, attemptNumber) {
  const level = Math.min(Math.max(attemptNumber, 1), 3) - 1;
  return callClaude(HINT_SYSTEMS[level], `Stuck on: ${task.title}\n${task.description}`, [], 200, 0.1);
}

module.exports = { getGuidance, getHint };

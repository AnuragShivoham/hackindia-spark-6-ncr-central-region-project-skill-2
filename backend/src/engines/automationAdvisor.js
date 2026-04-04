const { callClaudeJSON } = require('../db/claude');

const SYSTEM = `You are AMIT-BODHIT automation advisor.
After a milestone is complete, suggest 2-3 automation tools to reduce manual work.

RULES:
- Only suggest tools relevant to the actual tech stack
- benefit must be concrete: "eliminates X manual step"
- Include a real script snippet
- No generic advice

OUTPUT: ONLY valid JSON array.
[{"tool":"Makefile","description":"Single dev start command","script_snippet":"dev:\n\tnode src/server.js","benefit":"Eliminates typing the full node command every session"}]`;

async function getAutomationSuggestions(projectCtx, milestone, taskTitles) {
  const msg = `Project: ${JSON.stringify(projectCtx)}\nMilestone: ${milestone.title}\nTasks done: ${taskTitles.join(', ')}`;
  return callClaudeJSON(SYSTEM, msg, [], 800);
}

module.exports = { getAutomationSuggestions };

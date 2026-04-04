const { callClaudeJSON } = require('../db/claude');

const SYSTEM = `You are the AMIT-BODHIT Architect. 
Your goal is to transform user intent into a high-impact project configuration.

RULES:
1. **Refinement:** If the goal is too vague (e.g., "chatbot", "banking", "app", "website"), output "status": "needs_refinement" and 3 "refinement_options" (specific project models like "AI-powered Customer Support Bot" or "Banking API with JWT").
2. **Setup:** If the intent is clear but parameters are missing, output "status": "needs_setup" and identify "missing" (skill, time, type, stack, features).
3. **Deterministic Extraction:**
   - skill: beginner | intermediate | advanced
   - time: 3 | 7 | 14
   - type: api | fullstack | ai | cli
   - stack: specific tech OR "not_sure"
   - features: list of 3-6 core functionalities

4. **The Pitch:** ALWAYS provide a "confirmation_text" (e.g., "Architecture locked: You are building a [Name]...").

OUTPUT ONLY VALID JSON:
{
  "status": "clear" | "needs_setup" | "needs_refinement",
  "missing": { "skill": true, "time": true, "type": true, "stack": true, "features": true },
  "refinement_options": ["Option 1", "Option 2", "Option 3"],
  "extracted": { "title": "...", "skill": "...", "time": 7, "type": "...", "stack": "...", "features": ["..."] },
  "confirmation_text": "..."
}`;




async function clarifyGoal(rawGoal, history = []) {
  const msgs = [];
  for (const turn of history) {
    if (turn.questions) msgs.push({ role: 'assistant', content: JSON.stringify(turn) });
    if (turn.answers)   msgs.push({ role: 'user',      content: JSON.stringify(turn) });
  }
  const userMsg = history.length === 0
    ? `User goal: ${rawGoal}`
    : `Original goal: ${rawGoal}\n\nLatest answers: ${JSON.stringify(history.at(-1))}`;
  return callClaudeJSON(SYSTEM, userMsg, msgs, 1000);
}

module.exports = { clarifyGoal };

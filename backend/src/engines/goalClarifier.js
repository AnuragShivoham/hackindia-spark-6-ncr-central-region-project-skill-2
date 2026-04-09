const { callClaudeJSON } = require('../db/claude');

const SYSTEM = `You are the AMIT-BODHIT Architect. 
Your goal is to transform user intent into a high-impact project configuration.

RULES:
1. **Refinement:** If the goal is too vague (e.g., "chatbot", "banking", "app", "website"), output "status": "needs_refinement" and 3 "refinement_options".
2. **Clarification Phase:** If the intent is clear but you need to know the student AND project specifics, output "status": "needs_clarification" and 3-5 "questions".
   - Questions should be natural: "What is your experience with Node.js?", "Who is the end-user?", "Do you need persistent storage?".
3. **Deterministic Extraction:**
   - skill: beginner | intermediate | advanced
   - time: 3 | 7 | 14
   - type: api | fullstack | ai | cli
   - stack: specific tech list
   - features: list of 3-6 core functionalities
   - learning_profile: { "motivation": "...", "prior_knowledge": "..." }

4. **Flexibility:** If the user seems unsure, mentions "learning by doing", or asks to "just start", DO NOT ask more questions. Infer industry-standard defaults (e.g. React/Node for Fullstack).
5. **The Pitch:** ALWAYS provide a "confirmation_text" that is encouraging and validating.

OUTPUT ONLY VALID JSON:
{
  "status": "clear" | "needs_clarification" | "needs_refinement",
  "questions": [ { "id": "exp", "text": "..." }, { "id": "user", "text": "..." } ],
  "refinement_options": ["Option 1", "Option 2", "Option 3"],
  "extracted": { "title": "...", "skill": "...", "time": 7, "type": "...", "stack": "...", "features": ["..."], "learning_profile": {} },
  "confirmation_text": "..."
}`;

async function clarifyGoal(rawGoal, history = []) {
  const msgs = [];
  // Build history context for Claude
  const context = history.map(h => JSON.stringify(h)).join("\n");
  
  const userMsg = `
    User Goal: ${rawGoal}
    Current History: ${context}
    
    CRITICAL: If the history contains previous answers, DO NOT ask more questions unless absolutely critical. 
    Prioritize status: "clear" if you have enough to infer the skill, time, type, stack, and at least 3 features.
    If you MUST ask, ask ONLY 1-2 highly targeted questions to bridge the gap.
  `;
  
  return callClaudeJSON(SYSTEM, userMsg, msgs, 1000);
}

module.exports = { clarifyGoal };

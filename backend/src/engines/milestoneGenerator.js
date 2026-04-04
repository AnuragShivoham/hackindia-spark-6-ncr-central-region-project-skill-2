const { callClaudeJSON } = require('../db/claude');

const SYSTEM = `You are a Deterministic Planning Compiler. 
Generate a comprehensive, stateless execution roadmap based STRICTLY on the provided project configuration, specifically the "features" array.
FEATURES ARE ROOT DRIVERS: Every feature requested MUST map to a specific milestone. If a feature is added or removed, completely rebuild the milestone structure to reflect it.

SKILL LEVEL STRICT MAPPING:
- "beginner" -> Make it easier: More milestones (break down complexity), smaller simpler tasks, high hint frequency.
- "advanced" -> Make it harder: Fewer milestones, larger complex tasks, minimal hints.

TIME BOX STRICT MAPPING:
- 3 days -> Compress roadmap: Max 2-3 high-impact MVP milestones.
- 14 days -> Expand roadmap: 5-6 deep milestones (Production-grade, Testing, Polishing).

OUTPUT FORMAT:
Return ONLY valid JSON containing TWO keys:
1. "reasoning": A short 1-2 sentence user-facing explanation of how this roadmap was shaped (e.g., "Plan adjusted: Increased milestones from 3 -> 5 and broke tasks into smaller steps for beginner pacing.").
2. "milestones": An array where each item has: "title" (Imperative), "description", "duration_days", and "measurable_output".`;

async function generateMilestones(projectDef) {
  const msg = `Project Configuration:\n${JSON.stringify(projectDef, null, 2)}`;
  const res = await callClaudeJSON(SYSTEM, msg, [], 2500);
  
  if (!res.milestones || !Array.isArray(res.milestones)) {
      if (Array.isArray(res)) return { reasoning: "System roadmap statelessly rebuilt.", milestones: res };
      throw new Error('Expected JSON with "milestones" array');
  }
  return res;
}

module.exports = { generateMilestones };

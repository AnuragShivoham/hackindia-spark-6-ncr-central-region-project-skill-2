const { callClaudeJSON, callClaude } = require('../db/claude');
const db = require('../db/database');

/**
 * TASK ENGINE: The core decision engine for project progression.
 * It handles breakdown, validation, and the pedagogical hint ladder.
 */
const TaskEngine = {
    /**
     * Breakdown a high-level task into atomic technical steps.
     */
    async breakdownTask(task, projectContext) {
        const prompt = `You are the AMIT-BODHIT Technical Architect.
Break the following task into 3-5 ATOMIC technical steps.
The steps must be actionable and sequential.

TASK: ${task.title}
GOAL: ${task.technical_goal}
CONTEXT: ${JSON.stringify(projectContext)}

RETURN JSON: { "steps": ["step 1", "step 2", ...] }`;

        const res = await callClaudeJSON(prompt);
        return res.steps || ["Focus on technical implementation", "Implement core logic", "Run local validation"];
    },

    /**
     * Validate current file content against task requirements.
     */
    async validateTask(task, fileContent, filePath, project) {
        const prompt = `You are the AMIT-BODHIT Code Validator.
Analyze the user's code for Task: "${task.title}".
Technical Requirement: "${task.technical_goal}"

FILE: ${filePath}
CONTENT:
${fileContent}

RULES:
1. Check for logic, not just string matching.
2. If it's valid, set success: true.
3. If it fails, list SPECIFIC missing pieces (failed_checks).

RETURN JSON: { "success": true/false, "failed_checks": ["missing X", "logic error Y"], "feedback": "Short guidance" }`;

        return await callClaudeJSON(prompt);
    },

    /**
     * Implement the pedagogical Hint Ladder (L0-L4).
     * L0: Directive (No help)
     * L1: Concept (Pointers)
     * L2: Pseudocode 
     * L3: Snippet
     * L4: Solution (Last resort, high penalty)
     */
    async getHint(level, task, currentCode, history) {
        const systemPrompt = `You are the AMIT-BODHIT Mentor. 
Your goal is to guide the student WITHOUT giving the answer immediately.
Follow the LADDER logic strictly.

TASK: ${task.title}
REQUIREMENT: ${task.technical_goal}
CURRENT LEVEL: L${level}

LADDER RULES:
- L1 (Conceptual): Give a high-level theoretical hint. No code. No logic steps.
- L2 (Pseudocode): Give structural logic steps but no language-specific syntax.
- L3 (Snippet): Give a small, partial code snippet (3-4 lines) for the most difficult part.
- L4 (Full Solution): Provide the complete commented code for the task. (PENALTY LEVEL)`;

        const userPrompt = `Student Code:\n${currentCode}\n\nPrevious Hints: ${JSON.stringify(history)}`;
        
        return await callClaude(userPrompt, systemPrompt);
    }
};

module.exports = TaskEngine;

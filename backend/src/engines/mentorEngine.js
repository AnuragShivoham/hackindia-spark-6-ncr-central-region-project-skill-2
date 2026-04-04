const groq = require('../services/groqClient');

const PROMPTS = {
    pm: `You are a PROJECT MANAGER (SECURE). Break the goal into small, testable milestones. 
RULES:
- Reject vague goals.
- Avoid unnecessary complexity.
- Ensure safety constraints.`,
    
    architect: `You are a SYSTEM ARCHITECT (SECURITY ENFORCER). Design tasks matrix. 
RULES:
- Must enforce input validation layers.
- Flag any architectural vulnerabilities.
- Format strictly as tasks.`,

    execution: `You are an EXECUTION AGENT (CONTROLLED). 
RULES:
- Generate basic skeletal structural code only.
- DO NOT generate full working applications.
- Command scope must NEVER invoke elevated privileges (sudo, rm -rf).`,

    qa: `You are a strict QA / CRITIC. Evaluate the submission payload.
RULES:
- Check for missing validation or insecure patterns.
- Reject weak outputs or potential vulnerabilities actively.
- Return structured evaluation JSON.`,
    
    general: `You are an AI ASSISTANT acting as a rigorous engineering mentor.`
};

const COURSE_CONSTRAINT = `
COURSE MODE (RESTRICTED):
- You are a strict learning mentor. DO NOT give full solutions.
- ONLY provide hints and explanations. Focus on why something failed.
- Guide user step-by-step. Avoid direct answers entirely.
`;

function strictSecurityFilter(rawInput) {
    if (!rawInput) return false;
    
    // Capability Blocking Matrix (Denylist Combo)
    const blockedCaps = ['eval', 'Function', 'child_process', 'exec', 'spawn', 'rm -rf', 'wget'];
    const normalized = rawInput.toLowerCase().replace(/['"\s+\\]/g, ''); // strip out obfuscation wrappers like 'e'+'val'
    
    for (const cap of blockedCaps) {
        const strictCap = cap.toLowerCase();
        // Intersection checks native string fragments vs completely obfuscated concatenation bounds
        if (normalized.includes(strictCap) || rawInput.includes(cap)) {
             return `Blocked: Denylist capability invoked (${cap}). Operation voided.`;
        }
    }
    return null; 
}

function sanitize(contextStr) {
    return String(contextStr).replace(/[^a-zA-Z0-9_\-\s]/g, ""); 
}

async function run({ role, input, isCourse, context = {} }) {
    if (!PROMPTS[role]) throw new Error(`Invalid Mentor Role: ${role}`);

    const payloadString = typeof input === 'string' ? input : JSON.stringify(input);
    const securityCheck = strictSecurityFilter(payloadString);
    if (securityCheck) {
        throw new Error(`SECURITY EXCEPTION: ${securityCheck}`);
    }

    let systemPrompt = PROMPTS[role];
    if (isCourse) {
        systemPrompt += `\n${COURSE_CONSTRAINT}`;
        
        const safeMode = sanitize(context.mode || 'guided');
        const safeHelp = sanitize(context.helpLevel || 'medium');
        const safeDiff = sanitize(context.difficulty || 'medium');
        
        systemPrompt += `\nUSER CONTEXT:\n- Mode: ${safeMode}\n- Help Level: ${safeHelp}\n- Difficulty: ${safeDiff}`;
    }

    const payload = `User Input:\n${typeof input === 'string' ? input : JSON.stringify(input, null, 2)}`;
    
    try {
        const responseText = await groq.generate(payload, systemPrompt);
        
        const postCheck = strictSecurityFilter(responseText);
        if (postCheck) {
             throw new Error("SECURITY EXCEPTION: AI generated unsafe syntax. Operation blocked.");
        }

        return responseText;
    } catch (e) {
        console.error('Mentor Engine Error:', e.message);
        throw e;
    }
}

module.exports = { run, strictSecurityFilter };

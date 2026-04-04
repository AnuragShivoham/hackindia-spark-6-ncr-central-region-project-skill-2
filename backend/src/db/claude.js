const config = require('../config');

async function callClaude(system, userMsg, history = [], maxTokens = 2000, temp = 0.2, isJson = false, image = null) {
  const isLocal = config.LLM_PROVIDER === 'local';
  
  // Truncate based on provider limits (Local usually handled less, but we stay safe)
  const safeSystem = String(system).length > 8000 ? String(system).substring(0, 8000) + '\n...[TRUNCATED]' : system;
  const safeUserMsg = String(userMsg).length > 12000 ? String(userMsg).substring(0, 12000) + '\n...[TRUNCATED_DUE_TO_API_LIMITS]' : String(userMsg);
  
  // Model selection logic
  const hasImage = image && typeof image === 'string' && image.startsWith('data:image');
  let model;
  
  if (isLocal) {
    model = config.LOCAL_MODEL;
  } else {
    model = hasImage ? 'llama-3.2-11b-vision-preview' : config.GROQ_MODEL;
  }
  
  // Build user message content
  let userContent;
  if (hasImage) {
    userContent = [
      { type: 'text', text: safeUserMsg },
      { type: 'image_url', image_url: { url: image } }
    ];
  } else {
    userContent = safeUserMsg;
  }
  
  const messages = [
    { role: 'system', content: safeSystem },
    ...history.filter(m => m && m.content).slice(-4).map(m => ({ 
        role: m.role === 'assistant' ? 'assistant' : 'user', 
        content: String(m.content).substring(0, 1500) 
    })),
    { role: 'user', content: userContent },
  ];
  
  const body = { 
    model, 
    messages, 
    max_tokens: maxTokens, 
    temperature: temp
  };

  if (isJson && !hasImage) {
    body.response_format = { type: 'json_object' };
  }

  const url = isLocal 
    ? `${config.OLLAMA_BASE_URL}/v1/chat/completions` 
    : 'https://api.groq.com/openai/v1/chat/completions';
    
  const headers = { 'Content-Type': 'application/json' };
  if (!isLocal) headers['Authorization'] = `Bearer ${config.GROQ_API_KEY}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000); // 45s timeout

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    
    const data = await res.json();
    clearTimeout(timeout);

    if (!res.ok) throw new Error(JSON.stringify(data));
    return data.choices[0].message.content.trim();
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === 'AbortError') throw new Error('AI Request Timed Out (45s). Please try again.');
    throw e;
  }
}

/**
 * Robustly extracts the first JSON object or array from a string.
 * This helps if the LLM includes conversational filler before/after the JSON.
 */
function extractJSON(text) {
  const startObj = text.indexOf('{');
  const startArr = text.indexOf('[');
  
  let start = -1;
  let endChar = '';
  
  if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
    start = startObj;
    endChar = '}';
  } else if (startArr !== -1) {
    start = startArr;
    endChar = ']';
  }
  
  if (start === -1) return text; // No JSON found, return raw text and let parse fail
  
  const end = text.lastIndexOf(endChar);
  if (end === -1 || end < start) return text;
  
  return text.substring(start, end + 1);
}

async function callClaudeJSON(system, userMsg, history = [], maxTokens = 2000) {
  // Use lower temperature and forced JSON mode for better reliability
  const raw = await callClaude(system, userMsg, history, maxTokens, 0.1, true);
  let text = raw.trim();
  
  // Strip markdown blocks if present
  if (text.includes('```')) {
    text = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
  }
  
  // Extract strictly what looks like JSON (handles conversational filler)
  text = extractJSON(text);
  
  try {
    const parsed = JSON.parse(text);
    
    // Improved auto-unwrap logic for JSON mode:
    // Groq's JSON mode forces a root object {}. If the prompt asks for an array, 
    // models often return { "tasks": [...] } or { "items": [...], "count": 10 }.
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed);
      // Auto-unwrap: only if the object has EXACTLY one key and it's an array
      if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
        console.log(`[JSON Mode] Auto-unwrapped single array from key: ${keys[0]}`);
        return parsed[keys[0]];
      }
    }
    
    return parsed;
  } catch (e) {
    // Basic repair attempt for trailing commas
    try {
      const repaired = text.replace(/,\s*([}\]])/g, '$1');
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.length === 1 && Array.isArray(parsed[keys[0]])) {
          return parsed[keys[0]];
        }
      }
      return parsed;
    } catch (e2) {
      console.error('[JSON Parse Error]', e, '\nRaw Output:', raw);
      throw new Error(`Failed to parse AI response as JSON. See server logs for raw output.`);
    }
  }
}

module.exports = { callClaude, callClaudeJSON };
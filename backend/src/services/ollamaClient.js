const config = require('../config');

/**
 * Standard Ollama Client for local LLM generation.
 * Communicates with the local Ollama instance (default port 11434).
 */
async function generate(prompt, system = '') {
  const model = config.LOCAL_MODEL || 'llama3.1:8b'; // default if not set
  const url = `${config.OLLAMA_BASE_URL}/api/generate`;

  console.log(`[OLLAMA] Generating with model: ${model}...`);
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        system: system,
        stream: false, // Wait for full response
      }),
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
        const errTxt = await res.text();
        throw new Error(`Ollama Error: ${res.status} - ${errTxt}`);
    }

    const data = await res.json();
    return data.response;
  } catch (e) {
    console.error('[OLLAMA] Generation failed:', e.message);
    throw new Error(`Local AI is not responding. (Ollama running? Run: ollama run ${model})`);
  }
}

module.exports = { generate };

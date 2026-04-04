const config = require('../config');
const groq = require('./groqClient');
const ollama = require('./ollamaClient');

/**
 * AI Service Manager - The "Single Toggle" Interface
 * Routes requests to either Groq Cloud or Local Ollama based on LLM_PROVIDER.
 */
async function generate(prompt, system = '', options = {}) {
  const provider = config.LLM_PROVIDER || 'groq';

  if (provider === 'ollama') {
    return await ollama.generate(prompt, system);
  }

  // DEFAULT: Groq
  return await groq.generate(prompt, system);
}

module.exports = { generate };

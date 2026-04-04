/**
 * groqClient.js — Shim that wraps claude.js (which actually calls Groq API)
 * mentorEngine.js requires groq.generate(userMsg, systemPrompt)
 */
const { callClaude } = require('../db/claude');

module.exports = {
  generate: (userMsg, systemPrompt) => callClaude(systemPrompt, userMsg)
};

require('dotenv').config();

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
if (!GROQ_API_KEY) {
  console.warn('\nWARNING: GROQ_API_KEY is not set in .env! Backend AI features will fail.\n');
}

module.exports = {
  PORT: process.env.PORT || 3001,
  LLM_PROVIDER: process.env.LLM_PROVIDER || 'groq', // groq | ollama
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  GROQ_API_KEY,
  GROQ_MODEL: 'llama-3.3-70b-versatile',
  LOCAL_MODEL: process.env.LOCAL_MODEL || 'phi3:mini', // Use phi3:mini for speed
  DB_PATH: process.env.DB_PATH || './data/amitbodhit.db',
  MAX_CLARIFY_ROUNDS: 5,
  QA_PASS_SCORE: 0.70,
  JWT_SECRET: process.env.JWT_SECRET || 'amit-bodhit-secret-change-in-prod',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  EMAIL_HOST: process.env.EMAIL_HOST || 'smtp.gmail.com',
  EMAIL_PORT: parseInt(process.env.EMAIL_PORT || '587'),
  EMAIL_USER: process.env.EMAIL_USER || '',
  EMAIL_PASS: process.env.EMAIL_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'AMIT-BODHIT <no-reply@amitbodhit.app>',
};
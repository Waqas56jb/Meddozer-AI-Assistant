/**
 * Vercel serverless entry — full Express app (chat, lead, realtime-token, health).
 * Deploy with project Root Directory = repository root (not `frontend`).
 */
module.exports = require('../backend/api/index.js');

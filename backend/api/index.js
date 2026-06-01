// Vercel serverless entry — export the Express app directly.
// Vercel's Node runtime invokes the export as (req, res); an Express app is a
// valid (req, res) handler. Do NOT wrap with serverless-http: that expects the
// AWS Lambda (event, context) signature and hangs forever on Vercel.
const app = require('../server');
module.exports = app;

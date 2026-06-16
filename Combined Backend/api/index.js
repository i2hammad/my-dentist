// Vercel serverless entry point.
// Vercel turns each file in /api into a serverless function. We re-export the
// Express app from server.js; vercel.json rewrites every request to here.
module.exports = require('../server');
